const express = require('express');
const {
  getSalesTrend,
  getCategoryAnalytics,
  getProductAnalytics,
  getHourlyAnalytics,
  getVolunteerAnalytics,
} = require('../controllers/analyticsController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.get('/sales', protect, getSalesTrend);
router.get('/categories', protect, getCategoryAnalytics);
router.get('/products', protect, getProductAnalytics);
router.get('/hourly', protect, getHourlyAnalytics);
router.get('/volunteers', protect, getVolunteerAnalytics);

module.exports = router;
