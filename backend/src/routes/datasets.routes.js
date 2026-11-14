const router = require('express').Router();
const { listDatasets } = require('../controllers/datasets.controller');
const { optionalAuth } = require('../middleware/auth.middleware');

router.get('/', optionalAuth, listDatasets);

module.exports = router;
