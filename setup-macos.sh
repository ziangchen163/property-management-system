#!/bin/bash

# macOS 物业管理系统本地部署脚本
# 适用于 macOS 15.5 系统

set -e  # 遇到错误立即退出

echo "🍎 macOS 物业管理系统本地部署"
echo "================================"

# 检查系统要求
echo "1️⃣ 检查系统环境..."

# 检查 Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js 未安装"
    echo "请访问 https://nodejs.org 下载安装 Node.js 18+"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 14 ]; then
    echo "❌ Node.js 版本过低，当前: $(node -v)，需要: 14+"
    exit 1
fi
echo "✅ Node.js: $(node -v)"

# 检查 npm
if ! command -v npm &> /dev/null; then
    echo "❌ npm 未安装"
    exit 1
fi
echo "✅ npm: $(npm -v)"

# 检查 MySQL
if ! command -v mysql &> /dev/null; then
    echo "❌ MySQL 未在 PATH 中，尝试自动修复..."
    
    # 常见的 MySQL 安装路径
    MYSQL_PATHS=(
        "/usr/local/mysql/bin"
        "/opt/homebrew/bin"
        "/usr/local/bin"
        "/opt/local/bin"
        "/Applications/XAMPP/xamppfiles/bin"
        "/Applications/MAMP/Library/bin"
    )
    
    MYSQL_FOUND=""
    
    # 检查各个可能的路径
    for path in "${MYSQL_PATHS[@]}"; do
        if [ -f "$path/mysql" ]; then
            echo "🔍 找到 MySQL: $path/mysql"
            export PATH="$path:$PATH"
            MYSQL_FOUND="yes"
            break
        fi
    done
    
    if [ -z "$MYSQL_FOUND" ]; then
        echo "❌ 未找到 MySQL 安装"
        echo ""
        echo "📦 请先安装 MySQL:"
        echo "   方式1: brew install mysql"
        echo "   方式2: https://dev.mysql.com/downloads/mysql/"
        echo ""
        echo "💡 或运行修复脚本: ./fix-mysql-path.sh"
        exit 1
    fi
    
    if ! command -v mysql &> /dev/null; then
        echo "❌ MySQL 路径修复失败"
        echo "💡 请运行: ./fix-mysql-path.sh"
        exit 1
    fi
fi
echo "✅ MySQL: $(mysql --version)"

# 检查 MySQL 服务是否运行
if ! mysqladmin ping -h localhost --silent 2>/dev/null; then
    echo "⚠️  MySQL 服务未运行，尝试启动..."
    
    # macOS 上常见的 MySQL 启动方式
    if [ -f "/usr/local/mysql/support-files/mysql.server" ]; then
        sudo /usr/local/mysql/support-files/mysql.server start
    elif command -v brew &> /dev/null && brew services list | grep mysql &> /dev/null; then
        brew services start mysql
    else
        echo "❌ 无法自动启动 MySQL，请手动启动"
        echo "可尝试："
        echo "  - 系统偏好设置 → MySQL → Start MySQL Server"
        echo "  - 或运行: sudo /usr/local/mysql/support-files/mysql.server start"
        exit 1
    fi
    
    # 等待 MySQL 启动
    sleep 3
    if ! mysqladmin ping -h localhost --silent 2>/dev/null; then
        echo "❌ MySQL 启动失败"
        exit 1
    fi
fi
echo "✅ MySQL 服务运行中"

echo ""
echo "2️⃣ 获取 MySQL 配置..."

# 获取 MySQL root 密码
echo -n "请输入 MySQL root 密码 (如果没有设置过密码，直接按回车): "
read -s MYSQL_PASSWORD
echo ""

# 测试 MySQL 连接
if [ -z "$MYSQL_PASSWORD" ]; then
    MYSQL_CMD="mysql -u root"
else
    MYSQL_CMD="mysql -u root -p$MYSQL_PASSWORD"
fi

if ! $MYSQL_CMD -e "SELECT 1;" &> /dev/null; then
    echo "❌ MySQL 连接失败，请检查密码"
    exit 1
fi
echo "✅ MySQL 连接成功"

echo ""
echo "3️⃣ 安装项目依赖..."

# 进入后端目录
cd backend

# 检查 package.json 是否存在
if [ ! -f "package.json" ]; then
    echo "❌ package.json 不存在"
    exit 1
fi

# 安装依赖
echo "正在安装 Node.js 依赖..."
npm install

if [ $? -ne 0 ]; then
    echo "❌ 依赖安装失败"
    exit 1
fi
echo "✅ 依赖安装完成"

echo ""
echo "4️⃣ 配置数据库..."

# 创建数据库
echo "正在创建数据库..."
if [ -z "$MYSQL_PASSWORD" ]; then
    mysql -u root -e "CREATE DATABASE IF NOT EXISTS property_management CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
else
    mysql -u root -p"$MYSQL_PASSWORD" -e "CREATE DATABASE IF NOT EXISTS property_management CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
fi

if [ $? -ne 0 ]; then
    echo "❌ 数据库创建失败"
    exit 1
fi
echo "✅ 数据库创建成功"

echo ""
echo "5️⃣ 配置环境变量..."

# 创建 .env 文件
if [ ! -f ".env.example" ]; then
    echo "❌ .env.example 文件不存在"
    exit 1
fi

# 复制并配置 .env
cp .env.example .env

# 设置数据库密码
if [ -z "$MYSQL_PASSWORD" ]; then
    sed -i '' 's/DB_PASSWORD=your_mysql_password/DB_PASSWORD=/' .env
else
    sed -i '' "s/DB_PASSWORD=your_mysql_password/DB_PASSWORD=$MYSQL_PASSWORD/" .env
fi

echo "✅ 环境变量配置完成"

echo ""
echo "6️⃣ 测试数据库连接..."

# 测试数据库连接
node test-mysql.js

if [ $? -ne 0 ]; then
    echo "❌ 数据库连接测试失败"
    exit 1
fi

echo ""
echo "🎉 部署完成！"
echo "================================"
echo ""
echo "📋 启动说明："
echo "1. 启动后端服务: npm start"
echo "2. 访问 API: http://localhost:3000"
echo "3. 查看前端: 打开 ../frontend/index.html"
echo ""
echo "📝 其他命令："
echo "- 开发模式: npm run dev"
echo "- 测试连接: node test-mysql.js"
echo ""
echo "🔧 如需修改配置，请编辑 .env 文件"

# 返回项目根目录创建启动脚本
cd ..

# 创建启动脚本
cat > start-macos.sh << 'EOF'
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

if [ ! -f ".env" ]; then
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
EOF

chmod +x start-macos.sh

echo ""
echo "✨ 已创建 start-macos.sh 启动脚本"
echo "运行 ./start-macos.sh 即可启动系统"