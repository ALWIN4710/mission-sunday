const express = require('express');
const { getExpenses, createExpense, updateExpense } = require('../controllers/expenseController');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/authorize');

const router = express.Router();

router.get('/', protect, getExpenses);
router.post('/', protect, authorize('admin'), createExpense);
router.patch('/:id', protect, authorize('admin'), updateExpense);

module.exports = router;
