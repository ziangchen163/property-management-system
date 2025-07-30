# 物业管理系统数据库升级指南

## ⚠️ 升级前必读

### 重要提醒
1. **务必备份数据库**！升级前请完整备份你的 property_management 数据库
2. 建议在测试环境先执行一遍升级脚本
3. 升级过程不可逆，请确保理解每个步骤

### 备份命令
```bash
# 备份整个数据库
mysqldump -u root -p property_management > property_management_backup_$(date +%Y%m%d_%H%M%S).sql

# 或者备份到指定文件
mysqldump -u root -p property_management > property_management_backup_before_v2.sql
```

## 🚀 升级步骤

### 方式一：一键升级（推荐）
```bash
# 1. 进入数据库目录
cd /path/to/property-system/database

# 2. 执行升级脚本
mysql -u root -p property_management < upgrade_to_v2.sql
```

### 方式二：逐步升级（安全）
```bash
# 1. 先创建新的增强版数据库结构（用于测试）
mysql -u root -p -e "CREATE DATABASE property_management_v2;"
mysql -u root -p property_management_v2 < enhanced_mysql_schema.sql

# 2. 测试无误后，对原数据库执行升级
mysql -u root -p property_management < upgrade_to_v2.sql
```

## 📋 升级内容概览

### 新增表
- `property_types` - 房产性质管理
- `parking_types` - 车位类型管理  
- `community_fee_rates` - 小区收费标准
- `deposit_deductions` - 押金扣费记录
- `system_version` - 系统版本信息

### 修改表
- `communities` - 新增管理员信息、状态字段
- `properties` - 新增房产性质关联
- `parking_spaces` - 新增车位类型关联
- `fee_items` - 新增分类字段
- `fee_records` - 新增小区ID、折扣、滞纳金等字段
- `deposit_records` - 重构押金管理逻辑
- `water_readings` - 新增抄表员、自动计算字段
- `electricity_readings` - 新增抄表员、自动计算字段
- `daily_income` - 新增小区ID、收费员字段

### 数据迁移
- 自动为现有小区创建默认房产性质
- 自动为现有小区创建默认车位类型
- 迁移现有收费标准到新的标准表
- 更新现有记录的关联关系

## ✅ 升级后验证

### 检查表结构
```sql
-- 查看新增的表
SHOW TABLES LIKE '%types';
SHOW TABLES LIKE '%community_fee_rates';

-- 查看表结构
DESCRIBE property_types;
DESCRIBE parking_types;
DESCRIBE community_fee_rates;
```

### 检查数据完整性
```sql
-- 检查小区数据
SELECT c.*, COUNT(p.id) as property_count 
FROM communities c 
LEFT JOIN properties p ON c.id = p.community_id 
GROUP BY c.id;

-- 检查房产性质
SELECT pt.*, c.name as community_name 
FROM property_types pt 
JOIN communities c ON pt.community_id = c.id;

-- 检查收费标准
SELECT cfr.*, c.name as community_name, fi.name as fee_name
FROM community_fee_rates cfr
JOIN communities c ON cfr.community_id = c.id
JOIN fee_items fi ON cfr.fee_item_id = fi.id
ORDER BY c.name, fi.name;
```

### 测试新功能
```sql
-- 测试欠费计算（需要房产有交付日期）
SELECT p.*, o.name as owner_name
FROM properties p
JOIN owners o ON p.owner_id = o.id
WHERE p.handover_date IS NOT NULL;
```

## 🔧 可能遇到的问题

### 1. 外键约束错误
```sql
-- 如果遇到外键约束问题，先禁用外键检查
SET FOREIGN_KEY_CHECKS = 0;
-- 执行升级脚本
-- 然后重新启用
SET FOREIGN_KEY_CHECKS = 1;
```

### 2. 字段已存在错误
- 升级脚本使用了 `ADD COLUMN IF NOT EXISTS`，正常情况下不会出错
- 如果还是出错，可能是MySQL版本太低，需要手动检查字段是否已存在

### 3. 数据迁移不完整
```sql
-- 检查是否有房产没有分配性质
SELECT COUNT(*) FROM properties WHERE property_type_id IS NULL;

-- 检查是否有车位没有分配类型  
SELECT COUNT(*) FROM parking_spaces WHERE parking_type_id IS NULL;

-- 检查是否有费用记录没有小区ID
SELECT COUNT(*) FROM fee_records WHERE community_id IS NULL;
```

## 📞 升级后的新API

升级完成后，你可以使用以下新的API接口：

- `GET /api/v2/communities` - 获取小区列表
- `GET /api/v2/fees/outstanding/:owner_id` - 计算业主欠费
- `POST /api/v2/fees/generate-outstanding/:owner_id` - 生成欠费账单
- `POST /api/v2/fees/generate-monthly` - 批量生成月度账单
- `GET /api/v2/payments/deposits` - 押金管理
- `POST /api/v2/payments/daily-income/access-card` - 门禁卡收费

## 🎉 升级完成

升级成功后，你将拥有：
- ✅ 多小区管理能力
- ✅ 按房产性质差异化收费
- ✅ 智能欠费计算
- ✅ 完整的押金管理
- ✅ 水电费精确计算
- ✅ 每日收入统计

访问 `frontend/enhanced-fee-management.html` 开始使用新功能！