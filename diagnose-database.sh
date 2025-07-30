#!/bin/bash

echo "🔍 本地数据库问题诊断脚本"
echo "================================"
echo "这个脚本会帮你诊断数据库问题"
echo ""

# 基本信息收集
echo "📋 第1步：收集系统信息"
echo "操作系统：$(uname -s)"
echo "当前用户：$(whoami)"
echo "当前目录：$(pwd)"
echo ""

# MySQL服务检查
echo "📋 第2步：检查MySQL服务状态"
if command -v mysqladmin >/dev/null 2>&1; then
    if mysqladmin ping -h localhost --silent 2>/dev/null; then
        echo "✅ MySQL服务正在运行"
    else
        echo "❌ MySQL服务未运行或无法连接"
        echo "💡 请尝试启动MySQL："
        echo "   - macOS: brew services start mysql"
        echo "   - 或通过系统偏好设置启动MySQL"
        exit 1
    fi
else
    echo "❌ 未找到mysql命令"
    echo "💡 请确保MySQL已安装并添加到PATH"
    exit 1
fi
echo ""

# 数据库连接测试
echo "📋 第3步：测试数据库连接"
echo "正在测试root用户连接..."

if mysql -u root -h 127.0.0.1 -e "SELECT 'Connection OK' as status;" 2>/dev/null; then
    echo "✅ root用户连接成功（无密码）"
    DB_PASSWORD=""
elif mysql -u root -h 127.0.0.1 -p -e "SELECT 'Connection OK' as status;" 2>/dev/null; then
    echo "⚠️  root用户需要密码"
    echo "请输入MySQL root密码，或按Ctrl+C退出后运行："
    echo "mysql -u root -p"
    echo "然后执行：ALTER USER 'root'@'localhost' IDENTIFIED BY '';"
    read -s -p "MySQL root密码: " DB_PASSWORD
    echo ""
else
    echo "❌ 无法连接到MySQL"
    exit 1
fi
echo ""

# 检查数据库
echo "📋 第4步：检查property_management数据库"
DB_EXISTS=$(mysql -u root -h 127.0.0.1 ${DB_PASSWORD:+-p$DB_PASSWORD} -e "SHOW DATABASES LIKE 'property_management';" 2>/dev/null | wc -l)

if [ "$DB_EXISTS" -eq 0 ]; then
    echo "❌ 数据库property_management不存在"
    echo "正在创建数据库..."
    mysql -u root -h 127.0.0.1 ${DB_PASSWORD:+-p$DB_PASSWORD} -e "CREATE DATABASE IF NOT EXISTS property_management CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;" 2>/dev/null
    if [ $? -eq 0 ]; then
        echo "✅ 数据库创建成功"
    else
        echo "❌ 数据库创建失败"
        exit 1
    fi
else
    echo "✅ 数据库property_management存在"
fi
echo ""

# 检查表结构
echo "📋 第5步：检查关键表"
TABLES=("communities" "owners" "properties" "parking_spaces")

for table in "${TABLES[@]}"; do
    TABLE_EXISTS=$(mysql -u root -h 127.0.0.1 ${DB_PASSWORD:+-p$DB_PASSWORD} property_management -e "SHOW TABLES LIKE '$table';" 2>/dev/null | wc -l)
    if [ "$TABLE_EXISTS" -eq 0 ]; then
        echo "❌ 表 $table 不存在"
        MISSING_TABLES=1
    else
        echo "✅ 表 $table 存在"
        # 显示记录数
        COUNT=$(mysql -u root -h 127.0.0.1 ${DB_PASSWORD:+-p$DB_PASSWORD} property_management -e "SELECT COUNT(*) FROM $table;" 2>/dev/null | tail -n 1)
        echo "   📊 记录数: $COUNT"
    fi
done
echo ""

# 如果表缺失，提供重建脚本
if [ "$MISSING_TABLES" = "1" ]; then
    echo "⚠️  发现缺失的表，创建重建脚本..."
    
    cat > recreate_tables.sql << 'EOF'
-- 重建数据库表结构
USE property_management;

-- 创建小区表
CREATE TABLE IF NOT EXISTS communities (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    address TEXT,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 创建业主表
CREATE TABLE IF NOT EXISTS owners (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(20) UNIQUE,
    id_card VARCHAR(18) UNIQUE,
    company VARCHAR(255),
    position VARCHAR(100),
    hobby TEXT,
    remark TEXT,
    photo_url VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 创建房产表
CREATE TABLE IF NOT EXISTS properties (
    id INT AUTO_INCREMENT PRIMARY KEY,
    community_id INT,
    property_type VARCHAR(50) NOT NULL DEFAULT '普通住宅',
    building VARCHAR(20) NOT NULL,
    unit VARCHAR(10) NOT NULL,
    room VARCHAR(20) NOT NULL,
    area DECIMAL(8,2) NOT NULL,
    is_delivered TINYINT(1) DEFAULT 0,
    is_decorated TINYINT(1) DEFAULT 0,
    occupancy_status VARCHAR(20) DEFAULT '空关',
    is_for_rent TINYINT(1) DEFAULT 0,
    rental_status VARCHAR(20) DEFAULT 'available',
    rental_price DECIMAL(10,2) DEFAULT 0,
    handover_date DATE,
    owner_id INT,
    photos TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_community_id (community_id),
    INDEX idx_owner_id (owner_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 创建车位表
CREATE TABLE IF NOT EXISTS parking_spaces (
    id INT AUTO_INCREMENT PRIMARY KEY,
    community_id INT,
    space_number VARCHAR(50) NOT NULL,
    type VARCHAR(20) NOT NULL DEFAULT '地下',
    status VARCHAR(20) DEFAULT '自用',
    rental_status VARCHAR(20) DEFAULT 'available',
    rental_price DECIMAL(10,2) DEFAULT 0,
    location_description TEXT,
    owner_id INT,
    photos TEXT,
    is_active TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_community_id (community_id),
    INDEX idx_owner_id (owner_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 插入基础数据
INSERT IGNORE INTO communities (name, address, description) VALUES 
('示例小区A', '北京市朝阳区示例路100号', '示例小区A描述'),
('示例小区B', '北京市海淀区示例大街200号', '示例小区B描述');

INSERT IGNORE INTO owners (name, phone, id_card, company) VALUES 
('张三', '13800138000', '110101199001011234', '示例公司A'),
('李四', '13800138001', '110101199001011235', '示例公司B');

INSERT IGNORE INTO properties (community_id, building, unit, room, area, property_type, owner_id) VALUES 
(1, 'A栋', '1单元', '101', 88.5, '普通住宅', 1),
(1, 'A栋', '1单元', '102', 95.2, '普通住宅', 2),
(2, 'B栋', '2单元', '201', 76.8, '普通住宅', 1);

INSERT IGNORE INTO parking_spaces (community_id, space_number, type, owner_id) VALUES 
(1, 'B1-001', '地下', 1),
(1, 'B1-002', '地下', 2),
(2, 'B2-001', '地上', 1);
EOF

    echo "📄 已创建 recreate_tables.sql 文件"
    echo "💡 请运行以下命令重建表："
    echo "   mysql -u root -h 127.0.0.1 ${DB_PASSWORD:+-p} < recreate_tables.sql"
    echo ""
fi

# 检查properties表的具体问题
echo "📋 第6步：诊断properties表的具体问题"
if mysql -u root -h 127.0.0.1 ${DB_PASSWORD:+-p$DB_PASSWORD} property_management -e "DESCRIBE properties;" >/dev/null 2>&1; then
    echo "🔍 检查properties表结构..."
    mysql -u root -h 127.0.0.1 ${DB_PASSWORD:+-p$DB_PASSWORD} property_management -e "
        SELECT 
            COLUMN_NAME, 
            DATA_TYPE, 
            IS_NULLABLE, 
            COLUMN_DEFAULT
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = 'property_management' 
        AND TABLE_NAME = 'properties' 
        AND COLUMN_NAME IN ('id', 'community_id', 'owner_id');"
    
    echo ""
    echo "🔍 检查properties表中的数据问题..."
    mysql -u root -h 127.0.0.1 ${DB_PASSWORD:+-p$DB_PASSWORD} property_management -e "
        SELECT 
            COUNT(*) as total_records,
            COUNT(CASE WHEN id IS NULL THEN 1 END) as null_ids,
            COUNT(CASE WHEN community_id IS NULL THEN 1 END) as null_community_ids,
            COUNT(CASE WHEN owner_id IS NULL THEN 1 END) as null_owner_ids,
            MIN(id) as min_id,
            MAX(id) as max_id
        FROM properties;"
else
    echo "❌ 无法访问properties表"
fi
echo ""

# 创建环境配置
echo "📋 第7步：更新环境配置"
cd backend 2>/dev/null || cd . 

cat > .env << EOF
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=${DB_PASSWORD}
DB_NAME=property_management
PORT=3000
NODE_ENV=development
USE_MOCK_DB=false
EOF

echo "✅ 已更新 .env 配置文件"
echo ""

# 生成诊断报告
echo "📋 第8步：生成诊断报告"
REPORT_FILE="database_diagnosis_$(date +%Y%m%d_%H%M%S).txt"

cat > "$REPORT_FILE" << EOL
数据库诊断报告
生成时间: $(date)
操作系统: $(uname -s)
MySQL版本: $(mysql --version 2>/dev/null || echo "未知")

连接信息:
- 主机: 127.0.0.1
- 端口: 3306  
- 用户: root
- 密码: ${DB_PASSWORD:+已设置}${DB_PASSWORD:-无}

数据库状态:
- property_management数据库: $([ "$DB_EXISTS" -gt 0 ] && echo "存在" || echo "不存在")

表状态:
EOL

for table in "${TABLES[@]}"; do
    TABLE_EXISTS=$(mysql -u root -h 127.0.0.1 ${DB_PASSWORD:+-p$DB_PASSWORD} property_management -e "SHOW TABLES LIKE '$table';" 2>/dev/null | wc -l)
    COUNT=$(mysql -u root -h 127.0.0.1 ${DB_PASSWORD:+-p$DB_PASSWORD} property_management -e "SELECT COUNT(*) FROM $table;" 2>/dev/null | tail -n 1)
    echo "- $table: $([ "$TABLE_EXISTS" -gt 0 ] && echo "存在($COUNT条记录)" || echo "不存在")" >> "$REPORT_FILE"
done

echo ""
echo "📄 诊断报告已保存到: $REPORT_FILE"
echo ""
echo "🎯 接下来的建议："
echo "1. 如果有表缺失，运行: mysql -u root -h 127.0.0.1 ${DB_PASSWORD:+-p} < recreate_tables.sql"
echo "2. 启动系统: ./start-macos.sh"
echo "3. 测试上传照片功能（确保先选择要编辑的房产）"
echo "4. 如果仍有问题，请将诊断报告发送给开发者"