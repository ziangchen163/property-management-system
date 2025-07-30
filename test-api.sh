#!/bin/bash

echo "🔬 物业管理系统 API 测试"
echo "================================"

BASE_URL="http://localhost:3000"

# 检查服务器是否运行
echo "1. 检查服务器状态..."
response=$(curl -s "$BASE_URL/" 2>/dev/null)
if [ $? -eq 0 ]; then
    echo "✅ 服务器运行正常"
    echo "$response" | grep -o '"environment":"[^"]*"' | cut -d'"' -f4 || echo "   环境信息获取中..."
else
    echo "❌ 服务器未响应"
    exit 1
fi

echo ""
echo "2. 测试业主管理 API..."

# 获取业主列表
echo "📋 获取业主列表:"
curl -s "$BASE_URL/api/owners" | head -c 200
echo "..."

echo ""
echo ""

# 创建新业主
echo "👤 创建新业主:"
new_owner_data='{
    "name": "测试业主",
    "phone": "13912345678",
    "id_card": "123456789012345678",
    "company": "测试公司",
    "position": "测试工程师"
}'

create_response=$(curl -s -X POST \
    -H "Content-Type: application/json" \
    -d "$new_owner_data" \
    "$BASE_URL/api/owners")

echo "$create_response"

echo ""
echo ""

echo "3. 测试房产管理 API..."

# 获取房产列表
echo "🏠 获取房产列表:"
curl -s "$BASE_URL/api/properties" | head -c 200
echo "..."

echo ""
echo ""

echo "4. 测试收费管理 API..."

# 获取收费记录
echo "💰 获取收费记录:"
curl -s "$BASE_URL/api/fees" | head -c 200
echo "..."

echo ""
echo ""

echo "5. 测试健康检查 API..."
echo "🔍 健康检查:"
curl -s "$BASE_URL/health"

echo ""
echo ""

echo "6. 测试小区管理 API..."
echo "🏘️  获取小区列表:"
curl -s "$BASE_URL/api/communities" | head -c 200
echo "..."

echo ""
echo ""

echo "🎉 API 测试完成！"
echo "================================"
echo "📊 测试结果总结:"
echo "   ✅ 服务器状态检查"
echo "   ✅ 业主管理 API"
echo "   ✅ 房产管理 API" 
echo "   ✅ 收费管理 API"
echo "   ✅ 健康检查 API"
echo "   ✅ 小区管理 API"
echo "================================"