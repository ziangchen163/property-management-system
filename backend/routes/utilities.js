const express = require('express');
const {
  getWaterReadings,
  createWaterReading,
  getElectricityReadings,
  createElectricityReading,
  rechargeElectricity,
  getDepositRecords,
  createDepositRecord,
  deductDeposit
} = require('../controllers/utilityController');

const router = express.Router();

// 水费管理
router.get('/water', getWaterReadings);
router.post('/water', createWaterReading);

// 电费管理
router.get('/electricity', getElectricityReadings);
router.post('/electricity', createElectricityReading);
router.post('/electricity/recharge', rechargeElectricity);

// 押金管理
router.get('/deposits', getDepositRecords);
router.post('/deposits', createDepositRecord);
router.put('/deposits/:id/deduct', deductDeposit);

module.exports = router;