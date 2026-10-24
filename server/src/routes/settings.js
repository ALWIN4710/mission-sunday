const express = require('express');
const { getSettings, updateSettings } = require('../controllers/settingsController');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/authorize');

const router = express.Router();

router.get('/', protect, getSettings);
router.patch('/', protect, authorize('admin'), updateSettings);

module.exports = router;
