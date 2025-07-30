const express = require('express');
const router = express.Router();
const {
  getDepositRecords,
  createDepositRecord,
  deductFromDeposit,
  refundDeposit,
  getDailyIncomeRecords,
  addDailyIncomeRecord,
  addAccessCardFee,
  addFireWaterFee,
  getFeeRecords,
  updateFeeRecordStatus
} = require('../controllers/enhancedPaymentController');

// ========== 押金管理路由 ==========
router.get('/deposits', getDepositRecords);
router.post('/deposits', createDepositRecord);
router.post('/deposits/:deposit_record_id/deduct', deductFromDeposit);
router.post('/deposits/:deposit_record_id/refund', refundDeposit);

// ========== 每日收入管理路由 ==========
router.get('/daily-income', getDailyIncomeRecords);
router.post('/daily-income', addDailyIncomeRecord);
router.post('/daily-income/access-card', addAccessCardFee);
router.post('/daily-income/fire-water', addFireWaterFee);

// ========== 费用记录管理路由 ==========
router.get('/records', getFeeRecords);
router.put('/records/:id', updateFeeRecordStatus);

module.exports = router;