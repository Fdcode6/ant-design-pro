# 余额权限与操作审计修复计划

> 编写日期：2026-05-25
>
> 范围：本计划只描述修复设计，不包含代码修改。实施前需要先由业务负责人确认。

## 1. 背景与已确认问题

当前系统的余额调整接口是 `POST /api/users/:id/balance`。本地代码和线上只读排查确认了以下事实：

- 普通用户正常界面一般看不到“增加余额 / 扣除余额”入口，因为入口在 `src/pages/UserManagement/index.tsx`，菜单在 `src/app.tsx` 中按 `admin` 过滤。
- 后端接口没有鉴权和角色校验。只要能请求接口，就能提交 `increase` 或 `decrease`。
- 当前登录态依赖 `localStorage.userId` 和 `/api/currentUser?userId=...`，用户可以在浏览器里篡改 `userId`。
- 余额流水中的 `operator` 在 `server/index.ts` 中硬编码为 `admin`，所以所有流水都显示 `admin`，不能追溯真实操作人。
- 线上 Nginx 日志里余额调整请求的来源 IP 都是 `172.17.0.1`，说明真实客户端 IP 没有被后端审计保存。
- 线上近期没有看到明显无 Referer、curl、Python、Postman 等直接调用余额接口的记录，但因为没有真实登录审计，不能排除登录后绕过前端的操作。

## 2. 修复目标

本次修复的目标是让余额调整同时满足三条硬要求：

1. **只有服务端确认的管理员可以调整余额。**
2. **每条新余额流水都记录真实操作人，而不是统一显示 `admin`。**
3. **新日志可以用于事后审计，至少包含操作人、角色、IP、User-Agent、操作时间、金额、原因和变动后余额。**

## 3. 非目标

以下事项重要，但不放进第一轮关键修复，避免扩大风险：

- 不重构整个前端权限系统。
- 不改变余额业务语义，`increase` 仍代表充值 / 增加，`decrease` 仍代表消费 / 扣除。
- 不回填旧流水的真实操作人。旧数据没有可靠证据，只能保留旧 `operator`。
- 不在第一轮彻底重做用户体系。密码哈希化和用户密码重置放到上线前硬化任务。

## 4. 推荐方案

采用“后端强鉴权 + JWT 登录态 + 余额接口 RBAC + 审计字段”的方案。

### 4.1 登录态

登录成功后，后端签发短期 JWT：

- token payload 包含 `id`、`username`、`realName`、`role`、`status`。
- token 过期时间建议先设为 8 小时。
- token secret 从环境变量 `JWT_SECRET` 读取；本地开发允许兜底，但生产必须显式配置。

前端保存 `accessToken`，所有 `/api/*` 请求通过 `Authorization: Bearer <token>` 发送。

### 4.2 服务端身份识别

后端新增认证中间件：

- `authenticate`：验证 Bearer token，查数据库确认用户仍存在且 `status='active'`。
- `requireAdmin`：要求 `req.user.role === 'admin'`，否则返回 `403`。

所有依赖当前用户身份的接口改为从 `req.user` 取值，不再信任请求参数里的 `userId` 来代表当前登录人。

### 4.3 余额调整权限

`POST /api/users/:id/balance` 必须加：

```text
authenticate -> requireAdmin -> adjust balance
```

非管理员直接返回：

```json
{
  "success": false,
  "error": "无权限调整余额"
}
```

HTTP 状态码使用 `403`。

### 4.4 余额流水审计

保留原字段 `operator`，但新记录中改为真实用户名，兼容现有页面。

新增审计字段：

```sql
ALTER TABLE transactions
  ADD COLUMN operator_id INT NULL,
  ADD COLUMN operator_username VARCHAR(50) NULL,
  ADD COLUMN operator_role VARCHAR(20) NULL,
  ADD COLUMN operator_ip VARCHAR(64) NULL,
  ADD COLUMN operator_user_agent TEXT NULL;
```

新流水写入规则：

- `operator`：真实用户名，例如 `admin` 或 `qianxun01`。
- `operator_id`：当前登录管理员的用户 ID。
- `operator_username`：当前登录管理员用户名。
- `operator_role`：当前登录管理员角色。
- `operator_ip`：从 `X-Forwarded-For`、`X-Real-IP` 或 socket 地址提取。
- `operator_user_agent`：请求头 `User-Agent`。

### 4.5 前端改造

前端做以下调整：

- 登录成功后保存 `accessToken`，不再只保存 `userId`。
- `getInitialState()` 调 `/api/currentUser`，不再拼 `?userId=...`。
- 请求拦截器删除 `?token = 123` 伪参数，改为注入 `Authorization` header。
- 退出登录时清理 `accessToken` 和旧 `userId`。
- 普通用户界面仍隐藏 `用户管理` 菜单，但安全决策由后端兜底。

### 4.6 Nginx 与真实 IP

当前容器内 Nginx 能看到的请求来源是 Docker 网关 `172.17.0.1`。后端仍应读取代理头，但生产还需要在外层反代或网关中正确透传真实 IP：

```nginx
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto $scheme;
```

如果外层还有云厂商负载均衡或另一个 Nginx，也必须配置相同转发头。

## 5. 需要修改的文件

后端：

- `server/index.ts`
  - 增加认证中间件。
  - 登录接口返回 `accessToken`。
  - `/api/currentUser` 改为 token 驱动。
  - `/api/users/:id/balance` 加管理员校验。
  - 余额流水写入真实审计字段。
  - `/api/dashboard/stats`、`/api/transactions` 等接口按当前用户和角色限制数据范围。
- `server/schema.sql`
  - 新增审计字段。
- `server/database.ts`
  - 不改业务逻辑，但生产部署需要环境变量覆盖数据库密码。

前端：

- `src/app.tsx`
  - 初始化当前用户改为读取 token。
  - 页面权限继续保留，但不再作为唯一防线。
- `src/requestErrorConfig.ts`
  - 删除 `?token = 123`。
  - 注入 `Authorization` header。
  - 处理 `401/403`，必要时跳转登录。
- `src/pages/User/Login/index.tsx`
  - 保存 `accessToken`。
  - 删除直接 `/api/currentUser?userId=...` 的调用。
- `src/components/RightContent/AvatarDropdown.tsx`
  - 退出登录清理 token。
- `src/services/ant-design-pro/typings.d.ts`
  - `LoginResult` 增加 `accessToken`。

依赖：

- `package.json`
  - 增加 `jsonwebtoken`。
  - 增加 `@types/jsonwebtoken`。

测试：

- 建议新建 `server/index.test.ts` 或拆出 `server/auth.ts`、`server/app.ts` 后测试。
- 如果不拆文件，先添加可测试的权限函数，再逐步覆盖接口行为。

## 6. 数据库迁移计划

先在测试环境执行：

```sql
ALTER TABLE transactions
  ADD COLUMN operator_id INT NULL,
  ADD COLUMN operator_username VARCHAR(50) NULL,
  ADD COLUMN operator_role VARCHAR(20) NULL,
  ADD COLUMN operator_ip VARCHAR(64) NULL,
  ADD COLUMN operator_user_agent TEXT NULL;
```

上线时执行同一迁移。该迁移只新增 nullable 字段，不会影响旧数据读取。

旧数据保留：

- `operator='admin'` 的历史含义不变。
- 不回填 `operator_id`，避免制造不可靠审计记录。

## 7. 测试策略

必须覆盖以下行为：

1. 普通用户登录后调用 `POST /api/users/:id/balance` 返回 `403`。
2. 管理员登录后调用 `POST /api/users/:id/balance` 成功。
3. 管理员调整余额后，`transactions` 新记录包含真实 `operator_id`、`operator_username`、`operator_role`。
4. 没有 token 调 `/api/currentUser` 返回 `401`。
5. 篡改 `localStorage.userId` 不影响后端识别的当前用户。
6. 普通用户查询流水只能看到自己的流水。
7. 管理员查询流水可以看到全部流水。

验证命令：

```bash
npm run tsc
npm run lint:js
npm run build
```

如果新增测试框架或服务端测试脚本，需要在实施计划中补充对应命令。

## 8. 部署计划

推荐部署顺序：

1. 备份线上数据库。
2. 在测试环境执行 schema 迁移。
3. 部署后端和前端代码。
4. 配置生产 `JWT_SECRET`。
5. 用管理员账号验证余额调整成功，确认审计字段写入。
6. 用普通用户账号验证余额调整失败。
7. 检查 Nginx access log 与交易流水时间是否能对齐。

## 9. 回滚计划

如果上线后出现登录失败或余额无法操作：

1. 回滚应用镜像到上一版本。
2. 保留新增数据库字段，不需要删除，因为是 nullable 字段且旧代码不会使用。
3. 恢复后立即检查最近余额流水，确认是否出现异常写入。

## 10. 上线后的安全硬化

第一轮修复完成后，继续安排：

- 用户密码从明文改为哈希存储。
- 轮换数据库密码和所有镜像内硬编码密钥。
- 禁止公网直接访问非必要端口。
- 给登录、余额调整、用户管理增加独立审计表。
- 为管理员操作增加二次确认或二次验证。
- 增加定时异常检测，例如大额充值、连续小额、空原因、重复添加等。

## 11. 自检结论

本计划覆盖了已确认的两个核心漏洞：

- 普通用户或伪造身份可以绕过前端调用余额调整接口。
- 余额流水无法记录真实操作人。

本计划也明确了第一轮不做的事项，避免把权限修复、密码体系、部署硬化混在一次上线里造成不可控风险。
