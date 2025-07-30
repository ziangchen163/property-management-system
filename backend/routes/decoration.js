const express = require('express');
const {
  getDecorationPermits,
  getPropertyOutstandingFees,
  createDecorationPermit,
  updateDecorationPermit,
  uploadDecorationFile,
  handleDecorationDeposit,
  upload
} = require('../controllers/decorationController');

const router = express.Router();

// 装修许可管理
router.get('/', getDecorationPermits);
router.post('/', createDecorationPermit);
router.put('/:id', updateDecorationPermit);

// 房产欠费查询
router.get('/property-outstanding/:property_id', getPropertyOutstandingFees);

// 文件上传
router.post('/:id/upload', upload.single('file'), uploadDecorationFile);

// 押金处理
router.post('/:permit_id/deposit', handleDecorationDeposit);

module.exports = router;