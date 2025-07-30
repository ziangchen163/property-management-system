const express = require('express');
const { 
  getFeeRecords, 
  createFeeRecord, 
  updateFeeRecord, 
  getFeeStats,
  getFeeItems,
  getFeeItemById,
  createFeeItem,
  updateFeeItem,
  deactivateFeeItem,
  activateFeeItem
} = require('../controllers/feeController');

const router = express.Router();

// 收费记录路由
router.get('/', getFeeRecords);
router.get('/stats', getFeeStats);
router.post('/', createFeeRecord);
router.put('/:id', updateFeeRecord);

// 收费项目管理路由
router.get('/items', getFeeItems);
router.get('/items/:id', getFeeItemById);
router.post('/items', createFeeItem);
router.put('/items/:id', updateFeeItem);
router.put('/items/:id/deactivate', deactivateFeeItem);
router.put('/items/:id/activate', activateFeeItem);

module.exports = router;