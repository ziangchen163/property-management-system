const express = require('express');
const {
  getDailyIncomeRecords,
  createAccessCardIncome,
  createFireTestIncome,
  createOtherIncome,
  getDailyIncomeStats,
  deleteDailyIncomeRecord
} = require('../controllers/dailyIncomeController');

const router = express.Router();

// 每日收入记录
router.get('/', getDailyIncomeRecords);
router.get('/stats', getDailyIncomeStats);
router.delete('/:id', deleteDailyIncomeRecord);

// 特定收费类型
router.post('/access-card', createAccessCardIncome);
router.post('/fire-test', createFireTestIncome);
router.post('/other', createOtherIncome);

module.exports = router;