const express = require('express');
const router  = express.Router();
const supply  = require('../controllers/supplyController');

router.get('/',           supply.showTransferForm);
router.post('/transfer',  supply.transferMedicine);
router.post('/confirm',   supply.confirmReceipt);
router.get('/history',    supply.supplyHistory);

module.exports = router;
