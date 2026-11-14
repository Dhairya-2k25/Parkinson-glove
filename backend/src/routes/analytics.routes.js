const router = require('express').Router();
const { getAnalytics } = require('../controllers/analytics.controller');
const { requireAuth } = require('../middleware/auth.middleware');

router.get('/:recordingId', requireAuth, getAnalytics);

module.exports = router;
