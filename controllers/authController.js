const bcrypt = require('bcrypt');
const pool   = require('../config/database');

// ── Show login page ────────────────────────────────────────────
exports.showLogin = (req, res) => {
  if (req.session.user) return res.redirect('/dashboard');
  res.render('login');
};

// ── Show register page ─────────────────────────────────────────
exports.showRegister = (req, res) => {
  if (req.session.user) return res.redirect('/dashboard');
  res.render('register');
};

// ── Register ───────────────────────────────────────────────────
exports.register = async (req, res) => {
  const { username, email, password, confirm_password, role, organization, phone } = req.body;

  if (password !== confirm_password) {
    req.flash('error', 'Passwords do not match');
    return res.redirect('/register');
  }

  try {
    const existing = await pool.query(
      'SELECT id FROM users WHERE email=$1 OR username=$2', [email, username]
    );
    if (existing.rows.length) {
      req.flash('error', 'Email or username already in use');
      return res.redirect('/register');
    }

    const hash = await bcrypt.hash(password, 10);
    await pool.query(
      `INSERT INTO users (username, email, password_hash, role, organization, phone)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [username, email, hash, role, organization || null, phone || null]
    );

    req.flash('success', 'Account created successfully. Please log in.');
    res.redirect('/login');
  } catch (err) {
    console.error('[Auth] Register error:', err.message);
    req.flash('error', 'Registration failed: ' + err.message);
    res.redirect('/register');
  }
};

// ── Login ──────────────────────────────────────────────────────
exports.login = async (req, res) => {
  const { email, password } = req.body;
  try {
    const result = await pool.query('SELECT * FROM users WHERE email=$1', [email]);
    if (!result.rows.length) {
      req.flash('error', 'No account found with that email');
      return res.redirect('/login');
    }

    const user  = result.rows[0];
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      req.flash('error', 'Incorrect password');
      return res.redirect('/login');
    }

    req.session.user = {
      id:           user.id,
      username:     user.username,
      email:        user.email,
      role:         user.role,
      organization: user.organization
    };

    req.flash('success', `Welcome back, ${user.username}!`);
    res.redirect('/dashboard');
  } catch (err) {
    console.error('[Auth] Login error:', err.message);
    req.flash('error', 'Login error. Please try again.');
    res.redirect('/login');
  }
};

// ── Logout ─────────────────────────────────────────────────────
exports.logout = (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
};

// ── Dashboard ──────────────────────────────────────────────────
exports.dashboard = async (req, res) => {
  if (!req.session.user) return res.redirect('/login');
  const user = req.session.user;

  try {
    let medicineQuery = 'SELECT * FROM medicines ORDER BY created_at DESC LIMIT 10';
    let medParams     = [];

    if (user.role === 'manufacturer') {
      medicineQuery = 'SELECT * FROM medicines WHERE manufacturer_id=$1 ORDER BY created_at DESC LIMIT 10';
      medParams     = [user.id];
    }

    const medicines   = await pool.query(medicineQuery, medParams);
    const alerts      = await pool.query(
      "SELECT * FROM alerts WHERE resolved=false ORDER BY created_at DESC LIMIT 6"
    );

    // Stats for mini-dashboard
    const totalMeds   = await pool.query('SELECT COUNT(*) FROM medicines');
    const totalTests  = await pool.query('SELECT COUNT(*) FROM medicine_tests');
    const totalAlerts = await pool.query("SELECT COUNT(*) FROM alerts WHERE resolved=false");
    const defective   = await pool.query("SELECT COUNT(*) FROM medicine_tests WHERE test_result='DEFECTIVE'");

    res.render('dashboard', {
      user,
      medicines:   medicines.rows,
      alerts:      alerts.rows,
      stats: {
        totalMeds:   totalMeds.rows[0].count,
        totalTests:  totalTests.rows[0].count,
        totalAlerts: totalAlerts.rows[0].count,
        defective:   defective.rows[0].count
      }
    });
  } catch (err) {
    console.error('[Dashboard] Error:', err.message);
    res.render('dashboard', { user, medicines: [], alerts: [], stats: {} });
  }
};
