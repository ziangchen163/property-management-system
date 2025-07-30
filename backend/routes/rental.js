const express = require('express');
const {
  getAvailableProperties,
  updatePropertyRental,
  getAvailableParkingSpaces,
  updateParkingRental,
  getRentalContracts,
  createRentalContract,
  updateContractStatus,
  uploadContractFile,
  upload
} = require('../controllers/rentalController');

const router = express.Router();

// 房屋租售
router.get('/properties', getAvailableProperties);
router.put('/properties/:id', updatePropertyRental);

// 车位租售
router.get('/parking-spaces', getAvailableParkingSpaces);
router.put('/parking-spaces/:id', updateParkingRental);

// 合同管理
router.get('/contracts', getRentalContracts);
router.post('/contracts', createRentalContract);
router.put('/contracts/:id/status', updateContractStatus);
router.post('/contracts/:id/upload', upload.single('contract'), uploadContractFile);

module.exports = router;