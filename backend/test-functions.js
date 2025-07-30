const { testMySQLConnection } = require('./test-mysql');

async function runTests() {
  console.log('🧪 物业管理系统 - 功能测试');
  console.log('================================');
  
  try {
    // 测试数据库连接
    console.log('1. 测试数据库连接...');
    await testMySQLConnection();
    
    // 测试模块加载
    console.log('\n2. 测试模块加载...');
    const { pool } = require('./config/database');
    console.log('   ✅ 数据库配置模块加载成功');
    
    // 测试基本查询
    console.log('\n3. 测试基本查询...');
    const [owners] = await pool.execute('SELECT * FROM owners');
    console.log(`   👥 查询到 ${owners.length} 个业主`);
    
    const [properties] = await pool.execute('SELECT * FROM properties');
    console.log(`   🏠 查询到 ${properties.length} 个房产`);
    
    // 测试插入操作
    console.log('\n4. 测试插入操作...');
    const [result] = await pool.execute(
      'INSERT INTO owners (name, phone, id_card, company) VALUES (?, ?, ?, ?)',
      ['测试用户', '13900000000', '123456789012345678', '测试公司']
    );
    console.log(`   ✅ 插入成功，ID: ${result.insertId}`);
    
    // 验证插入
    const [newOwners] = await pool.execute('SELECT * FROM owners');
    console.log(`   👥 现在有 ${newOwners.length} 个业主`);
    
    console.log('\n🎉 所有测试通过！');
    console.log('================================');
    
  } catch (error) {
    console.error('\n❌ 测试失败:', error.message);
    process.exit(1);
  }
}

// 如果直接运行此文件
if (require.main === module) {
  runTests();
}

module.exports = { runTests };