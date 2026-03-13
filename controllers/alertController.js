const pool = require('../config/database');

// ── List alerts ────────────────────────────────────────────────
exports.listAlerts = async (req, res) => {
  if (!req.session.user) return res.redirect('/login');
  try {
    const alerts = await pool.query(
      'SELECT * FROM alerts ORDER BY created_at DESC'
    );
    res.render('alerts', { alerts: alerts.rows, user: req.session.user });
  } catch (err) {
    req.flash('error', err.message);
    res.redirect('/dashboard');
  }
};

// ── Resolve alert ──────────────────────────────────────────────
exports.resolveAlert = async (req, res) => {
  if (!req.session.user) return res.redirect('/login');
  try {
    await pool.query(
      'UPDATE alerts SET resolved=true, resolved_by=$1, resolved_at=NOW() WHERE id=$2',
      [req.session.user.id, req.params.id]
    );
    req.flash('success', 'Alert resolved');
  } catch (err) {
    req.flash('error', err.message);
  }
  res.redirect('/admin/alerts');
};

// ── Automation engine ──────────────────────────────────────────
exports.runAutomation = async () => {
  try {
    console.log('[Automation] Running scheduled quality checks...');

    // 1. Detect expired medicines
    const expired = await pool.query(
      "SELECT batch_id, medicine_name FROM medicines WHERE expiry_date < NOW() AND status != 'rejected'"
    );
    let expiredCount = 0;
    for (const m of expired.rows) {
      const exists = await pool.query(
        "SELECT id FROM alerts WHERE batch_id=$1 AND alert_type='EXPIRED' AND resolved=false",
        [m.batch_id]
      );
      if (!exists.rows.length) {
        await pool.query(
          `INSERT INTO alerts (batch_id, alert_type, severity, message)
           VALUES ($1,'EXPIRED','HIGH',$2)`,
          [m.batch_id, `Batch ${m.batch_id} (${m.medicine_name}) has passed its expiry date — remove from circulation`]
        );
        expiredCount++;
      }
    }

    // 2. Detect low purity (unresolved)
    const lowPurity = await pool.query(
      "SELECT DISTINCT batch_id FROM medicine_tests WHERE purity_percentage < 80 AND test_result='DEFECTIVE'"
    );
    let purityCount = 0;
    for (const t of lowPurity.rows) {
      const exists = await pool.query(
        "SELECT id FROM alerts WHERE batch_id=$1 AND alert_type='LOW_PURITY' AND resolved=false",
        [t.batch_id]
      );
      if (!exists.rows.length) {
        await pool.query(
          `INSERT INTO alerts (batch_id, alert_type, severity, message)
           VALUES ($1,'LOW_PURITY','HIGH',$2)`,
          [t.batch_id, `Batch ${t.batch_id} has low purity readings — below 80% threshold`]
        );
        purityCount++;
      }
    }

    // 3. Detect stagnant approved medicines (>30 days, no supply movement)
    const stagnant = await pool.query(`
      SELECT m.batch_id, m.medicine_name FROM medicines m
      WHERE m.status = 'approved'
        AND m.created_at < NOW() - INTERVAL '30 days'
        AND m.batch_id NOT IN (SELECT DISTINCT batch_id FROM supply_chain)
    `);
    let stagnantCount = 0;
    for (const s of stagnant.rows) {
      const exists = await pool.query(
        "SELECT id FROM alerts WHERE batch_id=$1 AND alert_type='STAGNANT' AND resolved=false",
        [s.batch_id]
      );
      if (!exists.rows.length) {
        await pool.query(
          `INSERT INTO alerts (batch_id, alert_type, severity, message)
           VALUES ($1,'STAGNANT','MEDIUM',$2)`,
          [s.batch_id, `Batch ${s.batch_id} approved 30+ days ago with no supply chain movement`]
        );
        stagnantCount++;
      }
    }

    console.log(
      `[Automation] Done — Expired: ${expiredCount}, Low purity: ${purityCount}, Stagnant: ${stagnantCount}`
    );
  } catch (err) {
    console.error('[Automation] Error:', err.message);
  }
};
