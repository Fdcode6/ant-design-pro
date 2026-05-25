# 余额权限与操作审计任务清单

> 编写日期：2026-05-25
>
> 目标：按可核对、可回滚、可验证的顺序修复余额调整权限漏洞，并让新流水记录真实操作人。
>
> 状态约定：实施前保持全部未勾选。执行时每完成一步再勾选。

## 阶段 0：实施前确认

- [ ] 负责人确认修复范围：本轮必须包含后端鉴权、管理员校验、真实操作人审计、前端 token 接入。
- [ ] 负责人确认第一轮不回填旧流水真实操作人。
- [ ] 负责人确认生产环境允许新增 `transactions` nullable 审计字段。
- [ ] 负责人确认上线窗口，并准备数据库备份。

## 阶段 1：建立服务端认证基础

- [ ] 在 `package.json` 增加依赖 `jsonwebtoken`。
- [ ] 在 `package.json` 增加开发依赖 `@types/jsonwebtoken`。
- [ ] 设计 JWT payload：
  - `id`
  - `username`
  - `realName`
  - `role`
  - `status`
- [ ] 在 `server/index.ts` 增加 `JWT_SECRET` 读取逻辑。
- [ ] 在 `server/index.ts` 增加 token 签发函数。
- [ ] 在 `server/index.ts` 增加 `authenticate` 中间件。
- [ ] 在 `server/index.ts` 增加 `requireAdmin` 中间件。
- [ ] 确认无 token 请求返回 `401`。
- [ ] 确认非管理员请求管理员接口返回 `403`。

## 阶段 2：改造登录与当前用户接口

- [ ] 修改 `POST /api/login/account`：
  - 登录成功返回 `accessToken`。
  - 保留 `status`、`type`、`currentAuthority`、`userId`，避免前端一次性大面积崩溃。
- [ ] 修改 `GET /api/currentUser`：
  - 必须通过 `authenticate`。
  - 不再读取 `req.query.userId` 作为当前用户身份。
  - 返回 token 对应用户。
- [ ] 修改 `POST /api/login/outLogin`：
  - 保持无状态返回成功。
  - 前端负责清理 token。

## 阶段 3：锁死余额调整接口

- [ ] 修改 `POST /api/users/:id/balance`，加入 `authenticate`。
- [ ] 修改 `POST /api/users/:id/balance`，加入 `requireAdmin`。
- [ ] 保留现有事务逻辑：
  - 开启事务。
  - 查询目标用户当前余额。
  - 计算新余额。
  - 禁止余额小于 0。
  - 更新 `users.balance`。
  - 写入 `transactions`。
  - 提交事务。
- [ ] 增加 `type` 校验，只允许 `increase` 和 `decrease`。
- [ ] 增加 `amount` 校验，只允许大于 0 的有限数字。
- [ ] 增加 `reason` 校验，建议管理员调整必须填写原因。
- [ ] 确认普通用户即使知道接口地址也无法调整余额。

## 阶段 4：新增并写入审计字段

- [ ] 修改 `server/schema.sql`，在 `transactions` 增加：
  - `operator_id INT NULL`
  - `operator_username VARCHAR(50) NULL`
  - `operator_role VARCHAR(20) NULL`
  - `operator_ip VARCHAR(64) NULL`
  - `operator_user_agent TEXT NULL`
- [ ] 准备生产迁移 SQL：

```sql
ALTER TABLE transactions
  ADD COLUMN operator_id INT NULL,
  ADD COLUMN operator_username VARCHAR(50) NULL,
  ADD COLUMN operator_role VARCHAR(20) NULL,
  ADD COLUMN operator_ip VARCHAR(64) NULL,
  ADD COLUMN operator_user_agent TEXT NULL;
```

- [ ] 修改余额流水插入 SQL，写入新增字段。
- [ ] 将旧 `operator` 字段的新值改为真实 `req.user.username`。
- [ ] 从请求中提取 IP：
  - 优先 `X-Forwarded-For` 第一个 IP。
  - 其次 `X-Real-IP`。
  - 最后 `req.socket.remoteAddress`。
- [ ] 从请求头提取 `User-Agent`。
- [ ] 确认管理员调整余额后，新流水包含真实操作人字段。

## 阶段 5：收紧查询类接口

- [ ] 修改 `GET /api/users`：
  - 必须登录。
  - 只允许管理员访问。
- [ ] 修改 `GET /api/users/:id`：
  - 管理员可访问任意用户。
  - 普通用户只能访问自己。
- [ ] 修改 `POST /api/users`：
  - 只允许管理员创建用户。
- [ ] 修改 `PUT /api/users/:id`：
  - 只允许管理员更新用户。
- [ ] 修改 `GET /api/transactions`：
  - 管理员可看全部。
  - 普通用户只能看自己的流水，忽略前端传入的任意 `userId`。
- [ ] 修改 `GET /api/dashboard/stats`：
  - 管理员看全局统计。
  - 普通用户只看自己的统计。
  - 不再信任前端传入的 `isAdmin`。
- [ ] 修改 `GET /api/users/options`：
  - 只允许管理员访问。

## 阶段 6：前端接入 token

- [ ] 修改 `src/pages/User/Login/index.tsx`：
  - 登录成功保存 `accessToken`。
  - 不再通过 `/api/currentUser?userId=...` 拉当前用户。
  - 登录成功后调用统一的 `fetchUserInfo()`。
- [ ] 修改 `src/app.tsx`：
  - `fetchUserInfo()` 调 `/api/currentUser`。
  - 如果没有 `accessToken`，返回未登录。
  - 删除对 `localStorage.userId` 的身份依赖。
- [ ] 修改 `src/requestErrorConfig.ts`：
  - 删除 `?token = 123` 拦截逻辑。
  - 为存在 token 的请求添加 `Authorization: Bearer <token>`。
  - 遇到 `401` 清理 token 并跳转登录。
  - 遇到 `403` 显示无权限提示。
- [ ] 修改 `src/components/RightContent/AvatarDropdown.tsx`：
  - 退出登录时清理 `accessToken`。
  - 兼容清理旧 `userId`。
- [ ] 修改 `src/services/ant-design-pro/typings.d.ts`：
  - `LoginResult` 增加 `accessToken?: string`。

## 阶段 7：测试清单

- [ ] 新增或改造服务端测试，覆盖普通用户调用余额调整返回 `403`。
- [ ] 新增或改造服务端测试，覆盖管理员调用余额调整返回成功。
- [ ] 新增或改造服务端测试，覆盖管理员操作后 `transactions.operator_username` 为真实用户名。
- [ ] 新增或改造服务端测试，覆盖无 token 调 `/api/currentUser` 返回 `401`。
- [ ] 新增或改造服务端测试，覆盖普通用户无法通过 query `userId` 查看别人流水。
- [ ] 新增或改造服务端测试，覆盖管理员可查看全量流水。
- [ ] 手动测试普通用户登录后看不到 `用户管理` 菜单。
- [ ] 手动测试普通用户直接请求余额调整接口失败。
- [ ] 手动测试管理员页面增加余额成功。
- [ ] 手动测试管理员页面扣除余额成功。
- [ ] 手动检查新增流水审计字段。

## 阶段 8：本地验证命令

- [ ] 执行 TypeScript 检查：

```bash
npm run tsc
```

- [ ] 执行 JS/TS lint：

```bash
npm run lint:js
```

- [ ] 执行构建：

```bash
npm run build
```

- [ ] 如新增测试脚本，执行对应测试命令并记录结果。

## 阶段 9：上线前检查

- [ ] 确认生产 `JWT_SECRET` 已配置，且不是默认值。
- [ ] 确认生产数据库已备份。
- [ ] 确认生产迁移 SQL 已在测试库执行过。
- [ ] 确认 Docker 镜像或部署包来自本次修复版本。
- [ ] 确认外层代理会传递真实 IP。
- [ ] 确认管理员账号可登录。
- [ ] 确认普通用户账号可登录。

## 阶段 10：上线后验证

- [ ] 管理员登录。
- [ ] 管理员对测试用户增加一笔小额余额。
- [ ] 查询 `transactions`，确认：
  - `operator` 是真实管理员用户名。
  - `operator_id` 是真实管理员 ID。
  - `operator_username` 是真实管理员用户名。
  - `operator_role` 是 `admin`。
  - `operator_ip` 有值。
  - `operator_user_agent` 有值。
- [ ] 普通用户登录。
- [ ] 普通用户直接请求 `POST /api/users/:id/balance`，确认返回 `403`。
- [ ] 普通用户尝试查看其他用户流水，确认被限制。
- [ ] 检查 Nginx access log，确认余额接口请求时间能和数据库流水对齐。

## 阶段 11：回滚检查

- [ ] 如果出现登录失败，先回滚应用镜像。
- [ ] 回滚时保留新增数据库字段，不删除。
- [ ] 回滚后检查最近 30 分钟是否有异常余额流水。
- [ ] 若出现异常流水，先冻结相关账号余额操作，再人工核对。

## 阶段 12：后续硬化任务

- [ ] 明文密码迁移为哈希密码。
- [ ] 所有用户强制重置密码。
- [ ] 轮换数据库密码。
- [ ] 从镜像和仓库中移除硬编码数据库密码。
- [ ] 新增独立管理员操作审计表。
- [ ] 增加大额余额变动告警。
- [ ] 增加空原因、重复添加、连续小额等异常检测。
- [ ] 为管理员余额调整增加二次确认。

## 对齐自检

- [ ] 计划文档中的目标已覆盖本清单阶段 1 到阶段 6。
- [ ] 计划文档中的数据库迁移已覆盖本清单阶段 4。
- [ ] 计划文档中的测试策略已覆盖本清单阶段 7 和阶段 8。
- [ ] 计划文档中的部署计划已覆盖本清单阶段 9 和阶段 10。
- [ ] 计划文档中的回滚计划已覆盖本清单阶段 11。
- [ ] 计划文档中的后续硬化已覆盖本清单阶段 12。
