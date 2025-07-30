const express = require('express');
const router = express.Router();
const {
  calculateOwnerOutstandingFees,
  generateOutstandingBills,
  generateMonthlyBills,
  createWaterReading,
  createElectricityReading
} = require('../controllers/enhancedFeeController');

// ========== 欠费计算路由 ==========
router.get('/outstanding/:owner_id', calculateOwnerOutstandingFees);

// ========== 账单生成路由 ==========
router.post('/generate-outstanding/:owner_id', generateOutstandingBills);
router.post('/generate-monthly', generateMonthlyBills);

// ========== 水电费管理路由 ==========
router.post('/water-reading', createWaterReading);
router.post('/electricity-reading', createElectricityReading);

module.exports = router;