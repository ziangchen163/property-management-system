const express = require('express');
const router = express.Router();
const {
  getCommunities,
  getCommunityById,
  createCommunity,
  updateCommunity,
  getPropertyTypes,
  createPropertyType,
  updatePropertyType,
  getParkingTypes,
  createParkingType,
  updateParkingType,
  getCommunityFeeRates,
  setCommunityFeeRate
} = require('../controllers/enhancedCommunityController');

// ========== 小区管理路由 ==========
router.get('/', getCommunities);
router.get('/:id', getCommunityById);
router.post('/', createCommunity);
router.put('/:id', updateCommunity);

// ========== 房产性质管理路由 ==========
router.get('/property-types/list', getPropertyTypes);
router.post('/property-types', createPropertyType);
router.put('/property-types/:id', updatePropertyType);

// ========== 车位类型管理路由 ==========
router.get('/parking-types/list', getParkingTypes);
router.post('/parking-types', createParkingType);
router.put('/parking-types/:id', updateParkingType);

// ========== 收费标准管理路由 ==========
router.get('/fee-rates', getCommunityFeeRates);
router.post('/fee-rates', setCommunityFeeRate);

module.exports = router;