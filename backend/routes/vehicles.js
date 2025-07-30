const express = require('express');
const { 
  getVehicles,
  getVehicleById,
  createVehicle,
  updateVehicle,
  deleteVehicle,
  uploadVehiclePhoto,
  deleteVehiclePhoto,
  upload
} = require('../controllers/vehicleController');

const router = express.Router();

router.get('/', getVehicles);
router.get('/:id', getVehicleById);
router.post('/', createVehicle);
router.put('/:id', updateVehicle);
router.delete('/:id', deleteVehicle);
router.post('/:id/photo', upload.single('photo'), uploadVehiclePhoto);
router.delete('/:id/photo', deleteVehiclePhoto);

module.exports = router;