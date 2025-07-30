const express = require('express');
const { 
  getTenants,
  getTenantById,
  createTenant,
  updateTenant,
  deleteTenant,
  uploadTenantPhoto,
  deleteTenantPhoto,
  upload
} = require('../controllers/tenantController');

const router = express.Router();

router.get('/', getTenants);
router.get('/:id', getTenantById);
router.post('/', createTenant);
router.put('/:id', updateTenant);
router.delete('/:id', deleteTenant);
router.post('/:id/photo', upload.single('photo'), uploadTenantPhoto);
router.delete('/:id/photo', deleteTenantPhoto);

module.exports = router;