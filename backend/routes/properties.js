const express = require('express');
const { 
  getProperties, 
  getPropertyById,
  createProperty, 
  updateProperty, 
  deleteProperty,
  getPropertyPhotos,
  uploadPropertyPhoto,
  deletePropertyPhoto,
  upload
} = require('../controllers/propertyController');

const router = express.Router();

router.get('/', getProperties);
router.get('/:id', getPropertyById);
router.post('/', createProperty);
router.put('/:id', updateProperty);
router.delete('/:id', deleteProperty);
// 房产照片管理路由
router.get('/:id/photos', getPropertyPhotos);
router.post('/:id/photos', upload.single('photo'), uploadPropertyPhoto);
router.delete('/:id/photos', deletePropertyPhoto);

module.exports = router;