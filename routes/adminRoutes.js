const express = require('express');
const router  = express.Router();
const pool    = require('../config/database');
const alert   = require('../controllers/alertController');

// ── Admin middleware ───────────────────────────────────────────
const isAdmin = (req, res, next) => {
  if (!req.session.user || req.session.user.role !== 'admin') {
    req.flash('error', 'Admin access required');
    return res.redirect('/dashboard');
  }
  next();
};

// ── Alert management ───────────────────────────────────────────
router.get('/alerts',                 isAdmin, alert.listAlerts);
router.post('/alerts/:id/resolve',    isAdmin, alert.resolveAlert);

// ── Analytics dashboard ────────────────────────────────────────
router.get('/analytics', isAdmin, async (req, res) => {
  try {
    const [totalMeds, totalTests, defective, totalAlerts,
           byStatus, bySeverity, monthlyTests, recentAlerts, allUsers] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM medicines'),
      pool.query('SELECT COUNT(*) FROM medicine_tests'),
      pool.query("SELECT COUNT(*) FROM medicine_tests WHERE test_result='DEFECTIVE'"),
      pool.query('SELECT COUNT(*) FROM alerts'),
      pool.query("SELECT status, COUNT(*) FROM medicines GROUP BY status"),
      pool.query("SELECT severity, COUNT(*) FROM alerts GROUP BY severity"),
      pool.query(`
        SELECT TO_CHAR(DATE_TRUNC('month', tested_at), 'Mon YY') AS month,
               COUNT(*) AS count
        FROM medicine_tests
        GROUP BY DATE_TRUNC('month', tested_at)
        ORDER BY DATE_TRUNC('month', tested_at) DESC
        LIMIT 6`),
      pool.query("SELECT * FROM alerts ORDER BY created_at DESC LIMIT 10"),
      pool.query("SELECT role, COUNT(*) FROM users GROUP BY role")
    ]);

    res.render('adminAnalytics', {
      user: req.session.user,
      stats: {
        totalMeds:   parseInt(totalMeds.rows[0].count),
        totalTests:  parseInt(totalTests.rows[0].count),
        defective:   parseInt(defective.rows[0].count),
        totalAlerts: parseInt(totalAlerts.rows[0].count)
      },
      byStatus:     byStatus.rows,
      bySeverity:   bySeverity.rows,
      monthlyTests: monthlyTests.rows,
      recentAlerts: recentAlerts.rows,
      allUsers:     allUsers.rows
    });
  } catch (err) {
    console.error('[Admin] Analytics error:', err.message);
    req.flash('error', err.message);
    res.redirect('/dashboard');
  }
});

// ── User management ────────────────────────────────────────────
router.get('/users', isAdmin, async (req, res) => {
  const users = await pool.query(
    'SELECT id, username, email, role, organization, created_at FROM users ORDER BY created_at DESC'
  );
  res.render('adminUsers', { users: users.rows, user: req.session.user });
});

// ── Inventory overview ─────────────────────────────────────────
router.get('/inventory', isAdmin, async (req, res) => {
  const inventory = await pool.query(`
    SELECT i.*, m.medicine_name, m.expiry_date, m.status AS med_status,
           u.username AS owner_name, u.organization
    FROM inventory i
    JOIN medicines m ON i.batch_id = m.batch_id
    JOIN users     u ON i.owner_id  = u.id
    ORDER BY m.medicine_name, u.username`);
  res.render('adminInventory', { inventory: inventory.rows, user: req.session.user });
});

// ── WHO Mock API ───────────────────────────────────────────────
router.get('/api/who-verify/:batchId', async (req, res) => {
  const { batchId } = req.params;
  try {
    const med = await pool.query('SELECT * FROM medicines WHERE batch_id=$1', [batchId]);
    if (!med.rows.length) {
      return res.json({
        verified: false,
        message: 'Batch ID not found in WHO pharmaceutical database simulation',
        checked_at: new Date().toISOString()
      });
    }
    const m = med.rows[0];
    res.json({
      verified: true,
      message:  'Verified in WHO pharmaceutical database simulation',
      batch_id: m.batch_id,
      medicine: m.medicine_name,
      manufacturer: m.manufacturer_name,
      status:   m.status,
      expiry:   m.expiry_date,
      checked_at: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
