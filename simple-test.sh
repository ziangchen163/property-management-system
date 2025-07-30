#!/bin/bash

echo "🧪 简化API测试"
echo "=========================="

BASE_URL="http://localhost:3000"

echo "1. 测试服务器状态..."
curl -s "$BASE_URL/" | grep -o '"message":"[^"]*"' || echo "连接失败"

echo ""
echo "2. 测试健康检查..."
curl -s "$BASE_URL/health" | grep -o '"status":"[^"]*"' || echo "健康检查失败"

echo ""
echo "3. 测试业主API..."
response=$(curl -s "$BASE_URL/api/owners")
echo "$response" | head -c 100
echo "..."

echo ""
echo "4. 创建测试业主..."
curl -s -X POST \
  -H "Content-Type: application/json" \
  -d '{"name":"测试用户","phone":"13900000000","company":"测试公司"}' \
  "$BASE_URL/api/owners" | head -c 100

echo ""
echo ""
echo "✅ 基础测试完成！"