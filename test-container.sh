#!/bin/bash

echo "🧪 物业管理系统 - 容器环境测试"
echo "================================"

cd /workspace/property-system/backend

# 检查端口
echo "📡 检查端口状态..."
if ! command -v netstat &> /dev/null; then
    echo "⚠️  netstat 未安装，跳过端口检查"
else
    netstat -tulpn | grep :3000 || echo "   3000端口未被占用"
fi

# 设置测试环境变量
export NODE_ENV=test
export USE_MOCK_DB=true

echo ""
echo "🔧 环境配置:"
echo "   NODE_ENV: $NODE_ENV"
echo "   USE_MOCK_DB: $USE_MOCK_DB"
echo "   工作目录: $(pwd)"

echo ""
echo "📦 检查依赖..."
if [ ! -d "node_modules" ]; then
    echo "   安装依赖包..."
    npm install
else
    echo "   ✅ 依赖已安装"
fi

echo ""
echo "🧪 测试数据库连接..."
node test-mysql.js

echo ""
echo "🚀 启动应用（测试模式）..."
echo "   使用模拟数据库，无需MySQL"
echo "   按 Ctrl+C 停止服务器"
echo "================================"

# 启动应用
node app.js