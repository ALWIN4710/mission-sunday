const express = require('express');
const { createSale, getSales, getSaleById, createRefund, exportSalesCSV } = require('../controllers/salesController');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/authorize');

const router = express.Router();

router.post('/', protect, createSale);
router.get('/', protect, getSales);
router.get('/export', protect, exportSalesCSV);
router.get('/:id', protect, getSaleById);
router.post('/:id/refunds', protect, authorize('admin'), createRefund);

module.exports = router;
