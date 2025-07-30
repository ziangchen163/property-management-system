const mysql = require('mysql2/promise');
require('dotenv').config();

// 检测是否为测试环境
const isTestEnvironment = () => {
  return process.env.NODE_ENV === 'test' || 
         process.env.USE_MOCK_DB === 'true' || 
         !process.env.DB_PASSWORD ||
         process.env.DB_PASSWORD === 'your_mysql_password';
};

async function testMySQLConnection() {
  console.log('🔗 测试MySQL数据库连接...');
  console.log('================================');
  
  if (isTestEnvironment()) {
    console.log('🧪 检测到测试环境，使用模拟数据库');
    
    // 使用模拟数据库
    const { testConnection } = require('./config/database-mock');
    await testConnection();
    
    console.log('📋 模拟数据库配置:');
    console.log('   类型: 内存模拟数据库');
    console.log('   状态: 运行中');
    console.log('   数据: 预置测试数据');
    
    return;
  }
  
  // 原有的MySQL测试逻辑
  try {
    // 创建连接池
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

    console.log('📋 数据库配置:');
    console.log(`   主机: ${process.env.DB_HOST || 'localhost'}`);
    console.log(`   端口: ${process.env.DB_PORT || 3306}`);
    console.log(`   用户: ${process.env.DB_USER || 'root'}`);
    console.log(`   数据库: ${process.env.DB_NAME || 'property_management'}`);
    console.log('');

    // 获取连接
    const connection = await pool.getConnection();
    console.log('✅ MySQL连接成功!');

    // 测试查询
    const [rows] = await connection.execute('SELECT VERSION() as version');
    console.log(`📊 MySQL版本: ${rows[0].version}`);

    // 检查数据库表
    const [tables] = await connection.execute('SHOW TABLES');
    console.log(`📁 数据库表数量: ${tables.length}`);
    
    if (tables.length > 0) {
      console.log('📋 数据库表列表:');
      tables.forEach((table, index) => {
        console.log(`   ${index + 1}. ${Object.values(table)[0]}`);
      });
    }

    // 测试业主数据
    try {
      const [owners] = await connection.execute('SELECT COUNT(*) as count FROM owners');
      console.log(`👥 业主数量: ${owners[0].count}`);
    } catch (err) {
      console.log('⚠️  业主表可能尚未创建');
    }

    // 释放连接
    connection.release();
    await pool.end();
    
    console.log('');
    console.log('🎉 数据库测试完成!');
    console.log('================================');
    
  } catch (error) {
    console.error('❌ 数据库连接失败:');
    console.error(`   错误: ${error.message}`);
    console.error(`   代码: ${error.code || 'Unknown'}`);
    console.log('');
    console.log('💡 解决建议:');
    console.log('   1. 检查MySQL服务是否运行');
    console.log('   2. 验证数据库配置信息');
    console.log('   3. 确认数据库用户权限');
    console.log('   4. 运行 ./setup-mysql.sh 配置数据库');
    process.exit(1);
  }
}

// 如果直接运行此文件
if (require.main === module) {
  testMySQLConnection();
}

module.exports = { testMySQLConnection };