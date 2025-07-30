const express = require('express');
const { 
  getOwners, 
  getOwnerById, 
  createOwner, 
  updateOwner, 
  deleteOwner,
  searchOwners,
  getOwnerOutstandingFees,
  uploadOwnerPhoto,
  deleteOwnerPhoto,
  upload
} = require('../controllers/ownerController');

const router = express.Router();

router.get('/', getOwners);
router.get('/search', searchOwners);
router.get('/:id', getOwnerById);
router.get('/:id/outstanding-fees', getOwnerOutstandingFees);
router.post('/', createOwner);
router.put('/:id', updateOwner);
router.delete('/:id', deleteOwner);
router.post('/:id/photo', upload.single('photo'), uploadOwnerPhoto);
router.delete('/:id/photo', deleteOwnerPhoto);

module.exports = router;