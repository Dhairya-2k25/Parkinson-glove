const router = require('express').Router();
const { listSessions, getSession } = require('../controllers/sessions.controller');
const { requireAuth } = require('../middleware/auth.middleware');

router.get('/', requireAuth, listSessions);
router.get('/:id', requireAuth, getSession);

module.exports = router;
