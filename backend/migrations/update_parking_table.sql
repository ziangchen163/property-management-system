-- 车位表结构更新迁移
-- 添加新字段并修改现有字段名

USE property_management;

-- 添加新字段
ALTER TABLE parking_spaces 
ADD COLUMN rental_price DECIMAL(10,2) COMMENT '月租金' AFTER location_description,
ADD COLUMN remark TEXT COMMENT '备注信息' AFTER rental_price;

-- 重命名字段（如果原字段名不同）
-- 检查是否需要重命名字段
-- ALTER TABLE parking_spaces CHANGE COLUMN space_type type ENUM('地上', '地下') NOT NULL COMMENT '车位类型';
-- ALTER TABLE parking_spaces CHANGE COLUMN space_status status ENUM('自用', '待出租', '未交房', '出租中') DEFAULT '自用' COMMENT '车位状态';
-- ALTER TABLE parking_spaces CHANGE COLUMN location_desc location_description TEXT COMMENT '位置描述';

-- 更新索引（如果需要）
-- CREATE INDEX idx_parking_rental_price ON parking_spaces(rental_price);