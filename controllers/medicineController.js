const pool   = require('../config/database');
const QRCode = require('qrcode');
const path   = require('path');
const fs     = require('fs');

// ── QR Helper: generates real scannable QR using actual request host ──
async function generateQR(batchId, req) {
  const qrDir = path.join(__dirname, '../public/qrcodes');
  if (!fs.existsSync(qrDir)) fs.mkdirSync(qrDir, { recursive: true });

  const protocol  = req.protocol || 'http';
  const host      = req.get('host') || `localhost:${process.env.PORT || 3000}`;
  const verifyUrl = `${protocol}://${host}/verify/${encodeURIComponent(batchId)}`;
  const filePath  = path.join(qrDir, `${batchId}.png`);

  await QRCode.toFile(filePath, verifyUrl, {
    errorCorrectionLevel: 'H',
    type:   'png',
    width:  400,
    margin: 3,
    color:  { dark: '#000000', light: '#ffffff' }
  });

  return { filePath, publicPath: `/qrcodes/${batchId}.png`, verifyUrl };
}

// GET /qr/api/:batchId  — returns JSON with base64 dataUrl
exports.getQRDataUrl = async (req, res) => {
  const { batchId } = req.params;
  try {
    const protocol  = req.protocol || 'http';
    const host      = req.get('host') || `localhost:${process.env.PORT || 3000}`;
    const verifyUrl = `${protocol}://${host}/verify/${encodeURIComponent(batchId)}`;
    const dataUrl   = await QRCode.toDataURL(verifyUrl, {
      errorCorrectionLevel: 'H', width: 300, margin: 2,
      color: { dark: '#000000', light: '#ffffff' }
    });
    res.json({ success: true, dataUrl, verifyUrl, batchId });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// GET /medicines/qr/view/:batchId  — serves PNG image directly
exports.viewQR = async (req, res) => {
  const { batchId } = req.params;
  try {
    const protocol  = req.protocol || 'http';
    const host      = req.get('host') || `localhost:${process.env.PORT || 3000}`;
    const verifyUrl = `${protocol}://${host}/verify/${encodeURIComponent(batchId)}`;
    const buffer    = await QRCode.toBuffer(verifyUrl, {
      errorCorrectionLevel: 'H', type: 'png', width: 400, margin: 3,
      color: { dark: '#000000', light: '#ffffff' }
    });
    res.set('Content-Type', 'image/png');
    res.send(buffer);
  } catch (err) {
    res.status(500).send('QR generation failed');
  }
};

// POST /medicines/qr/regenerate/:batchId
exports.regenerateQR = async (req, res) => {
  if (!req.session.user) return res.redirect('/login');
  const { batchId } = req.params;
  try {
    const qr = await generateQR(batchId, req);
    await pool.query('UPDATE medicines SET qr_code_path=$1 WHERE batch_id=$2', [qr.publicPath, batchId]);
    req.flash('success', `QR regenerated for ${batchId}`);
  } catch (err) {
    req.flash('error', err.message);
  }
  res.redirect('/medicines');
};

// GET /medicines
exports.listMedicines = async (req, res) => {
  if (!req.session.user) return res.redirect('/login');
  const user = req.session.user;
  try {
    let query = 'SELECT * FROM medicines ORDER BY created_at DESC';
    let params = [];
    if (user.role === 'manufacturer') {
      query  = 'SELECT * FROM medicines WHERE manufacturer_id=$1 ORDER BY created_at DESC';
      params = [user.id];
    }
    const result = await pool.query(query, params);
    res.render('medicines', { medicines: result.rows, user });
  } catch (err) {
    req.flash('error', err.message);
    res.redirect('/dashboard');
  }
};

// GET /medicines/add
exports.showAddMedicine = (req, res) => {
  if (!req.session.user) return res.redirect('/login');
  res.render('addMedicine');
};

// POST /medicines/add
exports.addMedicine = async (req, res) => {
  if (!req.session.user) return res.redirect('/login');
  const user = req.session.user;
  const {
    batch_id, medicine_name, manufacturer_name,
    manufacturing_date, expiry_date, quantity,
    package_type, storage_condition, temperature_requirement,
    description, dosage_form, active_ingredient
  } = req.body;

  try {
    // Duplicate check
    const exists = await pool.query('SELECT id FROM medicines WHERE batch_id=$1', [batch_id]);
    if (exists.rows.length) {
      await pool.query(
        "INSERT INTO alerts (batch_id, alert_type, severity, message) VALUES ($1,'COUNTERFEIT','CRITICAL',$2)",
        [batch_id, `Duplicate Batch ID: ${batch_id} — possible counterfeit`]
      );
      req.flash('error', 'Batch ID already exists! Counterfeit alert raised.');
      return res.redirect('/medicines/add');
    }

    // Generate real QR code
    const qr = await generateQR(batch_id, req);

    // Insert medicine
    await pool.query(
      `INSERT INTO medicines
         (batch_id, medicine_name, manufacturer_name, manufacturer_id,
          manufacturing_date, expiry_date, quantity,
          package_type, storage_condition, temperature_requirement,
          qr_code_path, description, dosage_form, active_ingredient)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
      [
        batch_id, medicine_name, manufacturer_name, user.id,
        manufacturing_date, expiry_date, parseInt(quantity),
        package_type||null, storage_condition||null, temperature_requirement||null,
        qr.publicPath, description||null, dosage_form||null, active_ingredient||null
      ]
    );

    // Seed inventory
    await pool.query(
      'INSERT INTO inventory (batch_id, owner_id, owner_role, quantity) VALUES ($1,$2,$3,$4)',
      [batch_id, user.id, user.role, parseInt(quantity)]
    );

    // Expiry alert
    if (new Date(expiry_date) <= new Date()) {
      await pool.query(
        "INSERT INTO alerts (batch_id, alert_type, severity, message) VALUES ($1,'EXPIRED','HIGH',$2)",
        [batch_id, `Batch ${batch_id} is already expired`]
      );
    }

    req.flash('success', `Batch "${batch_id}" registered! QR code generated. Scan URL: ${qr.verifyUrl}`);
    res.redirect('/medicines');
  } catch (err) {
    console.error('[Medicine] Add error:', err.message);
    req.flash('error', 'Error: ' + err.message);
    res.redirect('/medicines/add');
  }
};

// GET /verify  and  GET /verify/:batchId
exports.verifyMedicine = async (req, res) => {
  const batchId = req.params.batchId || req.body.batch_id;
  if (!batchId) return res.render('verifyMedicine', { result: null });

  try {
    const med = await pool.query('SELECT * FROM medicines WHERE batch_id=$1', [batchId.trim()]);
    if (!med.rows.length) {
      return res.render('verifyMedicine', { result: { found: false, batch_id: batchId } });
    }

    const medicine = med.rows[0];

    // Generate fresh QR as base64 — no file path dependency
    const protocol  = req.protocol || 'http';
    const host      = req.get('host') || `localhost:${process.env.PORT || 3000}`;
    const verifyUrl = `${protocol}://${host}/verify/${encodeURIComponent(batchId)}`;
    const qrDataUrl = await QRCode.toDataURL(verifyUrl, {
      errorCorrectionLevel: 'H', width: 250, margin: 2,
      color: { dark: '#000000', light: '#ffffff' }
    });

    const tests = await pool.query(
      `SELECT mt.*, u.username AS inspector_name
       FROM medicine_tests mt JOIN users u ON mt.inspector_id=u.id
       WHERE mt.batch_id=$1 ORDER BY mt.tested_at DESC`, [batchId]
    );
    const supply = await pool.query(
      `SELECT sc.*,
         s.username AS sender_name,   s.organization AS sender_org,
         r.username AS receiver_name, r.organization AS receiver_org
       FROM supply_chain sc
       JOIN users s ON sc.sender_id=s.id JOIN users r ON sc.receiver_id=r.id
       WHERE sc.batch_id=$1 ORDER BY sc.transfer_date ASC`, [batchId]
    );
    const alertsRes = await pool.query(
      'SELECT * FROM alerts WHERE batch_id=$1 ORDER BY created_at DESC', [batchId]
    );

    let authStatus = 'AUTHENTIC';
    if (alertsRes.rows.some(a => a.alert_type === 'COUNTERFEIT')) authStatus = 'COUNTERFEIT';
    else if (tests.rows.some(t => t.test_result === 'DEFECTIVE')) authStatus = 'DEFECTIVE';
    else if (medicine.status === 'rejected')                       authStatus = 'REJECTED';
    else if (new Date(medicine.expiry_date) < new Date())          authStatus = 'EXPIRED';

    res.render('verifyMedicine', {
      result: {
        found: true, medicine,
        tests: tests.rows, supply: supply.rows,
        alerts: alertsRes.rows,
        authStatus, qrDataUrl, verifyUrl
      }
    });
  } catch (err) {
    console.error('[Verify] Error:', err.message);
    res.render('verifyMedicine', { result: { found: false, error: err.message } });
  }
};
