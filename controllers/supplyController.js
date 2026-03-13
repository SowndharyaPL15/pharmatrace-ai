const pool = require('../config/database');

// ── Show transfer form ─────────────────────────────────────────
exports.showTransferForm = async (req, res) => {
  if (!req.session.user) return res.redirect('/login');
  const user = req.session.user;
  try {
    // Medicines this user has in inventory with approved status
    const medicines = await pool.query(
      `SELECT m.batch_id, m.medicine_name, i.quantity
       FROM medicines m
       JOIN inventory i ON m.batch_id = i.batch_id
       WHERE i.owner_id=$1 AND m.status='approved' AND i.quantity > 0
       ORDER BY m.medicine_name`,
      [user.id]
    );

    const receivers = await pool.query(
      `SELECT id, username, role, organization
       FROM users WHERE id != $1 ORDER BY role, username`,
      [user.id]
    );

    res.render('supplyChain', { medicines: medicines.rows, receivers: receivers.rows, user });
  } catch (err) {
    req.flash('error', err.message);
    res.redirect('/dashboard');
  }
};

// ── Transfer medicine ──────────────────────────────────────────
exports.transferMedicine = async (req, res) => {
  if (!req.session.user) return res.redirect('/login');
  const sender   = req.session.user;
  const { batch_id, receiver_id, location, quantity, notes } = req.body;
  const qty = parseInt(quantity);

  try {
    const receiver = await pool.query('SELECT * FROM users WHERE id=$1', [receiver_id]);
    if (!receiver.rows.length) throw new Error('Receiver not found');

    // Check sender inventory
    const inv = await pool.query(
      'SELECT * FROM inventory WHERE batch_id=$1 AND owner_id=$2',
      [batch_id, sender.id]
    );
    if (!inv.rows.length || inv.rows[0].quantity < qty) {
      throw new Error(`Insufficient inventory. Available: ${inv.rows[0]?.quantity || 0}`);
    }

    // Check medicine is approved
    const med = await pool.query(
      "SELECT status FROM medicines WHERE batch_id=$1", [batch_id]
    );
    if (med.rows[0]?.status !== 'approved') {
      throw new Error('Only approved medicines can be transferred');
    }

    // Insert supply chain record
    await pool.query(
      `INSERT INTO supply_chain
         (batch_id, sender_id, receiver_id, sender_role, receiver_role, quantity, location, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [batch_id, sender.id, receiver_id, sender.role,
       receiver.rows[0].role, qty, location, notes]
    );

    // Deduct from sender
    await pool.query(
      'UPDATE inventory SET quantity=quantity-$1, updated_at=NOW() WHERE batch_id=$2 AND owner_id=$3',
      [qty, batch_id, sender.id]
    );

    // Add to receiver
    const receiverInv = await pool.query(
      'SELECT id FROM inventory WHERE batch_id=$1 AND owner_id=$2',
      [batch_id, receiver_id]
    );
    if (receiverInv.rows.length) {
      await pool.query(
        'UPDATE inventory SET quantity=quantity+$1, updated_at=NOW() WHERE batch_id=$2 AND owner_id=$3',
        [qty, batch_id, receiver_id]
      );
    } else {
      await pool.query(
        'INSERT INTO inventory (batch_id, owner_id, owner_role, quantity) VALUES ($1,$2,$3,$4)',
        [batch_id, receiver_id, receiver.rows[0].role, qty]
      );
    }

    req.flash('success', `Transfer initiated: ${qty} units of ${batch_id} → ${receiver.rows[0].username}`);
    res.redirect('/supply/history');
  } catch (err) {
    console.error('[Supply] Transfer error:', err.message);
    req.flash('error', err.message);
    res.redirect('/supply');
  }
};

// ── Confirm receipt ────────────────────────────────────────────
exports.confirmReceipt = async (req, res) => {
  if (!req.session.user) return res.redirect('/login');
  const { transfer_id } = req.body;
  try {
    await pool.query(
      'UPDATE supply_chain SET confirmed=true, confirmed_at=NOW() WHERE id=$1 AND receiver_id=$2',
      [transfer_id, req.session.user.id]
    );
    req.flash('success', 'Receipt confirmed successfully');
  } catch (err) {
    req.flash('error', err.message);
  }
  res.redirect('/supply/history');
};

// ── Supply chain history ───────────────────────────────────────
exports.supplyHistory = async (req, res) => {
  if (!req.session.user) return res.redirect('/login');
  const user = req.session.user;
  try {
    let query = `
      SELECT sc.*,
        m.medicine_name,
        s.username AS sender_name,   s.organization AS sender_org,
        r.username AS receiver_name, r.organization AS receiver_org
      FROM supply_chain sc
      JOIN medicines m ON sc.batch_id   = m.batch_id
      JOIN users     s ON sc.sender_id   = s.id
      JOIN users     r ON sc.receiver_id = r.id
      ORDER BY sc.transfer_date DESC`;

    let params = [];
    if (user.role !== 'admin') {
      query = query.replace(
        'ORDER BY',
        'WHERE (sc.sender_id=$1 OR sc.receiver_id=$1) ORDER BY'
      );
      params = [user.id];
    }

    const result = await pool.query(query, params);
    res.render('supplyHistory', { transfers: result.rows, user });
  } catch (err) {
    req.flash('error', err.message);
    res.redirect('/dashboard');
  }
};
