require('dotenv').config();
const express  = require('express');
const session  = require('express-session');
const flash    = require('connect-flash');
const path     = require('path');

const authRoutes     = require('./routes/authRoutes');
const medicineRoutes = require('./routes/medicineRoutes');
const testingRoutes  = require('./routes/testingRoutes');
const supplyRoutes   = require('./routes/supplyRoutes');
const adminRoutes    = require('./routes/adminRoutes');
const { runAutomation } = require('./controllers/alertController');

const app = express();

// ── View Engine ────────────────────────────────────────────────
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ── Middleware ─────────────────────────────────────────────────
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── Session ────────────────────────────────────────────────────
app.use(session({
  secret: process.env.SESSION_SECRET || 'pharma_secret_key',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 8 * 60 * 60 * 1000 }
}));

// ── Flash messages ─────────────────────────────────────────────
app.use(flash());

// ── Global template locals ─────────────────────────────────────
app.use((req, res, next) => {
  res.locals.user    = req.session.user || null;
  res.locals.success = req.flash('success');
  res.locals.error   = req.flash('error');
  next();
});

// ── Routes ─────────────────────────────────────────────────────
app.use('/',          authRoutes);
app.use('/medicines', medicineRoutes);
app.use('/testing',   testingRoutes);
app.use('/supply',    supplyRoutes);
app.use('/admin',     adminRoutes);

// ── Real-time QR API (public, no login required) ───────────────
const { getQRDataUrl, verifyMedicine } = require('./controllers/medicineController');
app.get('/qr/api/:batchId', getQRDataUrl);   // returns JSON { dataUrl, verifyUrl }

// ── Public verify routes ───────────────────────────────────────
app.get('/verify',          (req, res) => res.render('verifyMedicine', { result: null }));
app.post('/verify',         verifyMedicine);
app.get('/verify/:batchId', verifyMedicine);

// ── Root redirect ──────────────────────────────────────────────
app.get('/', (req, res) => {
  res.redirect(req.session.user ? '/dashboard' : '/login');
});

// ── 404 ────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).render('404');
});

// ── Global error handler ───────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('[Error]', err.stack);
  req.flash('error', 'An unexpected error occurred.');
  res.redirect('/dashboard');
});

// ── Automation engine (runs hourly) ───────────────────────────
runAutomation();
setInterval(runAutomation, 60 * 60 * 1000);

// ── Start server ───────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('\n╔══════════════════════════════════════════╗');
  console.log('║       💊  PharmaTrace AI  Started        ║');
  console.log('╚══════════════════════════════════════════╝');
  console.log(`  🌐  App        → http://localhost:${PORT}`);
  console.log(`  🔍  Verify     → http://localhost:${PORT}/verify`);
  console.log(`  📱  QR API     → http://localhost:${PORT}/qr/api/:batchId`);
  console.log(`  🤖  AI Service → http://localhost:5001`);
  console.log(`  📊  Analytics  → http://localhost:${PORT}/admin/analytics\n`);
});
