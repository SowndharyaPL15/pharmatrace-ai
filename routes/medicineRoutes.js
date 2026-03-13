const express = require('express');
const router  = express.Router();
const pool    = require('../config/database');
const med     = require('../controllers/medicineController');

router.get('/',     med.listMedicines);
router.get('/add',  med.showAddMedicine);
router.post('/add', med.addMedicine);

// ── QR Code routes ─────────────────────────────────────────────
// Serves QR as PNG image directly (use in <img src="...">)
router.get('/qr/view/:batchId', med.viewQR);

// Regenerate & save QR for existing batch
router.post('/qr/regenerate/:batchId', med.regenerateQR);

// Full printable QR page
router.get('/qr/page/:batchId', async (req, res) => {
  const { batchId } = req.params;
  const protocol  = req.protocol || 'http';
  const host      = req.get('host') || `localhost:${process.env.PORT || 3000}`;
  const verifyUrl = `${protocol}://${host}/verify/${encodeURIComponent(batchId)}`;
  try {
    const result = await pool.query('SELECT * FROM medicines WHERE batch_id=$1', [batchId]);
    res.render('qrPage', {
      batchId,
      medicine:  result.rows[0] || null,
      verifyUrl,
      user: req.session.user || null
    });
  } catch (err) {
    res.status(500).send('Error loading QR page: ' + err.message);
  }
});

module.exports = router;
