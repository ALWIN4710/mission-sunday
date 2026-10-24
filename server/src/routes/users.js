const express = require('express');
const { getUsers, createUser, updateUser } = require('../controllers/usersController');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/authorize');

const router = express.Router();

router.get('/', protect, authorize('admin'), getUsers);
router.post('/', protect, authorize('admin'), createUser);
router.patch('/:id', protect, authorize('admin'), updateUser);

module.exports = router;
