-- 数据库表结构修复脚本
-- 解决代码中引用但数据库中不存在的字段问题

USE property_management;

-- 1. 为 communities 表添加 updated_at 字段（如果不存在）
ALTER TABLE communities 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;

-- 2. 为 parking_spaces 表添加 remark 字段（如果不存在）
ALTER TABLE parking_spaces 
ADD COLUMN IF NOT EXISTS remark TEXT;

-- 3. 确保所有需要的字段都存在
-- 检查 properties 表的 updated_at 字段
ALTER TABLE properties 
MODIFY COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;

-- 检查 parking_spaces 表的 updated_at 字段  
ALTER TABLE parking_spaces 
MODIFY COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;

-- 4. 确保 owners 表有正确的字段
ALTER TABLE owners 
MODIFY COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;

-- 显示修复结果
SELECT 'Database structure fixed successfully!' as status;