// 模拟数据库连接 - 用于测试环境
const mockData = {
  owners: [
    { id: 1, name: '张三', phone: '13800138000', id_card: '110101199001011234', company: '北京科技有限公司', position: '工程师' },
    { id: 2, name: '李四', phone: '13800138001', id_card: '110101199001011235', company: '阿里巴巴', position: '产品经理' }
  ],
  properties: [
    { id: 1, community_id: 1, building: 'A栋', unit: '1单元', room: '101', area: 85.5, property_type: '普通住宅', owner_id: 1 },
    { id: 2, community_id: 1, building: 'A栋', unit: '1单元', room: '102', area: 90.2, property_type: '普通住宅', owner_id: 2 }
  ],
  communities: [
    { id: 1, name: '阳光花园', address: '北京市朝阳区建国路88号' }
  ]
};

// 模拟连接池
const mockPool = {
  execute: async (sql, params = []) => {
    console.log(`🔧 [模拟SQL] ${sql}`);
    if (params.length > 0) {
      console.log(`📋 [参数] ${JSON.stringify(params)}`);
    }
    
    // 模拟查询延迟
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // 解析SQL并返回模拟数据
    if (sql.includes('SELECT VERSION()')) {
      return [[{ version: 'MySQL 8.0.35 (模拟版本)' }]];
    }
    
    if (sql.includes('SHOW TABLES')) {
      const tables = Object.keys(mockData).map(table => ({ [`Tables_in_property_management`]: table }));
      return [tables];
    }
    
    if (sql.includes('SELECT COUNT(*) as count FROM owners')) {
      return [[{ count: mockData.owners.length }]];
    }
    
    if (sql.includes('SELECT * FROM owners')) {
      return [mockData.owners];
    }
    
    if (sql.includes('SELECT * FROM properties')) {
      return [mockData.properties];
    }
    
    if (sql.includes('INSERT INTO owners')) {
      const newOwner = {
        id: mockData.owners.length + 1,
        name: params[0],
        phone: params[1],
        id_card: params[2],
        company: params[3] || '',
        position: params[4] || ''
      };
      mockData.owners.push(newOwner);
      return [{ insertId: newOwner.id }];
    }
    
    // 默认返回空结果
    return [[]];
  },
  
  getConnection: async () => {
    return {
      execute: mockPool.execute,
      release: () => {
        console.log('📱 释放模拟数据库连接');
      }
    };
  },
  
  end: async () => {
    console.log('🔒 关闭模拟数据库连接池');
  }
};

// 模拟初始化函数
const mockInitDatabase = async () => {
  console.log('🗄️  初始化模拟数据库...');
  await new Promise(resolve => setTimeout(resolve, 500));
  console.log('✅ 模拟数据库初始化完成');
};

const mockTestConnection = async () => {
  try {
    await mockInitDatabase();
    console.log('✅ 模拟MySQL数据库连接成功');
  } catch (error) {
    console.error('❌ 模拟MySQL数据库连接失败:', error.message);
  }
};

// 检测是否为测试环境
const isTestEnvironment = () => {
  return process.env.NODE_ENV === 'test' || process.env.USE_MOCK_DB === 'true' || !process.env.DB_PASSWORD;
};

module.exports = {
  pool: mockPool,
  testConnection: mockTestConnection,
  isTestEnvironment
};