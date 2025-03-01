#!/bin/bash

# 创建数据库
mysql -u yuncang -p'NeGAj5awAn7bfWit' -e "CREATE DATABASE IF NOT EXISTS yuncang;"

# 使用数据库并执行 schema.sql
mysql -u yuncang -p'NeGAj5awAn7bfWit' yuncang < schema.sql 