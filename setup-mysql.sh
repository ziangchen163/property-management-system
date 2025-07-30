#!/bin/bash

echo "🔧 MySQL物业管理系统配置脚本"
echo "================================"

# 检查MySQL是否已安装
if ! command -v mysql &> /dev/null; then
    echo "❌ MySQL 未安装"
    echo "请先安装MySQL: https://dev.mysql.com/downloads/mysql/"
    exit 1
fi

echo "✅ MySQL 已安装"

# 获取MySQL root密码
echo ""
read -s -p "请输入MySQL root密码: " mysql_password
echo ""

# 测试MySQL连接
echo "🔗 测试MySQL连接..."
mysql -u root -p"$mysql_password" -e "SELECT VERSION();" 2>/dev/null
if [ $? -ne 0 ]; then
    echo "❌ MySQL连接失败，请检查密码"
    exit 1
fi

echo "✅ MySQL连接成功"

# 创建数据库和导入结构
echo "📊 创建数据库和表结构..."
mysql -u root -p"$mysql_password" < database/mysql_schema.sql
if [ $? -eq 0 ]; then
    echo "✅ 数据库创建成功"
else
    echo "❌ 数据库创建失败"
    exit 1
fi

# 创建环境变量文件
echo "⚙️ 配置环境变量..."
cp .env.example .env
sed -i "s/your_mysql_password/$mysql_password/g" .env

echo "✅ 环境变量配置完成"

echo ""
echo "🎉 MySQL配置完成！"
echo "================================"
echo "数据库名称: property_management"
echo "用户名: root"
echo "密码: [已设置]"
echo ""
echo "📋 下一步:"
echo "1. npm start    # 启动服务器"
echo "2. 访问 http://localhost:3000"
echo "================================"