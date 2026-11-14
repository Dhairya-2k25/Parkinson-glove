const router = require('express').Router();
const { getMe, updateProfile } = require('../controllers/auth.controller');
const { requireAuth } = require('../middleware/auth.middleware');

router.get('/me', requireAuth, getMe);
router.put('/profile', requireAuth, updateProfile);

module.exports = router;
