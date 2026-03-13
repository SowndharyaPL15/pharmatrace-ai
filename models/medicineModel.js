const pool = require('../config/database');

const MedicineModel = {
  async findByBatchId(batch_id) {
    const r = await pool.query('SELECT * FROM medicines WHERE batch_id=$1', [batch_id]);
    return r.rows[0] || null;
  },
  async getAll() {
    const r = await pool.query('SELECT * FROM medicines ORDER BY created_at DESC');
    return r.rows;
  },
  async getByManufacturer(manufacturer_id) {
    const r = await pool.query('SELECT * FROM medicines WHERE manufacturer_id=$1 ORDER BY created_at DESC', [manufacturer_id]);
    return r.rows;
  },
  async updateStatus(batch_id, status) {
    await pool.query('UPDATE medicines SET status=$1 WHERE batch_id=$2', [status, batch_id]);
  },
  async getStats() {
    const total    = await pool.query('SELECT COUNT(*) FROM medicines');
    const approved = await pool.query("SELECT COUNT(*) FROM medicines WHERE status='approved'");
    const rejected = await pool.query("SELECT COUNT(*) FROM medicines WHERE status='rejected'");
    const pending  = await pool.query("SELECT COUNT(*) FROM medicines WHERE status='pending'");
    const expired  = await pool.query("SELECT COUNT(*) FROM medicines WHERE expiry_date < NOW()");
    return {
      total:    parseInt(total.rows[0].count),
      approved: parseInt(approved.rows[0].count),
      rejected: parseInt(rejected.rows[0].count),
      pending:  parseInt(pending.rows[0].count),
      expired:  parseInt(expired.rows[0].count)
    };
  }
};

module.exports = MedicineModel;
