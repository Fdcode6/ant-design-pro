#!/bin/bash
set -e

# 设置数据库配置
DB_USER=${DB_USER:-"yuncang"}
DB_PASSWORD=${DB_PASSWORD:-"NeGAj5awAn7bfWit"}
DB_NAME=${DB_NAME:-"yuncang"}

# 启动 MySQL (MariaDB)
echo "Starting MySQL..."
service mariadb start

# 等待 MySQL 启动
until mysqladmin ping >/dev/null 2>&1; do
  echo "Waiting for MySQL to start..."
  sleep 2
done

# 检查数据库是否已导入，如果没有则导入
if ! mysql -e "use $DB_NAME" >/dev/null 2>&1; then
    echo "Initializing database..."
    mysql -e "CREATE DATABASE IF NOT EXISTS $DB_NAME CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
    mysql -e "CREATE USER IF NOT EXISTS '$DB_USER'@'localhost' IDENTIFIED BY '$DB_PASSWORD';"
    mysql -e "GRANT ALL PRIVILEGES ON $DB_NAME.* TO '$DB_USER'@'localhost';"
    mysql -e "FLUSH PRIVILEGES;"
    
    if [ -f "/app/yuncang.sql" ]; then
        echo "Importing yuncang.sql..."
        mysql -u root $DB_NAME < /app/yuncang.sql
    fi
    echo "Database initialization completed."
else
    echo "Database already exists, skipping initialization."
fi

# 启动后端服务
echo "Starting Backend Service..."
cd /app/server
node dist/index.js &

# 启动 Nginx
echo "Starting Nginx..."
nginx -g "daemon off;"
