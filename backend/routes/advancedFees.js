const express = require('express');
const {
  getPropertyFeeRates,
  updatePropertyFeeRate,
  calculatePropertyFees,
  generatePropertyFeeBills,
  getOwnerOutstandingFees
} = require('../controllers/advancedFeeController');

const router = express.Router();

// 房产类型收费标准管理
router.get('/rates', getPropertyFeeRates);
router.post('/rates', updatePropertyFeeRate);
router.put('/rates', updatePropertyFeeRate);

// 物业费计算
router.get('/calculate', calculatePropertyFees);
router.post('/generate-bills', generatePropertyFeeBills);

// 欠费查询
router.get('/outstanding/:owner_id', getOwnerOutstandingFees);

module.exports = router;