#!/bin/bash

# macOS MySQL 路径检测和修复脚本

echo "🔍 检测 macOS 上的 MySQL 安装..."
echo "================================"

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
MYSQL_PATH=""

# 检查各个可能的路径
for path in "${MYSQL_PATHS[@]}"; do
    if [ -f "$path/mysql" ]; then
        echo "✅ 找到 MySQL: $path/mysql"
        MYSQL_FOUND="yes"
        MYSQL_PATH="$path"
        
        # 检查版本
        VERSION=$("$path/mysql" --version 2>/dev/null || echo "未知版本")
        echo "   版本: $VERSION"
        break
    fi
done

if [ -z "$MYSQL_FOUND" ]; then
    echo "❌ 未找到 MySQL 安装"
    echo ""
    echo "📦 安装建议:"
    echo "1. 使用 Homebrew 安装:"
    echo "   brew install mysql"
    echo ""
    echo "2. 从官网下载安装:"
    echo "   https://dev.mysql.com/downloads/mysql/"
    echo ""
    echo "3. 使用 XAMPP/MAMP (包含 MySQL):"
    echo "   https://www.apachefriends.org/download.html"
    exit 1
fi

echo ""
echo "🔧 配置 PATH 环境变量..."

# 检查当前 shell
CURRENT_SHELL=$(echo $SHELL)
echo "当前 Shell: $CURRENT_SHELL"

# 确定配置文件
if [[ "$CURRENT_SHELL" == *"zsh"* ]]; then
    PROFILE_FILE="$HOME/.zshrc"
    echo "使用配置文件: ~/.zshrc"
elif [[ "$CURRENT_SHELL" == *"bash"* ]]; then
    PROFILE_FILE="$HOME/.bash_profile"
    echo "使用配置文件: ~/.bash_profile"
else
    PROFILE_FILE="$HOME/.profile"
    echo "使用配置文件: ~/.profile"
fi

# 检查 PATH 是否已包含 MySQL
if echo $PATH | grep -q "$MYSQL_PATH"; then
    echo "✅ MySQL 路径已在 PATH 中"
else
    echo "📝 添加 MySQL 到 PATH..."
    
    # 备份原配置文件
    if [ -f "$PROFILE_FILE" ]; then
        cp "$PROFILE_FILE" "${PROFILE_FILE}.backup.$(date +%Y%m%d_%H%M%S)"
        echo "   已备份原配置文件"
    fi
    
    # 添加 MySQL 路径到配置文件
    echo "" >> "$PROFILE_FILE"
    echo "# MySQL PATH (auto-added by setup script)" >> "$PROFILE_FILE"
    echo "export PATH=\"$MYSQL_PATH:\$PATH\"" >> "$PROFILE_FILE"
    
    echo "✅ 已添加 MySQL 路径到 $PROFILE_FILE"
fi

echo ""
echo "🔄 重新加载环境变量..."

# 重新加载配置文件
source "$PROFILE_FILE" 2>/dev/null || true

# 测试 MySQL 命令
if command -v mysql &> /dev/null; then
    echo "✅ MySQL 命令现在可用!"
    echo "   版本: $(mysql --version)"
else
    echo "⚠️  需要重新启动终端或运行以下命令:"
    echo "   source $PROFILE_FILE"
fi

echo ""
echo "🔗 测试 MySQL 服务..."

# 检查 MySQL 服务是否运行
if mysqladmin ping -h localhost --silent 2>/dev/null; then
    echo "✅ MySQL 服务运行中"
elif [ -f "/usr/local/mysql/support-files/mysql.server" ]; then
    echo "⚠️  MySQL 服务未运行，尝试启动..."
    sudo /usr/local/mysql/support-files/mysql.server start
    sleep 3
    if mysqladmin ping -h localhost --silent 2>/dev/null; then
        echo "✅ MySQL 服务启动成功"
    else
        echo "❌ MySQL 服务启动失败"
    fi
elif command -v brew &> /dev/null; then
    echo "⚠️  MySQL 服务未运行，尝试通过 Homebrew 启动..."
    brew services start mysql 2>/dev/null || echo "   Homebrew MySQL 服务启动失败"
else
    echo "❌ MySQL 服务未运行"
    echo "📝 手动启动方法:"
    echo "   1. 系统偏好设置 → MySQL → Start MySQL Server"
    echo "   2. 或运行: sudo /usr/local/mysql/support-files/mysql.server start"
fi

echo ""
echo "✨ 配置完成!"
echo "================================"
echo ""
echo "📋 下一步:"
echo "1. 重新启动终端 (或运行: source $PROFILE_FILE)"
echo "2. 验证安装: mysql --version"
echo "3. 运行部署脚本: ./setup-macos.sh"