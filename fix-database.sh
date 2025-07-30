#!/bin/bash

echo "🔧 修复数据库连接问题"
echo "================================"

# 进入后端目录  
cd "$(dirname "$0")/backend" || exit 1

echo "1️⃣ 检查当前数据库配置..."

# 显示当前配置
if [ -f ".env" ]; then
    echo "📋 当前 .env 配置:"
    grep -E "^DB_|NODE_ENV|USE_MOCK_DB" .env || echo "  (未找到数据库配置)"
    echo ""
fi

echo "2️⃣ 应用 macOS 专用配置..."

# 创建或更新 .env 文件
cat > .env << 'EOF'
# macOS 本地开发环境配置
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=property_management
PORT=3000
NODE_ENV=development

# 强制使用真实数据库（而非mock）
USE_MOCK_DB=false
EOF

echo "✅ 已应用新的数据库配置"

echo ""
echo "3️⃣ 测试数据库连接..."

# 测试连接
if [ -f "test-mysql.js" ]; then
    node test-mysql.js
    connection_status=$?
else
    echo "⚠️  未找到数据库测试文件，创建测试..."
    cat > test-connection.js << 'EOF'
const mysql = require('mysql2/promise');

async function testConnection() {
  try {
    const connection = await mysql.createConnection({
      host: '127.0.0.1',
      port: 3306,
      user: 'root',
      password: '',
      database: 'property_management'
    });
    
    console.log('✅ 数据库连接成功');
    await connection.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ 数据库连接失败:', error.message);
    console.log('');
    console.log('📝 可能的解决方案:');
    console.log('1. 确保 MySQL 服务正在运行');
    console.log('2. 检查数据库 property_management 是否存在');
    console.log('3. 检查 MySQL root 用户权限');
    console.log('4. 如果密码不为空，请修改 .env 文件中的 DB_PASSWORD');
    process.exit(1);
  }
}

testConnection();
EOF
    node test-connection.js
    connection_status=$?
fi

if [ $connection_status -eq 0 ]; then
    echo ""
    echo "🎉 数据库配置修复完成!"
    echo ""
    echo "📍 接下来你可以:"
    echo "  1. 运行 ./start-macos.sh 启动系统"
    echo "  2. 访问 frontend/index.html 使用系统"
    echo ""
else
    echo ""
    echo "❌ 数据库连接仍有问题"
    echo ""
    echo "🔍 请检查:"
    echo "  1. MySQL 是否正在运行: mysqladmin ping -h localhost"
    echo "  2. 数据库是否存在: mysql -u root -e 'SHOW DATABASES;'"
    echo "  3. 创建数据库: mysql -u root -e 'CREATE DATABASE IF NOT EXISTS property_management;'"
    echo ""
fi