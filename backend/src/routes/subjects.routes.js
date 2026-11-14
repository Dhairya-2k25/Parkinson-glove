const router = require('express').Router();
const { listSubjects, getSubject } = require('../controllers/subjects.controller');
const { requireAuth } = require('../middleware/auth.middleware');

router.get('/', requireAuth, listSubjects);
router.get('/:id', requireAuth, getSubject);

module.exports = router;
