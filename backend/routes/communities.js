const express = require('express');
const { getCommunities, getCommunityById, createCommunity, updateCommunity } = require('../controllers/communityController');

const router = express.Router();

router.get('/', getCommunities);
router.get('/:id', getCommunityById);
router.post('/', createCommunity);
router.put('/:id', updateCommunity);

module.exports = router;