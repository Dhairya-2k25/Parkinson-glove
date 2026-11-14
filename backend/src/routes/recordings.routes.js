const router = require('express').Router();
const { listRecordings, getRecording, getRecordingSamples } = require('../controllers/recordings.controller');
const { requireAuth } = require('../middleware/auth.middleware');

router.get('/', requireAuth, listRecordings);
router.get('/:id', requireAuth, getRecording);
router.get('/:id/samples', requireAuth, getRecordingSamples);

module.exports = router;
