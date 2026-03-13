const pool  = require('../config/database');
const axios = require('axios');

// ── Show test form ─────────────────────────────────────────────
exports.showTestForm = async (req, res) => {
  if (!req.session.user) return res.redirect('/login');
  try {
    const medicines = await pool.query(
      "SELECT batch_id, medicine_name FROM medicines WHERE status='pending' ORDER BY created_at DESC"
    );
    const allTests = await pool.query(
      `SELECT mt.*, u.username AS inspector_name, m.medicine_name
       FROM medicine_tests mt
       JOIN users u ON mt.inspector_id = u.id
       JOIN medicines m ON mt.batch_id = m.batch_id
       ORDER BY mt.tested_at DESC LIMIT 20`
    );
    res.render('testMedicine', { medicines: medicines.rows, tests: allTests.rows, user: req.session.user });
  } catch (err) {
    req.flash('error', err.message);
    res.redirect('/dashboard');
  }
};

// ── Submit test ────────────────────────────────────────────────
exports.submitTest = async (req, res) => {
  if (!req.session.user) return res.redirect('/login');
  const {
    batch_id, purity_percentage, ph_level,
    sterility_status, contamination_flag,
    dissolution_rate, moisture_content,
    notes, lab_name
  } = req.body;

  const inspector_id  = req.session.user.id;
  const purity        = parseFloat(purity_percentage);
  const ph            = parseFloat(ph_level);
  const sterile       = sterility_status  === 'true'  || sterility_status  === 'pass';
  const contaminated  = contamination_flag === 'true'  || contamination_flag === 'yes';
  const dissolution   = dissolution_rate  ? parseFloat(dissolution_rate)  : null;
  const moisture      = moisture_content  ? parseFloat(moisture_content)  : null;

  // ── Quality algorithm ──────────────────────────────────────
  let test_result = 'SAFE';
  if (purity < 80 || !sterile || contaminated) {
    test_result = 'DEFECTIVE';
  }

  try {
    await pool.query(
      `INSERT INTO medicine_tests
         (batch_id, inspector_id, purity_percentage, ph_level,
          sterility_status, contamination_flag,
          dissolution_rate, moisture_content,
          test_result, notes, lab_name)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [batch_id, inspector_id, purity, ph,
       sterile, contaminated,
       dissolution, moisture,
       test_result, notes, lab_name]
    );

    // Update medicine approval status
    const newStatus = test_result === 'SAFE' ? 'approved' : 'rejected';
    await pool.query('UPDATE medicines SET status=$1 WHERE batch_id=$2', [newStatus, batch_id]);

    // ── Create alerts if defective ──
    if (test_result === 'DEFECTIVE') {
      if (purity < 80) {
        await pool.query(
          `INSERT INTO alerts (batch_id, alert_type, severity, message)
           VALUES ($1,'LOW_PURITY','HIGH',$2)`,
          [batch_id, `Low purity detected in batch ${batch_id}: ${purity}% (minimum: 80%)`]
        );
      }
      if (!sterile) {
        await pool.query(
          `INSERT INTO alerts (batch_id, alert_type, severity, message)
           VALUES ($1,'STERILITY_FAIL','CRITICAL',$2)`,
          [batch_id, `Sterility test FAILED for batch ${batch_id} — batch quarantined`]
        );
      }
      if (contaminated) {
        await pool.query(
          `INSERT INTO alerts (batch_id, alert_type, severity, message)
           VALUES ($1,'CONTAMINATION','CRITICAL',$2)`,
          [batch_id, `Contamination detected in batch ${batch_id} — immediate action required`]
        );
      }
    }

    // ── Call AI service ────────────────────────────────────
    try {
      const aiRes = await axios.post(
        `${process.env.AI_SERVICE_URL}/analyze`,
        {
          batch_id,
          purity_percentage: purity,
          ph_level: ph,
          sterility_status:  sterile ? 1 : 0,
          contamination_flag: contaminated ? 1 : 0,
          dissolution_rate:  dissolution || 0,
          moisture_content:  moisture || 0
        },
        { timeout: 3000 }
      );

      // Store AI risk level in test record
      if (aiRes.data && aiRes.data.risk_level) {
        await pool.query(
          'UPDATE medicine_tests SET ai_risk_level=$1 WHERE batch_id=$2 AND inspector_id=$3 ORDER BY tested_at DESC LIMIT 1',
          [aiRes.data.risk_level, batch_id, inspector_id]
        );

        if (aiRes.data.is_anomaly) {
          await pool.query(
            `INSERT INTO alerts (batch_id, alert_type, severity, message)
             VALUES ($1,'AI_ANOMALY',$2,$3)`,
            [batch_id, aiRes.data.risk_level,
             `AI anomaly detected in batch ${batch_id} — Score: ${aiRes.data.anomaly_score.toFixed(4)}`]
          );
        }
      }
    } catch (aiErr) {
      console.log('[AI] Service unavailable:', aiErr.message);
    }

    req.flash('success', `Test submitted. Result: ${test_result} | Status → ${newStatus.toUpperCase()}`);
    res.redirect('/testing');
  } catch (err) {
    console.error('[Test] Submit error:', err.message);
    req.flash('error', 'Test submission failed: ' + err.message);
    res.redirect('/testing');
  }
};
