const mysql = require('mysql2/promise');

// 检测是否为测试环境或无法连接MySQL的环境
const isTestEnvironment = () => {
  return process.env.NODE_ENV === 'test' || 
         process.env.USE_MOCK_DB === 'true' ||
         process.env.DB_PASSWORD === 'your_mysql_password';  // 移除密码为空的检查
};

// 如果是测试环境，使用模拟数据库
if (isTestEnvironment()) {
  console.log('🧪 检测到测试环境，使用模拟数据库');
  module.exports = require('./database-mock');
  return;
}

console.log('🗄️  使用真实MySQL数据库');

// 创建MySQL连接池
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'property_management',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: 'utf8mb4'
});

// 初始化数据库表
const initDatabase = async () => {
  try {
    const connection = await pool.getConnection();
    
    try {
      // 创建小区信息表
      await connection.execute(`
        CREATE TABLE IF NOT EXISTS communities (
          id INT AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(255) NOT NULL UNIQUE,
          address TEXT,
          description TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);

      // 创建业主表（完善版）
      await connection.execute(`
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
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);

      // 创建房产表（完善版）
      await connection.execute(`
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
          FOREIGN KEY (owner_id) REFERENCES owners(id),
          FOREIGN KEY (community_id) REFERENCES communities(id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);

      // 创建车位表
      await connection.execute(`
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
          FOREIGN KEY (owner_id) REFERENCES owners(id),
          FOREIGN KEY (community_id) REFERENCES communities(id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);

      // 创建租客表
      await connection.execute(`
        CREATE TABLE IF NOT EXISTS tenants (
          id INT AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(100) NOT NULL,
          phone VARCHAR(20) UNIQUE,
          id_card VARCHAR(18) UNIQUE,
          photo_url VARCHAR(500),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);

      // 创建车辆表
      await connection.execute(`
        CREATE TABLE IF NOT EXISTS vehicles (
          id INT AUTO_INCREMENT PRIMARY KEY,
          license_plate VARCHAR(20) NOT NULL UNIQUE,
          car_model VARCHAR(100),
          owner_id INT,
          photos TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (owner_id) REFERENCES owners(id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);

      // 创建收费项目配置表
      await connection.execute(`
        CREATE TABLE IF NOT EXISTS fee_items (
          id INT AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(100) NOT NULL UNIQUE,
          unit_price DECIMAL(10,2),
          calculation_method VARCHAR(50),
          description TEXT,
          is_active TINYINT(1) DEFAULT 1,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);

      // 创建房产类型收费标准表
      await connection.execute(`
        CREATE TABLE IF NOT EXISTS property_fee_rates (
          id INT AUTO_INCREMENT PRIMARY KEY,
          property_type VARCHAR(50) NOT NULL,
          fee_item_id INT,
          unit_price DECIMAL(10,2) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (fee_item_id) REFERENCES fee_items(id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);

      // 创建收费记录表（完善版）
      await connection.execute(`
        CREATE TABLE IF NOT EXISTS fee_records (
          id INT AUTO_INCREMENT PRIMARY KEY,
          property_id INT,
          parking_space_id INT,
          owner_id INT,
          fee_item_id INT,
          amount DECIMAL(10,2) NOT NULL,
          period_start DATE,
          period_end DATE,
          status VARCHAR(20) DEFAULT 'unpaid',
          due_date DATE,
          paid_date DATE,
          payment_method VARCHAR(50),
          remark TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (property_id) REFERENCES properties(id),
          FOREIGN KEY (parking_space_id) REFERENCES parking_spaces(id),
          FOREIGN KEY (owner_id) REFERENCES owners(id),
          FOREIGN KEY (fee_item_id) REFERENCES fee_items(id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);

      // 创建租赁合同表
      await connection.execute(`
        CREATE TABLE IF NOT EXISTS rental_contracts (
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
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);

      // 创建装修管理表
      await connection.execute(`
        CREATE TABLE IF NOT EXISTS decoration_permits (
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
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);

      // 创建押金管理表
      await connection.execute(`
        CREATE TABLE IF NOT EXISTS deposit_records (
          id INT AUTO_INCREMENT PRIMARY KEY,
          property_id INT,
          deposit_type VARCHAR(50) NOT NULL,
          amount DECIMAL(10,2) NOT NULL,
          balance DECIMAL(10,2) NOT NULL,
          status VARCHAR(20) DEFAULT 'active',
          paid_date DATE,
          refund_date DATE,
          remark TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (property_id) REFERENCES properties(id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);

      // 创建水表抄表记录表
      await connection.execute(`
        CREATE TABLE IF NOT EXISTS water_readings (
          id INT AUTO_INCREMENT PRIMARY KEY,
          property_id INT,
          reading_date DATE NOT NULL,
          current_reading DECIMAL(10,2) NOT NULL,
          previous_reading DECIMAL(10,2) DEFAULT 0,
          usage_amount DECIMAL(10,2),
          unit_price DECIMAL(10,2) DEFAULT 3.5,
          amount DECIMAL(10,2),
          reading_type VARCHAR(20) DEFAULT 'monthly',
          remark TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (property_id) REFERENCES properties(id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);

      // 创建电表抄表记录表
      await connection.execute(`
        CREATE TABLE IF NOT EXISTS electricity_readings (
          id INT AUTO_INCREMENT PRIMARY KEY,
          property_id INT,
          reading_date DATE NOT NULL,
          current_reading DECIMAL(10,2) NOT NULL,
          previous_reading DECIMAL(10,2) DEFAULT 0,
          usage_amount DECIMAL(10,2),
          unit_price DECIMAL(10,2),
          amount DECIMAL(10,2),
          reading_type VARCHAR(20) DEFAULT 'monthly',
          prepaid_balance DECIMAL(10,2) DEFAULT 0,
          remark TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (property_id) REFERENCES properties(id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);

      // 创建每日收入记录表
      await connection.execute(`
        CREATE TABLE IF NOT EXISTS daily_income (
          id INT AUTO_INCREMENT PRIMARY KEY,
          record_date DATE NOT NULL,
          income_type VARCHAR(50) NOT NULL,
          property_id INT,
          amount DECIMAL(10,2) NOT NULL,
          quantity INT DEFAULT 1,
          unit_price DECIMAL(10,2),
          description TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (property_id) REFERENCES properties(id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);

      // 创建电费单价配置表
      await connection.execute(`
        CREATE TABLE IF NOT EXISTS electricity_rates (
          id INT AUTO_INCREMENT PRIMARY KEY,
          property_type VARCHAR(50) NOT NULL,
          unit_price DECIMAL(10,2) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);

      // 创建车辆违章记录表
      await connection.execute(`
        CREATE TABLE IF NOT EXISTS vehicle_violations (
          id INT AUTO_INCREMENT PRIMARY KEY,
          vehicle_id INT,
          violation_date DATE NOT NULL,
          violation_type VARCHAR(100) NOT NULL,
          location VARCHAR(255),
          fine_amount DECIMAL(10,2) DEFAULT 0,
          status VARCHAR(20) DEFAULT 'pending',
          description TEXT,
          photos TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (vehicle_id) REFERENCES vehicles(id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);

      // 创建车位车辆绑定关系表
      await connection.execute(`
        CREATE TABLE IF NOT EXISTS parking_vehicle_bindings (
          id INT AUTO_INCREMENT PRIMARY KEY,
          parking_space_id INT,
          vehicle_id INT,
          binding_type VARCHAR(20) DEFAULT 'owner',
          start_date DATE,
          end_date DATE,
          status VARCHAR(20) DEFAULT 'active',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (parking_space_id) REFERENCES parking_spaces(id),
          FOREIGN KEY (vehicle_id) REFERENCES vehicles(id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);

      // 插入基础数据
      // 插入小区数据
      await connection.execute(`
        INSERT IGNORE INTO communities (name, address) VALUES
        ('阳光花园', '北京市朝阳区建国路88号'),
        ('绿城小区', '北京市海淀区中关村大街100号')
      `);

      // 插入收费项目
      await connection.execute(`
        INSERT IGNORE INTO fee_items (name, calculation_method, description) VALUES
        ('物业费', '按面积计算', '物业管理服务费'),
        ('保洁能耗费', '按车位计算', '车位管理费'),
        ('水费', '按用量计算', '用水费用'),
        ('电费', '按用量计算', '用电费用'),
        ('消防放水费', '按次计算', '消防测试费用'),
        ('押金', '固定金额', '各类押金'),
        ('装修垃圾清运费', '按次计算', '装修垃圾处理费'),
        ('建筑垃圾清运费', '按次计算', '建筑垃圾处理费'),
        ('门禁卡费', '按张计算', '门禁卡制作费'),
        ('租金', '按月计算', '房屋租赁费'),
        ('中介费', '按比例计算', '中介服务费'),
        ('赔偿费', '按实际计算', '各类赔偿费用')
      `);

      // 插入房产类型收费标准
      await connection.execute(`
        INSERT IGNORE INTO property_fee_rates (property_type, fee_item_id, unit_price) VALUES
        ('普通住宅', 1, 3.0),
        ('公寓', 1, 3.5),
        ('商铺', 1, 5.0),
        ('上叠', 1, 2.8),
        ('下叠', 1, 2.8),
        ('别墅', 1, 2.5),
        ('车位', 2, 50.0)
      `);

      // 插入电费单价配置
      await connection.execute(`
        INSERT IGNORE INTO electricity_rates (property_type, unit_price) VALUES
        ('普通住宅', 0.6),
        ('公寓', 0.65),
        ('商铺', 1.2),
        ('上叠', 0.6),
        ('下叠', 0.6),
        ('别墅', 0.55)
      `);

      // 插入示例业主数据
      await connection.execute(`
        INSERT IGNORE INTO owners (name, phone, id_card, company, position) VALUES
        ('张三', '13800138000', '110101199001011234', '北京科技有限公司', '工程师'),
        ('李四', '13800138001', '110101199001011235', '阿里巴巴', '产品经理')
      `);

      // 插入示例房产数据
      await connection.execute(`
        INSERT IGNORE INTO properties (community_id, building, unit, room, area, property_type, is_delivered, owner_id, handover_date) VALUES
        (1, 'A栋', '1单元', '101', 85.5, '普通住宅', 1, 1, '2024-01-01'),
        (1, 'A栋', '1单元', '102', 90.2, '普通住宅', 1, 2, '2024-01-01'),
        (1, 'B栋', '2单元', '201', 95.2, '普通住宅', 1, 1, '2024-02-01')
      `);

      // 插入示例车位数据
      await connection.execute(`
        INSERT IGNORE INTO parking_spaces (community_id, space_number, type, owner_id, rental_price, location_description) VALUES
        (1, 'B1-001', '地下', 1, 0, '地下一层A区'),
        (1, 'B1-002', '地下', 2, 0, '地下一层A区'),
        (1, 'B1-003', '地下', 1, 300, '地下一层B区，靠近电梯')
      `);

      console.log('✅ 数据库表初始化完成');
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('❌ 数据库初始化失败:', error.message);
    throw error;
  }
};

const testConnection = async () => {
  try {
    await initDatabase();
    console.log('✅ MySQL数据库连接成功');
  } catch (error) {
    console.error('❌ MySQL数据库连接失败:', error.message);
  }
};

module.exports = { pool, testConnection };