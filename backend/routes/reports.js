const express = require('express');
const {
  getDailyReport,
  getMonthlyReport,
  getQuarterlyReport,
  getAllOutstandingFees,
  getPropertyOutstandingDetails,
  getOutstandingDashboard
} = require('../controllers/reportController');

const router = express.Router();

// 报表生成
router.get('/daily', getDailyReport);
router.get('/monthly', getMonthlyReport);
router.get('/quarterly', getQuarterlyReport);

// 欠费统计
router.get('/outstanding/all', getAllOutstandingFees);
router.get('/outstanding/property/:property_address', getPropertyOutstandingDetails);

// 欠费看板
router.get('/dashboard', getOutstandingDashboard);

module.exports = router;