#!/bin/bash

echo "🔧 配置物业管理系统"

# 获取MySQL密码
read -s -p "请输入MySQL root密码: " password
echo

# 创建数据库
mysql -u root -p"$password" < database/schema.sql

# 配置环境变量
cd backend
cp .env.example .env
sed -i '' "s/your_password/$password/g" .env

echo "✅ 配置完成！"
echo "运行 ./start.sh 启动系统"
