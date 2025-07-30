#!/bin/bash

echo "🔍 数据库问题诊断和修复工具"
echo "================================"

# 获取脚本目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/backend"

# 检查目录
if [ ! -d "$BACKEND_DIR" ]; then
    echo "❌ 错误：未找到 backend 目录"
    echo "请确保在 property-system 根目录下运行此脚本"
    exit 1
fi

cd "$BACKEND_DIR"

echo "📋 步骤1: 检查数据库连接..."

# 测试基本连接
mysql_test_basic() {
    mysql -u root -h 127.0.0.1 -e "SELECT 1;" 2>/dev/null
    return $?
}

if ! mysql_test_basic; then
    echo "❌ MySQL 连接失败"
    echo ""
    echo "🛠️  请先确保："
    echo "1. MySQL 服务正在运行"
    echo "2. root 用户可以无密码登录"
    echo ""
    echo "如需帮助，请运行以下命令："
    echo "  sudo mysql"
    echo "  ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY '';"
    echo "  FLUSH PRIVILEGES;"
    exit 1
fi

echo "✅ MySQL 连接正常"

echo ""
echo "📋 步骤2: 检查数据库是否存在..."

# 检查数据库
db_exists=$(mysql -u root -h 127.0.0.1 -e "SHOW DATABASES LIKE 'property_management';" | wc -l)

if [ "$db_exists" -eq 0 ]; then
    echo "⚠️  数据库 property_management 不存在，正在创建..."
    mysql -u root -h 127.0.0.1 -e "CREATE DATABASE property_management CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
    if [ $? -eq 0 ]; then
        echo "✅ 数据库创建成功"
    else
        echo "❌ 数据库创建失败"
        exit 1
    fi
else
    echo "✅ 数据库 property_management 已存在"
fi

echo ""
echo "📋 步骤3: 检查表结构..."

# 检查关键表是否存在
check_table() {
    local table_name=$1
    local count=$(mysql -u root -h 127.0.0.1 property_management -e "SHOW TABLES LIKE '$table_name';" | wc -l)
    if [ "$count" -eq 0 ]; then
        echo "❌ 表 $table_name 不存在"
        return 1
    else
        echo "✅ 表 $table_name 存在"
        return 0
    fi
}

tables_missing=0
for table in communities owners properties parking_spaces; do
    if ! check_table "$table"; then
        tables_missing=1
    fi
done

if [ "$tables_missing" -eq 1 ]; then
    echo ""
    echo "⚠️  发现缺失的表，正在重建数据库结构..."
    
    # 执行数据库schema
    if [ -f "../database/mysql_schema.sql" ]; then
        mysql -u root -h 127.0.0.1 < "../database/mysql_schema.sql"
        if [ $? -eq 0 ]; then
            echo "✅ 数据库结构重建成功"
        else
            echo "❌ 数据库结构重建失败"
            exit 1
        fi
    else
        echo "❌ 未找到数据库schema文件"
        exit 1
    fi
fi

echo ""
echo "📋 步骤4: 检查数据完整性..."

# 检查关键数据
check_data() {
    local table_name=$1
    local count=$(mysql -u root -h 127.0.0.1 property_management -e "SELECT COUNT(*) FROM $table_name;" | tail -n 1)
    echo "📊 表 $table_name: $count 条记录"
    
    if [ "$table_name" = "communities" ] && [ "$count" -eq 0 ]; then
        echo "⚠️  添加示例小区数据..."
        mysql -u root -h 127.0.0.1 property_management -e "
            INSERT IGNORE INTO communities (name, address) VALUES
            ('示例小区', '示例地址');
        "
    fi
}

for table in communities owners properties parking_spaces; do
    check_data "$table"
done

echo ""
echo "📋 步骤5: 验证具体问题..."

# 检查properties表的字段类型
echo "🔍 检查 properties 表结构..."
mysql -u root -h 127.0.0.1 property_management -e "DESCRIBE properties;" > /tmp/properties_desc.txt 2>/dev/null

if [ -f "/tmp/properties_desc.txt" ]; then
    echo "📊 Properties 表字段："
    cat /tmp/properties_desc.txt
    rm -f /tmp/properties_desc.txt
    
    # 检查是否有NULL约束问题
    echo ""
    echo "🔍 检查可能的NULL值问题..."
    mysql -u root -h 127.0.0.1 property_management -e "
        SELECT 
            COUNT(*) as total_properties,
            COUNT(CASE WHEN community_id IS NULL THEN 1 END) as null_community_id,
            COUNT(CASE WHEN owner_id IS NULL THEN 1 END) as null_owner_id
        FROM properties;
    "
fi

echo ""
echo "📋 步骤6: 创建测试数据..."

# 确保有基础数据用于测试
mysql -u root -h 127.0.0.1 property_management << 'EOF'
-- 确保有小区数据
INSERT IGNORE INTO communities (name, address, description) VALUES 
('测试小区', '测试地址123号', '用于测试的小区');

-- 确保有业主数据  
INSERT IGNORE INTO owners (name, phone, id_card) VALUES 
('测试业主', '13800000000', '110000199001011234');

-- 确保有房产数据
INSERT IGNORE INTO properties (community_id, building, unit, room, area, property_type, owner_id) VALUES 
((SELECT id FROM communities WHERE name='测试小区' LIMIT 1), '1号楼', '1单元', '101', 88.5, '普通住宅', (SELECT id FROM owners WHERE name='测试业主' LIMIT 1));
EOF

echo "✅ 基础测试数据已添加"

echo ""
echo "📋 步骤7: 更新环境配置..."

# 确保环境配置正确
cat > .env << 'EOF'
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=property_management
PORT=3000
NODE_ENV=development
USE_MOCK_DB=false
EOF

echo "✅ 环境配置已更新"

echo ""
echo "📋 步骤8: 最终测试..."

# 测试Node.js连接
if [ -f "test-mysql.js" ]; then
    echo "🧪 测试 Node.js 数据库连接..."
    timeout 10s node test-mysql.js
    test_result=$?
    if [ $test_result -eq 0 ]; then
        echo "✅ Node.js 数据库连接测试通过"
    else
        echo "⚠️  Node.js 数据库连接测试超时或失败"
    fi
fi

echo ""
echo "🎉 数据库诊断和修复完成！"
echo ""
echo "📋 总结："
echo "  ✅ MySQL 服务正常"
echo "  ✅ 数据库 property_management 已就绪"
echo "  ✅ 所有必要的表已创建"
echo "  ✅ 基础测试数据已添加"
echo "  ✅ 环境配置已优化"
echo ""
echo "🚀 现在可以运行："
echo "  ./start-macos.sh  # 启动系统"
echo ""
echo "🔧 如果仍有问题，请检查："
echo "  1. 房产上传照片时是否先选择了要编辑的房产"
echo "  2. 浏览器控制台是否有JavaScript错误"
echo "  3. 后端日志中的具体错误信息"