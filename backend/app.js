const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const { testConnection } = require('./config/database');
const ownerRoutes = require('./routes/owners');
const propertyRoutes = require('./routes/properties');
const feeRoutes = require('./routes/fees');
const parkingRoutes = require('./routes/parking');
const communityRoutes = require('./routes/communities');
const tenantRoutes = require('./routes/tenants');
const vehicleRoutes = require('./routes/vehicles');
const advancedFeeRoutes = require('./routes/advancedFees');
const utilityRoutes = require('./routes/utilities');
const dailyIncomeRoutes = require('./routes/dailyIncome');
const rentalRoutes = require('./routes/rental');
const decorationRoutes = require('./routes/decoration');
const enhancedVehicleRoutes = require('./routes/enhancedVehicles');
const reportRoutes = require('./routes/reports');
const importRoutes = require('./routes/import');

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(cors());
app.use(express.json());

// 静态文件服务 - 提供上传的图片
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// 路由
app.use('/api/owners', ownerRoutes);
app.use('/api/properties', propertyRoutes);
app.use('/api/fees', feeRoutes);
app.use('/api/parking', parkingRoutes);
app.use('/api/communities', communityRoutes);
app.use('/api/tenants', tenantRoutes);
app.use('/api/vehicles', vehicleRoutes);
app.use('/api/advanced-fees', advancedFeeRoutes);
app.use('/api/utilities', utilityRoutes);
app.use('/api/daily-income', dailyIncomeRoutes);
app.use('/api/rental', rentalRoutes);
app.use('/api/decoration', decorationRoutes);
app.use('/api/enhanced-vehicles', enhancedVehicleRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/import', importRoutes);

// 根路径 - 增加环境信息
app.get('/', (req, res) => {
  const isTestEnv = process.env.NODE_ENV === 'test' || 
                   process.env.USE_MOCK_DB === 'true' || 
                   !process.env.DB_PASSWORD ||
                   process.env.DB_PASSWORD === 'your_mysql_password';
  
  res.json({
    message: '🏠 物业管理系统 API',
    version: '1.0.0',
    status: 'running',
    environment: isTestEnv ? '测试环境 (模拟数据库)' : '生产环境 (MySQL)',
    database: isTestEnv ? 'Mock Database' : 'MySQL',
    timestamp: new Date().toISOString()
  });
});

// 健康检查端点
app.get('/health', async (req, res) => {
  try {
    // 尝试连接数据库
    const { testConnection } = require('./config/database');
    await testConnection();
    
    res.json({
      status: 'healthy',
      database: 'connected',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      database: 'disconnected',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// 启动服务器
app.listen(PORT, async () => {
  console.log(`🚀 服务器运行在 http://localhost:${PORT}`);
  await testConnection();
});
