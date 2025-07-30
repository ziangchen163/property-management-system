const express = require('express');
const {
  getParkingVehicleBindings,
  createParkingVehicleBinding,
  removeParkingVehicleBinding,
  getVehicleViolations,
  createVehicleViolation,
  updateViolationStatus,
  getViolationStats,
  getOwnerVehiclesAndParkings
} = require('../controllers/enhancedVehicleController');

const router = express.Router();

// 车位车辆绑定
router.get('/bindings', getParkingVehicleBindings);
router.post('/bindings', createParkingVehicleBinding);
router.delete('/bindings/:id', removeParkingVehicleBinding);

// 车辆违章
router.get('/violations', getVehicleViolations);
router.get('/violations/stats', getViolationStats);
router.post('/violations', createVehicleViolation);
router.put('/violations/:id', updateViolationStatus);

// 业主车辆车位综合查询
router.get('/owner/:owner_id', getOwnerVehiclesAndParkings);

module.exports = router;