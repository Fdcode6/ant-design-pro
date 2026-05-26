# 数据库持久化部署说明

## 目标

当前线上历史部署把 MariaDB 跑在 All-in-One 应用容器内部，数据库数据位于容器可写层。后续应迁移为 Compose 拓扑：

- `db`：MariaDB 10.5，数据保存在 Docker 命名卷 `yuncang_mysql_data`。
- `backend`：Node API，只通过 `DB_HOST=db` 访问数据库。
- `frontend`：Nginx 静态前端，`/api/` 代理到 `backend:8001`。

迁移后，升级应用只重建 `backend` 和 `frontend`，不删除数据库卷。

## 环境文件

服务器上复制示例文件：

```bash
cp .env.production.example .env
```

必须替换：

- `MARIADB_ROOT_PASSWORD`
- `MARIADB_PASSWORD`
- `JWT_SECRET`

生产 `JWT_SECRET` 使用长随机值，例如：

```bash
openssl rand -hex 32
```

## 本地验证流程

以下命令使用独立项目名和端口，避免影响已有本地容器：

```bash
COMPOSE_PROJECT_NAME=yuncang-persistent-test \
FRONTEND_PORT=18084 \
DB_PORT=13306 \
MARIADB_ROOT_PASSWORD=local-root-pass \
MARIADB_PASSWORD=local-yuncang-pass \
DB_CONTAINER_NAME=yuncang-persistent-db \
BACKEND_CONTAINER_NAME=yuncang-persistent-backend \
FRONTEND_CONTAINER_NAME=yuncang-persistent-frontend \
DB_VOLUME_NAME=yuncang_persistent_test_mysql_data \
JWT_SECRET=local-persistent-db-secret \
docker compose up -d --build
```

恢复 SQL 备份：

```bash
gzip -dc .temp/production-backups/yuncang-prod-before-auth-audit-20260526-072227.sql.gz \
  | COMPOSE_PROJECT_NAME=yuncang-persistent-test \
    FRONTEND_PORT=18084 \
    DB_PORT=13306 \
    MARIADB_ROOT_PASSWORD=local-root-pass \
    MARIADB_PASSWORD=local-yuncang-pass \
    DB_CONTAINER_NAME=yuncang-persistent-db \
    BACKEND_CONTAINER_NAME=yuncang-persistent-backend \
    FRONTEND_CONTAINER_NAME=yuncang-persistent-frontend \
    DB_VOLUME_NAME=yuncang_persistent_test_mysql_data \
    JWT_SECRET=local-persistent-db-secret \
    docker compose exec -T db mariadb --default-character-set=utf8mb4 -uroot -plocal-root-pass yuncang
```

验证服务：

```bash
curl -fsS http://127.0.0.1:18084/health
```

验证数据量：

```bash
COMPOSE_PROJECT_NAME=yuncang-persistent-test \
FRONTEND_PORT=18084 \
DB_PORT=13306 \
MARIADB_ROOT_PASSWORD=local-root-pass \
MARIADB_PASSWORD=local-yuncang-pass \
DB_CONTAINER_NAME=yuncang-persistent-db \
BACKEND_CONTAINER_NAME=yuncang-persistent-backend \
FRONTEND_CONTAINER_NAME=yuncang-persistent-frontend \
DB_VOLUME_NAME=yuncang_persistent_test_mysql_data \
JWT_SECRET=local-persistent-db-secret \
docker compose exec -T db mariadb -uroot -plocal-root-pass -N -B yuncang \
  -e "SELECT COUNT(*) FROM users; SELECT COUNT(*) FROM transactions;"
```

验证持久化：

```bash
COMPOSE_PROJECT_NAME=yuncang-persistent-test \
FRONTEND_PORT=18084 \
DB_PORT=13306 \
MARIADB_ROOT_PASSWORD=local-root-pass \
MARIADB_PASSWORD=local-yuncang-pass \
DB_CONTAINER_NAME=yuncang-persistent-db \
BACKEND_CONTAINER_NAME=yuncang-persistent-backend \
FRONTEND_CONTAINER_NAME=yuncang-persistent-frontend \
DB_VOLUME_NAME=yuncang_persistent_test_mysql_data \
JWT_SECRET=local-persistent-db-secret \
docker compose down

COMPOSE_PROJECT_NAME=yuncang-persistent-test \
FRONTEND_PORT=18084 \
DB_PORT=13306 \
MARIADB_ROOT_PASSWORD=local-root-pass \
MARIADB_PASSWORD=local-yuncang-pass \
DB_CONTAINER_NAME=yuncang-persistent-db \
BACKEND_CONTAINER_NAME=yuncang-persistent-backend \
FRONTEND_CONTAINER_NAME=yuncang-persistent-frontend \
DB_VOLUME_NAME=yuncang_persistent_test_mysql_data \
JWT_SECRET=local-persistent-db-secret \
docker compose up -d
```

不要加 `-v`，否则会删除数据库卷。

## 线上迁移建议流程

1. 确认当前线上健康检查正常。
2. 导出线上 SQL 备份，并复制一份到本地。
3. 在服务器准备 `.env`，写入生产数据库密码和 `JWT_SECRET`。
4. 拉取或上传新代码和镜像。
5. 启动 Compose，但不要删除旧 All-in-One 容器，先改名保留。
6. 将 SQL 备份恢复到 `db` 服务的 `yuncang_mysql_data` 卷。
7. 验证数据量、管理员登录、普通用户权限、余额 `+0.01/-0.01` 测试。
8. 保留旧容器和备份至少一个发布周期。

## 回滚

如果 Compose 迁移后登录或接口异常：

1. 停止 Compose：

```bash
docker compose down
```

2. 恢复旧 All-in-One 容器名称并启动。
3. 保留 `yuncang_mysql_data` 卷，不删除，等待排查。
4. 使用迁移前 SQL 备份核对迁移窗口内是否产生新流水。

## 注意事项

- 数据库卷是生产数据，不要执行 `docker compose down -v`。
- 数据库端口在 Compose 中只绑定 `127.0.0.1`，不要改成 `0.0.0.0`。
- 线上备份仍然必须保留，数据卷不是备份。
- `server/schema.sql` 只用于空库初始化结构，不替代生产数据恢复。
