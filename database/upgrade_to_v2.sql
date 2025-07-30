-- 物业管理系统数据库升级脚本
-- 从旧版本升级到增强版v2.0
-- 执行前请备份现有数据库！

USE property_management;

-- ========== 第一步：创建新的基础表 ==========

-- 创建房产性质表
CREATE TABLE IF NOT EXISTS property_types (
  id INT AUTO_INCREMENT PRIMARY KEY,
  community_id INT NOT NULL,
  type_name VARCHAR(50) NOT NULL,
  description TEXT,
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (community_id) REFERENCES communities(id),
  UNIQUE KEY unique_community_type (community_id, type_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 创建车位类型表
CREATE TABLE IF NOT EXISTS parking_types (
  id INT AUTO_INCREMENT PRIMARY KEY,
  community_id INT NOT NULL,
  type_name VARCHAR(50) NOT NULL,
  description TEXT,
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (community_id) REFERENCES communities(id),
  UNIQUE KEY unique_community_parking_type (community_id, type_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ========== 第二步：修改现有表结构 ==========

-- 升级communities表
ALTER TABLE communities 
ADD COLUMN IF NOT EXISTS manager_name VARCHAR(100),
ADD COLUMN IF NOT EXISTS manager_phone VARCHAR(20),
ADD COLUMN IF NOT EXISTS is_active TINYINT(1) DEFAULT 1,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;

-- 升级properties表
ALTER TABLE properties 
ADD COLUMN IF NOT EXISTS property_type_id INT,
ADD INDEX IF NOT EXISTS idx_property_type (property_type_id);

-- 升级parking_spaces表
ALTER TABLE parking_spaces 
ADD COLUMN IF NOT EXISTS parking_type_id INT,
ADD INDEX IF NOT EXISTS idx_parking_type (parking_type_id);

-- 升级fee_items表
ALTER TABLE fee_items 
ADD COLUMN IF NOT EXISTS category VARCHAR(50) NOT NULL DEFAULT '其他';

-- ========== 第三步：创建新的收费管理表 ==========

-- 小区收费标准表（替代原来的property_fee_rates）
CREATE TABLE IF NOT EXISTS community_fee_rates (
  id INT AUTO_INCREMENT PRIMARY KEY,
  community_id INT NOT NULL,
  fee_item_id INT NOT NULL,
  property_type_id INT,
  parking_type_id INT,
  unit_price DECIMAL(10,2) NOT NULL,
  effective_date DATE NOT NULL,
  end_date DATE,
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (community_id) REFERENCES communities(id),
  FOREIGN KEY (fee_item_id) REFERENCES fee_items(id),
  FOREIGN KEY (property_type_id) REFERENCES property_types(id),
  FOREIGN KEY (parking_type_id) REFERENCES parking_types(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 升级fee_records表
ALTER TABLE fee_records 
ADD COLUMN IF NOT EXISTS community_id INT,
ADD COLUMN IF NOT EXISTS paid_amount DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS discount_amount DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS late_fee DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
ADD INDEX IF NOT EXISTS idx_owner_status (owner_id, status),
ADD INDEX IF NOT EXISTS idx_property_period (property_id, period_start, period_end),
ADD INDEX IF NOT EXISTS idx_due_date (due_date);

-- ========== 第四步：创建新功能表 ==========

-- 押金管理表（增强版）
DROP TABLE IF EXISTS deposit_records;
CREATE TABLE deposit_records (
  id INT AUTO_INCREMENT PRIMARY KEY,
  community_id INT NOT NULL,
  property_id INT NOT NULL,
  deposit_type VARCHAR(50) NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  balance DECIMAL(10,2) NOT NULL,
  status VARCHAR(20) DEFAULT 'active',
  paid_date DATE,
  refund_date DATE,
  auto_deduct TINYINT(1) DEFAULT 0,
  remark TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (community_id) REFERENCES communities(id),
  FOREIGN KEY (property_id) REFERENCES properties(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 押金扣费记录表
CREATE TABLE IF NOT EXISTS deposit_deductions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  deposit_record_id INT NOT NULL,
  fee_record_id INT,
  deduction_amount DECIMAL(10,2) NOT NULL,
  deduction_date DATE NOT NULL,
  reason VARCHAR(255),
  remark TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (deposit_record_id) REFERENCES deposit_records(id),
  FOREIGN KEY (fee_record_id) REFERENCES fee_records(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 升级water_readings表
ALTER TABLE water_readings 
ADD COLUMN IF NOT EXISTS reader VARCHAR(50),
ADD COLUMN IF NOT EXISTS usage_amount DECIMAL(10,2) AS (current_reading - previous_reading),
ADD COLUMN IF NOT EXISTS amount DECIMAL(10,2) AS (usage_amount * unit_price),
ADD INDEX IF NOT EXISTS idx_property_date (property_id, reading_date);

-- 升级electricity_readings表
ALTER TABLE electricity_readings 
ADD COLUMN IF NOT EXISTS reader VARCHAR(50),
ADD COLUMN IF NOT EXISTS usage_amount DECIMAL(10,2) AS (current_reading - previous_reading),
ADD COLUMN IF NOT EXISTS amount DECIMAL(10,2) AS (usage_amount * unit_price),
ADD INDEX IF NOT EXISTS idx_property_date (property_id, reading_date);

-- 升级daily_income表
ALTER TABLE daily_income 
ADD COLUMN IF NOT EXISTS community_id INT,
ADD COLUMN IF NOT EXISTS collector VARCHAR(50),
ADD INDEX IF NOT EXISTS idx_date_type (record_date, income_type);

-- ========== 第五步：数据迁移和初始化 ==========

-- 更新fee_items的分类
UPDATE fee_items SET category = '物业费' WHERE name = '物业费';
UPDATE fee_items SET category = '停车费' WHERE name = '保洁能耗费';
UPDATE fee_items SET category = '水费' WHERE name = '水费';
UPDATE fee_items SET category = '电费' WHERE name = '电费';
UPDATE fee_items SET category = '押金' WHERE name LIKE '%押金%';
UPDATE fee_items SET category = '其他' WHERE category = '其他';

-- 为现有小区插入默认房产性质
INSERT IGNORE INTO property_types (community_id, type_name, description) 
SELECT id, '普通住宅', '标准住宅' FROM communities;

INSERT IGNORE INTO property_types (community_id, type_name, description) 
SELECT id, '公寓', '小户型公寓' FROM communities;

INSERT IGNORE INTO property_types (community_id, type_name, description) 
SELECT id, '商铺', '底层商业用房' FROM communities;

-- 为现有小区插入默认车位类型
INSERT IGNORE INTO parking_types (community_id, type_name, description) 
SELECT id, '地下', '地下车库' FROM communities;

INSERT IGNORE INTO parking_types (community_id, type_name, description) 
SELECT id, '地上', '地面车位' FROM communities;

-- 更新现有房产的property_type_id
UPDATE properties p 
SET property_type_id = (
  SELECT pt.id FROM property_types pt 
  WHERE pt.community_id = p.community_id 
  AND pt.type_name = COALESCE(p.property_type, '普通住宅')
  LIMIT 1
)
WHERE property_type_id IS NULL;

-- 更新现有车位的parking_type_id
UPDATE parking_spaces ps 
SET parking_type_id = (
  SELECT pkt.id FROM parking_types pkt 
  WHERE pkt.community_id = ps.community_id 
  AND pkt.type_name = COALESCE(ps.type, '地下')
  LIMIT 1
)
WHERE parking_type_id IS NULL;

-- 迁移现有收费标准到新表
INSERT IGNORE INTO community_fee_rates (community_id, fee_item_id, property_type_id, unit_price, effective_date)
SELECT 
  p.community_id,
  pfr.fee_item_id,
  pt.id as property_type_id,
  pfr.unit_price,
  '2024-01-01'
FROM property_fee_rates pfr
JOIN property_types pt ON pt.type_name = pfr.property_type
JOIN properties p ON p.community_id = pt.community_id
GROUP BY p.community_id, pfr.fee_item_id, pt.id, pfr.unit_price;

-- 更新fee_records的community_id
UPDATE fee_records fr 
SET community_id = (
  SELECT p.community_id FROM properties p WHERE p.id = fr.property_id
)
WHERE fr.property_id IS NOT NULL AND fr.community_id IS NULL;

UPDATE fee_records fr 
SET community_id = (
  SELECT ps.community_id FROM parking_spaces ps WHERE ps.id = fr.parking_space_id
)
WHERE fr.parking_space_id IS NOT NULL AND fr.community_id IS NULL;

-- 更新daily_income的community_id
UPDATE daily_income di 
SET community_id = (
  SELECT p.community_id FROM properties p WHERE p.id = di.property_id
)
WHERE di.property_id IS NOT NULL AND di.community_id IS NULL;

-- ========== 第六步：插入示例收费标准 ==========

-- 为每个小区设置默认的物业费标准
INSERT IGNORE INTO community_fee_rates (community_id, fee_item_id, property_type_id, unit_price, effective_date)
SELECT 
  c.id as community_id,
  1 as fee_item_id, -- 物业费
  pt.id as property_type_id,
  CASE pt.type_name
    WHEN '普通住宅' THEN 3.0
    WHEN '公寓' THEN 3.5
    WHEN '商铺' THEN 5.0
    WHEN '上叠' THEN 2.8
    WHEN '下叠' THEN 2.8
    WHEN '别墅' THEN 2.5
    ELSE 3.0
  END as unit_price,
  '2024-01-01' as effective_date
FROM communities c
CROSS JOIN property_types pt
WHERE pt.community_id = c.id;

-- 为每个小区设置车位管理费标准
INSERT IGNORE INTO community_fee_rates (community_id, fee_item_id, parking_type_id, unit_price, effective_date)
SELECT 
  c.id as community_id,
  2 as fee_item_id, -- 保洁能耗费
  pkt.id as parking_type_id,
  CASE pkt.type_name
    WHEN '地下' THEN 50.0
    WHEN '地上' THEN 30.0
    WHEN '露天' THEN 20.0
    WHEN '立体' THEN 45.0
    ELSE 50.0
  END as unit_price,
  '2024-01-01' as effective_date
FROM communities c
CROSS JOIN parking_types pkt
WHERE pkt.community_id = c.id;

-- 为每个小区设置电费单价
INSERT IGNORE INTO community_fee_rates (community_id, fee_item_id, property_type_id, unit_price, effective_date)
SELECT 
  c.id as community_id,
  4 as fee_item_id, -- 电费
  pt.id as property_type_id,
  CASE pt.type_name
    WHEN '普通住宅' THEN 0.6
    WHEN '公寓' THEN 0.65
    WHEN '商铺' THEN 1.2
    WHEN '上叠' THEN 0.6
    WHEN '下叠' THEN 0.6
    WHEN '别墅' THEN 0.55
    ELSE 0.6
  END as unit_price,
  '2024-01-01' as effective_date
FROM communities c
CROSS JOIN property_types pt
WHERE pt.community_id = c.id;

-- ========== 完成升级 ==========

-- 插入版本信息
CREATE TABLE IF NOT EXISTS system_version (
  id INT AUTO_INCREMENT PRIMARY KEY,
  version VARCHAR(20) NOT NULL,
  description TEXT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO system_version (version, description) VALUES 
('2.0.0', '增强版物业管理系统 - 支持多小区、精确计费、自动欠费计算')
ON DUPLICATE KEY UPDATE 
version = VALUES(version), 
description = VALUES(description),
updated_at = CURRENT_TIMESTAMP;

SELECT '✅ 数据库升级完成！新增功能：多小区管理、精确计费、自动欠费计算、押金管理、水电抄表' as message;

-- 显示升级后的统计信息
SELECT 
  '小区数量' as item, COUNT(*) as count FROM communities
UNION ALL
SELECT 
  '房产性质类型' as item, COUNT(*) as count FROM property_types
UNION ALL
SELECT 
  '车位类型' as item, COUNT(*) as count FROM parking_types
UNION ALL
SELECT 
  '收费标准' as item, COUNT(*) as count FROM community_fee_rates
UNION ALL
SELECT 
  '房产数量' as item, COUNT(*) as count FROM properties
UNION ALL
SELECT 
  '车位数量' as item, COUNT(*) as count FROM parking_spaces;