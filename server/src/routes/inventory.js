const express = require('express');
const { getInventory, getMovements, createMovement, createPurchase } = require('../controllers/inventoryController');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/authorize');

const router = express.Router();

router.get('/', protect, getInventory);
router.get('/movements', protect, getMovements);
router.post('/movements', protect, authorize('admin'), createMovement);
router.post('/purchases', protect, authorize('admin'), createPurchase);

module.exports = router;
