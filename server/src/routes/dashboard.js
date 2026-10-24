const express = require('express');
const { getDashboardSummary, resetDashboard } = require('../controllers/dashboardController');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/authorize');

const router = express.Router();

router.get('/summary', protect, getDashboardSummary);
router.post('/reset', protect, authorize('admin'), resetDashboard);

module.exports = router;
