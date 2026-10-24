const express = require('express');
const {
  getSalesReport,
  getProfitLossReport,
  getReconciliationReport,
  getInventoryReport,
  downloadReportCSV,
} = require('../controllers/reportsController');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/authorize');

const router = express.Router();

router.get('/sales', protect, getSalesReport);
router.get('/profit-loss', protect, authorize('admin'), getProfitLossReport);
router.get('/reconciliation', protect, authorize('admin'), getReconciliationReport);
router.get('/inventory', protect, getInventoryReport);
router.get('/:type/download', protect, downloadReportCSV);

module.exports = router;
