#!/bin/bash

echo "🚀 启动物业管理系统"
echo "================================"

# 检查当前目录
if [ ! -d "backend" ]; then
    echo "❌ 未找到 backend 目录"
    echo "请确保在 property-system 根目录下运行此脚本"
    exit 1
fi

# 检查 MySQL 服务
echo "1️⃣ 检查 MySQL 服务..."

# 尝试添加常见的 MySQL 路径
if ! command -v mysql &> /dev/null; then
    echo "🔍 MySQL 不在 PATH 中，尝试添加..."
    
    MYSQL_PATHS=(
        "/usr/local/mysql/bin"
        "/opt/homebrew/bin"
        "/usr/local/bin"
        "/opt/local/bin"
    )
    
    for path in "${MYSQL_PATHS[@]}"; do
        if [ -f "$path/mysql" ]; then
            export PATH="$path:$PATH"
            echo "✅ 已添加 MySQL 路径: $path"
            break
        fi
    done
fi

if ! command -v mysql &> /dev/null; then
    echo "❌ MySQL 未找到，请运行: ./fix-mysql-path.sh"
    exit 1
fi

if ! mysqladmin ping -h localhost --silent 2>/dev/null; then
    echo "⚠️  MySQL 服务未运行，尝试启动..."
    
    # 尝试不同的启动方式
    if [ -f "/usr/local/mysql/support-files/mysql.server" ]; then
        sudo /usr/local/mysql/support-files/mysql.server start
    elif command -v brew &> /dev/null; then
        brew services start mysql 2>/dev/null
    else
        echo "❌ 无法自动启动 MySQL"
        echo "请手动启动 MySQL 服务："
        echo "  - 系统偏好设置 → MySQL → Start MySQL Server"
        echo "  - 或运行: sudo /usr/local/mysql/support-files/mysql.server start"
        exit 1
    fi
    
    # 等待启动
    sleep 3
    if ! mysqladmin ping -h localhost --silent 2>/dev/null; then
        echo "❌ MySQL 启动失败"
        exit 1
    fi
fi

echo "✅ MySQL 服务运行中"

# 检查环境配置
echo ""
echo "2️⃣ 检查项目配置..."

cd backend

# 使用 macOS 专用配置
if [ -f ".env.macos" ]; then
    echo "📋 使用 macOS 专用配置文件"
    cp .env.macos .env
elif [ ! -f ".env" ]; then
    echo "❌ 未找到 .env 配置文件"
    echo "请先运行: ./setup-macos.sh"
    exit 1
fi

if [ ! -f "package.json" ]; then
    echo "❌ 未找到 package.json"
    exit 1
fi

if [ ! -d "node_modules" ]; then
    echo "⚠️  未找到 node_modules，正在安装依赖..."
    npm install
    if [ $? -ne 0 ]; then
        echo "❌ 依赖安装失败"
        exit 1
    fi
fi

echo "✅ 项目配置正常"

# 测试数据库连接
echo ""
echo "3️⃣ 测试数据库连接..."

node test-mysql.js
if [ $? -ne 0 ]; then
    echo "❌ 数据库连接失败"
    echo "请检查 .env 文件中的数据库配置"
    exit 1
fi

# 启动服务器
echo ""
echo "4️⃣ 启动后端服务..."
echo "================================"
echo ""
echo "📍 服务地址:"
echo "   - API 服务: http://localhost:3000"
echo "   - 健康检查: http://localhost:3000/health"
echo "   - 前端页面: ../frontend/index.html"
echo ""
echo "🛑 按 Ctrl+C 停止服务"
echo ""

# 启动 Node.js 服务
npm start