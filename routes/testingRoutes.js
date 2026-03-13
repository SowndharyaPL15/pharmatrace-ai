const express = require('express');
const router  = express.Router();
const test    = require('../controllers/testingController');

router.get('/',         test.showTestForm);
router.post('/submit',  test.submitTest);

module.exports = router;
