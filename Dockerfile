# All-in-One Dockerfile for qianxun-yuncang
# 包含 Node.js (Backend), Nginx (Frontend) 和 MariaDB (Database)

# --- 阶段 1: 构建前端 ---
FROM node:18-bullseye AS frontend-builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# --- 阶段 2: 构建后端 ---
FROM node:18-bullseye AS backend-builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY server/ ./server/
RUN cd server && npx tsc

# --- 阶段 3: 最终镜像 ---
FROM node:18-bullseye

# 安装 Nginx 和 MariaDB
RUN apt-get update && apt-get install -y \
    nginx \
    mariadb-server \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 复制前端产物
COPY --from=frontend-builder /app/dist /usr/share/nginx/html

# 复制后端产物和依赖
COPY --from=backend-builder /app/server/dist /app/server/dist
COPY --from=backend-builder /app/node_modules /app/node_modules
COPY server/ /app/server/

# 复制 SQL 初始文件和配置文件
COPY yuncang.sql /app/yuncang.sql
COPY nginx.conf /etc/nginx/sites-available/default

# 修改 nginx 配置中的后端地址 (改为 127.0.0.1)
RUN sed -i 's/http:\/\/backend:8001/http:\/\/127.0.0.1:8001/g' /etc/nginx/sites-available/default

# 复制启动脚本
COPY docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

# 暴露端口
EXPOSE 80

# 启动
ENTRYPOINT ["/app/docker-entrypoint.sh"]
