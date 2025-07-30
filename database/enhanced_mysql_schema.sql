-- 增强版物业管理系统数据库初始化脚本
-- 支持多小区管理，精确的收费计算逻辑
CREATE DATABASE IF NOT EXISTS property_management CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE property_management;

-- ========== 基础信息表 ==========

-- 小区信息表（增强版）
DROP TABLE IF EXISTS communities;
CREATE TABLE communities (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  address TEXT,
  description TEXT,
  manager_name VARCHAR(100),
  manager_phone VARCHAR(20),
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 房产性质表
DROP TABLE IF EXISTS property_types;
CREATE TABLE property_types (
  id INT AUTO_INCREMENT PRIMARY KEY,
  community_id INT NOT NULL,
  type_name VARCHAR(50) NOT NULL,
  description TEXT,
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (community_id) REFERENCES communities(id),
  UNIQUE KEY unique_community_type (community_id, type_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 车位类型表
DROP TABLE IF EXISTS parking_types;
CREATE TABLE parking_types (
  id INT AUTO_INCREMENT PRIMARY KEY,
  community_id INT NOT NULL,
  type_name VARCHAR(50) NOT NULL, -- 地上、地下、露天等
  description TEXT,
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (community_id) REFERENCES communities(id),
  UNIQUE KEY unique_community_parking_type (community_id, type_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 业主表（保持不变）
DROP TABLE IF EXISTS owners;
CREATE TABLE owners (
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

-- 房产表（增强版）
DROP TABLE IF EXISTS properties;
CREATE TABLE properties (
  id INT AUTO_INCREMENT PRIMARY KEY,
  community_id INT NOT NULL,
  property_type_id INT NOT NULL, -- 关联房产性质表
  building VARCHAR(20) NOT NULL,
  unit VARCHAR(10) NOT NULL,
  room VARCHAR(20) NOT NULL,
  area DECIMAL(8,2) NOT NULL,
  handover_date DATE, -- 交付日期，用于计算欠费起始时间
  is_delivered TINYINT(1) DEFAULT 0,
  is_decorated TINYINT(1) DEFAULT 0,
  occupancy_status VARCHAR(20) DEFAULT '空关',
  is_for_rent TINYINT(1) DEFAULT 0,
  rental_status VARCHAR(20) DEFAULT 'available',
  owner_id INT,
  photos TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (owner_id) REFERENCES owners(id),
  FOREIGN KEY (community_id) REFERENCES communities(id),
  FOREIGN KEY (property_type_id) REFERENCES property_types(id),
  UNIQUE KEY unique_property (community_id, building, unit, room)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 车位表（增强版）
DROP TABLE IF EXISTS parking_spaces;
CREATE TABLE parking_spaces (
  id INT AUTO_INCREMENT PRIMARY KEY,
  community_id INT NOT NULL,
  parking_type_id INT NOT NULL, -- 关联车位类型表
  space_number VARCHAR(50) NOT NULL,
  status VARCHAR(20) DEFAULT '自用',
  rental_status VARCHAR(20) DEFAULT 'available',
  rental_price DECIMAL(10,2) DEFAULT 0,
  location_description TEXT,
  owner_id INT,
  photos TEXT,
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (owner_id) REFERENCES owners(id),
  FOREIGN KEY (community_id) REFERENCES communities(id),
  FOREIGN KEY (parking_type_id) REFERENCES parking_types(id),
  UNIQUE KEY unique_parking (community_id, space_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ========== 收费配置表 ==========

-- 收费项目表（增强版）
DROP TABLE IF EXISTS fee_items;
CREATE TABLE fee_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  category VARCHAR(50) NOT NULL, -- 物业费、水费、电费、押金、其他
  calculation_method VARCHAR(50), -- area*months, fixed, usage*price等
  default_unit_price DECIMAL(10,2),
  description TEXT,
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 小区收费标准表（按小区+房产性质）
DROP TABLE IF EXISTS community_fee_rates;
CREATE TABLE community_fee_rates (
  id INT AUTO_INCREMENT PRIMARY KEY,
  community_id INT NOT NULL,
  fee_item_id INT NOT NULL,
  property_type_id INT, -- 房产性质，NULL表示适用于所有类型
  parking_type_id INT, -- 车位类型，NULL表示适用于所有类型
  unit_price DECIMAL(10,2) NOT NULL,
  effective_date DATE NOT NULL, -- 生效日期
  end_date DATE, -- 结束日期，NULL表示长期有效
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (community_id) REFERENCES communities(id),
  FOREIGN KEY (fee_item_id) REFERENCES fee_items(id),
  FOREIGN KEY (property_type_id) REFERENCES property_types(id),
  FOREIGN KEY (parking_type_id) REFERENCES parking_types(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ========== 收费记录表 ==========

-- 主收费记录表（通用）
DROP TABLE IF EXISTS fee_records;
CREATE TABLE fee_records (
  id INT AUTO_INCREMENT PRIMARY KEY,
  community_id INT NOT NULL,
  fee_item_id INT NOT NULL,
  property_id INT, -- 房产ID，房产相关费用
  parking_space_id INT, -- 车位ID，车位相关费用
  owner_id INT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  period_start DATE, -- 计费周期开始
  period_end DATE, -- 计费周期结束
  due_date DATE, -- 应缴日期
  status VARCHAR(20) DEFAULT 'unpaid', -- unpaid, paid, overdue
  paid_date DATE, -- 实际缴费日期
  paid_amount DECIMAL(10,2), -- 实际缴费金额
  payment_method VARCHAR(50), -- 支付方式
  discount_amount DECIMAL(10,2) DEFAULT 0, -- 优惠金额
  late_fee DECIMAL(10,2) DEFAULT 0, -- 滞纳金
  remark TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (community_id) REFERENCES communities(id),
  FOREIGN KEY (fee_item_id) REFERENCES fee_items(id),
  FOREIGN KEY (property_id) REFERENCES properties(id),
  FOREIGN KEY (parking_space_id) REFERENCES parking_spaces(id),
  FOREIGN KEY (owner_id) REFERENCES owners(id),
  INDEX idx_owner_status (owner_id, status),
  INDEX idx_property_period (property_id, period_start, period_end),
  INDEX idx_due_date (due_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 押金管理表（详细版）
DROP TABLE IF EXISTS deposit_records;
CREATE TABLE deposit_records (
  id INT AUTO_INCREMENT PRIMARY KEY,
  community_id INT NOT NULL,
  property_id INT NOT NULL,
  deposit_type VARCHAR(50) NOT NULL, -- 水费押金、装修押金等
  amount DECIMAL(10,2) NOT NULL, -- 押金总额
  balance DECIMAL(10,2) NOT NULL, -- 剩余余额
  status VARCHAR(20) DEFAULT 'active', -- active, depleted, refunded
  paid_date DATE,
  refund_date DATE,
  auto_deduct TINYINT(1) DEFAULT 0, -- 是否自动扣费
  remark TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (community_id) REFERENCES communities(id),
  FOREIGN KEY (property_id) REFERENCES properties(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 押金扣费记录表
DROP TABLE IF EXISTS deposit_deductions;
CREATE TABLE deposit_deductions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  deposit_record_id INT NOT NULL,
  fee_record_id INT, -- 关联的费用记录
  deduction_amount DECIMAL(10,2) NOT NULL,
  deduction_date DATE NOT NULL,
  reason VARCHAR(255),
  remark TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (deposit_record_id) REFERENCES deposit_records(id),
  FOREIGN KEY (fee_record_id) REFERENCES fee_records(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 水表读数记录表
DROP TABLE IF EXISTS water_readings;
CREATE TABLE water_readings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  property_id INT NOT NULL,
  reading_date DATE NOT NULL,
  current_reading DECIMAL(10,2) NOT NULL,
  previous_reading DECIMAL(10,2) DEFAULT 0,
  usage_amount DECIMAL(10,2) AS (current_reading - previous_reading),
  unit_price DECIMAL(10,2) DEFAULT 3.5,
  amount DECIMAL(10,2) AS (usage_amount * unit_price),
  reading_type VARCHAR(20) DEFAULT 'monthly', -- monthly, special, move_in, move_out
  reader VARCHAR(50), -- 抄表员
  remark TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (property_id) REFERENCES properties(id),
  INDEX idx_property_date (property_id, reading_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 电表读数记录表
DROP TABLE IF EXISTS electricity_readings;
CREATE TABLE electricity_readings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  property_id INT NOT NULL,
  reading_date DATE NOT NULL,
  current_reading DECIMAL(10,2) NOT NULL,
  previous_reading DECIMAL(10,2) DEFAULT 0,
  usage_amount DECIMAL(10,2) AS (current_reading - previous_reading),
  unit_price DECIMAL(10,2) NOT NULL, -- 从电费单价配置表获取
  amount DECIMAL(10,2) AS (usage_amount * unit_price),
  reading_type VARCHAR(20) DEFAULT 'monthly',
  prepaid_balance DECIMAL(10,2) DEFAULT 0, -- 预付费余额
  reader VARCHAR(50),
  remark TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (property_id) REFERENCES properties(id),
  INDEX idx_property_date (property_id, reading_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 每日收入记录表（细化）
DROP TABLE IF EXISTS daily_income;
CREATE TABLE daily_income (
  id INT AUTO_INCREMENT PRIMARY KEY,
  community_id INT NOT NULL,
  record_date DATE NOT NULL,
  income_type VARCHAR(50) NOT NULL, -- 门禁卡、消防放水费、其他
  property_id INT, -- 关联房产
  amount DECIMAL(10,2) NOT NULL,
  quantity INT DEFAULT 1,
  unit_price DECIMAL(10,2),
  description TEXT,
  collector VARCHAR(50), -- 收费员
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (community_id) REFERENCES communities(id),
  FOREIGN KEY (property_id) REFERENCES properties(id),
  INDEX idx_date_type (record_date, income_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ========== 其他辅助表 ==========

-- 租客表（保持不变）
DROP TABLE IF EXISTS tenants;
CREATE TABLE tenants (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  phone VARCHAR(20) UNIQUE,
  id_card VARCHAR(18) UNIQUE,
  photo_url VARCHAR(500),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 车辆表（保持不变）
DROP TABLE IF EXISTS vehicles;
CREATE TABLE vehicles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  license_plate VARCHAR(20) NOT NULL UNIQUE,
  car_model VARCHAR(100),
  owner_id INT,
  photos TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (owner_id) REFERENCES owners(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 租赁合同表（保持原有结构）
DROP TABLE IF EXISTS rental_contracts;
CREATE TABLE rental_contracts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  contract_number VARCHAR(100) NOT NULL UNIQUE,
  property_id INT,
  parking_space_id INT,
  tenant_id INT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  monthly_rent DECIMAL(10,2) NOT NULL,
  deposit DECIMAL(10,2),
  status VARCHAR(20) DEFAULT 'active',
  contract_file VARCHAR(500),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (property_id) REFERENCES properties(id),
  FOREIGN KEY (parking_space_id) REFERENCES parking_spaces(id),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 装修管理表（保持原有结构）
DROP TABLE IF EXISTS decoration_permits;
CREATE TABLE decoration_permits (
  id INT AUTO_INCREMENT PRIMARY KEY,
  property_id INT,
  permit_number VARCHAR(100),
  start_date DATE,
  end_date DATE,
  contact_person VARCHAR(100),
  contact_phone VARCHAR(20),
  deposit_amount DECIMAL(10,2) DEFAULT 0,
  status VARCHAR(20) DEFAULT 'in_progress',
  permit_files TEXT,
  decoration_photos TEXT,
  inspection_report TEXT,
  fee_records TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (property_id) REFERENCES properties(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ========== 初始化基础数据 ==========

-- 插入小区数据
INSERT INTO communities (name, address, manager_name, manager_phone) VALUES
('阳光花园', '北京市朝阳区建国路88号', '王经理', '13800138000'),
('绿城小区', '北京市海淀区中关村大街100号', '李经理', '13800138001'),
('碧水家园', '上海市浦东新区陆家嘴99号', '张经理', '13800138002');

-- 插入房产性质
INSERT INTO property_types (community_id, type_name, description) VALUES
(1, '普通住宅', '标准住宅'),
(1, '公寓', '小户型公寓'),
(1, '商铺', '底层商业用房'),
(1, '上叠', '叠拼别墅上层'),
(1, '下叠', '叠拼别墅下层'),
(1, '别墅', '独栋别墅'),
(2, '普通住宅', '标准住宅'),
(2, '公寓', '小户型公寓'),
(2, '商铺', '底层商业用房'),
(3, '普通住宅', '标准住宅'),
(3, '高层公寓', '高层住宅'),
(3, '商办', '商务办公');

-- 插入车位类型
INSERT INTO parking_types (community_id, type_name, description) VALUES
(1, '地下', '地下车库'),
(1, '地上', '地面车位'),
(1, '露天', '露天停车场'),
(2, '地下', '地下车库'),
(2, '地上', '地面车位'),
(3, '地下', '地下车库'),
(3, '立体', '立体车库');

-- 插入收费项目
INSERT INTO fee_items (name, category, calculation_method, default_unit_price, description) VALUES
('物业费', '物业费', 'area*months*rate', 3.0, '物业管理服务费，按面积和月份计算'),
('保洁能耗费', '停车费', 'months*rate', 50.0, '车位管理费，按月计算'),
('水费', '水费', 'usage*rate', 3.5, '用水费用，按用量计算'),
('电费', '电费', 'usage*rate', 0.6, '用电费用，按用量计算'),
('消防放水费', '其他', 'fixed', 20.0, '消防测试费用，按次计算'),
('水费押金', '押金', 'fixed', 200.0, '水费保证金'),
('装修押金', '押金', 'fixed', 2000.0, '装修保证金'),
('门禁卡费', '其他', 'quantity*rate', 15.0, '门禁卡制作费'),
('装修垃圾清运费', '其他', 'fixed', 300.0, '装修垃圾处理费'),
('建筑垃圾清运费', '其他', 'fixed', 500.0, '建筑垃圾处理费');

-- 插入收费标准（阳光花园）
INSERT INTO community_fee_rates (community_id, fee_item_id, property_type_id, unit_price, effective_date) VALUES
-- 物业费标准
(1, 1, 1, 3.0, '2024-01-01'), -- 阳光花园-普通住宅-物业费
(1, 1, 2, 3.5, '2024-01-01'), -- 阳光花园-公寓-物业费
(1, 1, 3, 5.0, '2024-01-01'), -- 阳光花园-商铺-物业费
(1, 1, 4, 2.8, '2024-01-01'), -- 阳光花园-上叠-物业费
(1, 1, 5, 2.8, '2024-01-01'), -- 阳光花园-下叠-物业费
(1, 1, 6, 2.5, '2024-01-01'); -- 阳光花园-别墅-物业费

-- 车位管理费标准
INSERT INTO community_fee_rates (community_id, fee_item_id, parking_type_id, unit_price, effective_date) VALUES
(1, 2, 1, 50.0, '2024-01-01'), -- 阳光花园-地下车位-保洁能耗费
(1, 2, 2, 30.0, '2024-01-01'), -- 阳光花园-地上车位-保洁能耗费
(1, 2, 3, 20.0, '2024-01-01'); -- 阳光花园-露天车位-保洁能耗费

-- 电费单价（按房产性质）
INSERT INTO community_fee_rates (community_id, fee_item_id, property_type_id, unit_price, effective_date) VALUES
(1, 4, 1, 0.6, '2024-01-01'), -- 普通住宅电费
(1, 4, 2, 0.65, '2024-01-01'), -- 公寓电费
(1, 4, 3, 1.2, '2024-01-01'), -- 商铺电费
(1, 4, 4, 0.6, '2024-01-01'), -- 上叠电费
(1, 4, 5, 0.6, '2024-01-01'), -- 下叠电费
(1, 4, 6, 0.55, '2024-01-01'); -- 别墅电费

-- 插入示例业主
INSERT INTO owners (name, phone, id_card, company, position) VALUES
('张三', '13800138000', '110101199001011234', '北京科技有限公司', '工程师'),
('李四', '13800138001', '110101199001011235', '阿里巴巴', '产品经理'),
('王五', '13800138002', '110101199001011236', '腾讯科技', '架构师');

-- 插入示例房产
INSERT INTO properties (community_id, property_type_id, building, unit, room, area, handover_date, is_delivered, owner_id) VALUES
(1, 1, 'A栋', '1单元', '101', 85.5, '2023-05-01', 1, 1),
(1, 1, 'A栋', '1单元', '102', 90.2, '2023-06-01', 1, 2),
(1, 2, 'B栋', '2单元', '201', 65.8, '2023-07-01', 1, 3),
(1, 3, 'C栋', '1层', '商铺01', 120.0, '2023-08-01', 1, 1);

-- 插入示例车位
INSERT INTO parking_spaces (community_id, parking_type_id, space_number, owner_id, location_description) VALUES
(1, 1, 'B1-001', 1, '地下一层A区'),
(1, 1, 'B1-002', 2, '地下一层A区'),
(1, 2, '地上-001', 3, '小区入口附近');

COMMIT;