#!/bin/bash

# 物业管理系统高级收费功能修复启动脚本
# 用于修复房产类型收费标准"加载失败"和点击无反应问题

echo "🔧 物业管理系统 - 高级收费功能修复"
echo "================================================"

# 检查当前目录
if [ ! -f "app.js" ]; then
    echo "❌ 错误：请在 property-system/backend 目录下运行此脚本"
    exit 1
fi

echo "1️⃣ 检查数据库连接..."

# 检查MySQL是否运行
if ! command -v mysql &> /dev/null; then
    echo "⚠️  MySQL未安装或未在PATH中，将使用模拟数据库"
else
    echo "✅ MySQL已安装"
fi

echo "2️⃣ 安装依赖包..."
npm install --silent

echo "3️⃣ 初始化高级收费数据表..."
if command -v mysql &> /dev/null && [ -f "../.env" ]; then
    # 如果有真实的MySQL，执行数据库迁移
    echo "📊 执行数据库迁移..."
    mysql -h localhost -u root -p$(grep DB_PASSWORD ../.env | cut -d '=' -f2) property_management < migrations/create_advanced_fee_tables.sql 2>/dev/null || echo "⚠️  使用模拟数据库模式"
else
    echo "🧪 使用模拟数据库模式"
fi

echo "4️⃣ 启动服务器..."
echo "🚀 服务器将在 http://localhost:3000 运行"
echo "🌐 前端界面: http://localhost:3000"
echo ""
echo "📋 修复内容："
echo "   ✅ 修复了SQLite语法导致的数据库查询错误"
echo "   ✅ 修复了房产类型收费标准加载失败问题"
echo "   ✅ 修复了收费标准编辑按钮无反应问题"
echo "   ✅ 更新了数据库表结构匹配"
echo ""
echo "💡 测试方法："
echo "   1. 打开浏览器访问 http://localhost:3000"
echo "   2. 点击 '高级收费' 标签页"
echo "   3. 查看 '房产类型收费标准' 部分是否正常显示"
echo "   4. 点击 '编辑' 按钮测试功能是否正常"
echo ""
echo "按 Ctrl+C 停止服务器"
echo "================================================"

# 启动服务器
node app.js