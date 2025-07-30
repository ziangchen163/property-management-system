#!/bin/bash

echo "🚀 启动物业管理系统"

# 检查MySQL
if ! command -v mysql &> /dev/null; then
    echo "❌ MySQL 未安装"
    exit 1
fi

# 检查Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js 未安装"
    exit 1
fi

# 启动MySQL服务
echo "启动MySQL服务..."
brew services start mysql

# 进入后端目录
cd backend

# 检查依赖
if [[ ! -d "node_modules" ]]; then
    echo "安装依赖..."
    npm install
fi

# 检查环境变量
if [[ ! -f ".env" ]]; then
    echo "请先配置 .env 文件"
    echo "复制 .env.example 为 .env 并设置数据库密码"
    exit 1
fi

# 启动服务器
echo "启动服务器..."
npm start
