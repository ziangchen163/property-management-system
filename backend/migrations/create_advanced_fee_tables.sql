-- 高级收费管理表结构迁移
-- 创建房产类型收费标准表和相关表

USE property_management;

-- 创建收费项目表 (如果不存在)
CREATE TABLE IF NOT EXISTS fee_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL COMMENT '收费项目名称',
    description TEXT COMMENT '项目描述',
    calculation_method ENUM('按面积', '固定金额', '按月', '按年') NOT NULL COMMENT '计算方式',
    is_active TINYINT DEFAULT 1 COMMENT '是否启用 0-停用 1-启用',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='收费项目表';

-- 创建房产类型收费标准表 (如果不存在)
CREATE TABLE IF NOT EXISTS property_fee_rates (
    id INT AUTO_INCREMENT PRIMARY KEY,
    property_type ENUM('普通住宅', '公寓', '商铺', '上叠', '下叠', '别墅', '车位') NOT NULL COMMENT '房产性质',
    fee_item_id INT NOT NULL COMMENT '收费项目ID',
    unit_price DECIMAL(10,2) NOT NULL COMMENT '单价',
    is_active TINYINT DEFAULT 1 COMMENT '是否启用',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (fee_item_id) REFERENCES fee_items(id),
    UNIQUE KEY unique_property_fee (property_type, fee_item_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='房产类型收费标准表';

-- 插入基础收费项目数据
INSERT IGNORE INTO fee_items (id, name, description, calculation_method) VALUES 
(1, '物业费', '物业管理服务费用', '按面积'),
(2, '车位管理费', '车位保洁和管理费用', '固定金额'),
(3, '保洁能耗费', '公共区域保洁和能耗费用', '固定金额'),
(4, '水费', '生活用水费用', '按用量'),
(5, '电费', '生活用电费用', '按用量');

-- 插入基础房产类型收费标准
INSERT IGNORE INTO property_fee_rates (property_type, fee_item_id, unit_price) VALUES 
('普通住宅', 1, 2.50),
('公寓', 1, 3.00),
('商铺', 1, 5.00),
('上叠', 1, 3.50),
('下叠', 1, 3.50),
('别墅', 1, 4.00),
('车位', 2, 150.00);

-- 确保 fee_records 表存在且结构正确
CREATE TABLE IF NOT EXISTS fee_records (
    id INT AUTO_INCREMENT PRIMARY KEY,
    property_id INT COMMENT '房产ID',
    parking_space_id INT COMMENT '车位ID',
    owner_id INT NOT NULL COMMENT '业主ID',
    fee_item_id INT NOT NULL COMMENT '收费项目ID',
    amount DECIMAL(10,2) NOT NULL COMMENT '费用金额',
    period_start DATE COMMENT '费用周期开始日期',
    period_end DATE COMMENT '费用周期结束日期',
    due_date DATE COMMENT '到期日期',
    status ENUM('unpaid', 'paid', 'partial') DEFAULT 'unpaid' COMMENT '支付状态',
    payment_date TIMESTAMP NULL COMMENT '支付日期',
    payment_method VARCHAR(50) COMMENT '支付方式',
    remarks TEXT COMMENT '备注',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (property_id) REFERENCES properties(id),
    FOREIGN KEY (parking_space_id) REFERENCES parking_spaces(id),
    FOREIGN KEY (owner_id) REFERENCES owners(id),
    FOREIGN KEY (fee_item_id) REFERENCES fee_items(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='收费记录表';

-- 创建索引以优化查询性能
CREATE INDEX IF NOT EXISTS idx_fee_records_owner ON fee_records(owner_id);
CREATE INDEX IF NOT EXISTS idx_fee_records_property ON fee_records(property_id);
CREATE INDEX IF NOT EXISTS idx_fee_records_parking ON fee_records(parking_space_id);
CREATE INDEX IF NOT EXISTS idx_fee_records_status ON fee_records(status);
CREATE INDEX IF NOT EXISTS idx_property_fee_rates_type ON property_fee_rates(property_type);