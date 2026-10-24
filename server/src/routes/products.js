const express = require('express');
const { getProducts, createProduct, updateProduct, toggleProductStatus, updateBatchPrices } = require('../controllers/productController');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/authorize');

const router = express.Router();

router.get('/', protect, getProducts);
router.put('/batch-prices', protect, authorize('admin'), updateBatchPrices);
router.post('/', protect, authorize('admin', 'volunteer'), createProduct);
router.patch('/:id', protect, authorize('admin'), updateProduct);
router.patch('/:id/status', protect, authorize('admin'), toggleProductStatus);

module.exports = router;
