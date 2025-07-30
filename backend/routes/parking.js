const express = require('express');
const { 
  getParkingSpaces, 
  getParkingSpaceById,
  createParkingSpace, 
  updateParkingSpace, 
  deleteParkingSpace,
  deactivateParkingSpace,
  getAvailableForRent,
  uploadParkingPhoto,
  deleteParkingPhoto,
  upload
} = require('../controllers/parkingController');

const router = express.Router();

router.get('/', getParkingSpaces);
router.get('/available-for-rent', getAvailableForRent);
router.get('/:id', getParkingSpaceById);
router.post('/', createParkingSpace);
router.put('/:id', updateParkingSpace);
router.delete('/:id', deleteParkingSpace);
router.put('/:id/deactivate', deactivateParkingSpace);
router.post('/:id/photo', upload.single('photo'), uploadParkingPhoto);
router.delete('/:id/photo', deleteParkingPhoto);

module.exports = router;