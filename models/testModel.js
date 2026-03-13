const pool = require('../config/database');

const TestModel = {
  async getByBatchId(batch_id) {
    const r = await pool.query(
      'SELECT mt.*, u.username AS inspector_name FROM medicine_tests mt JOIN users u ON mt.inspector_id=u.id WHERE mt.batch_id=$1 ORDER BY mt.tested_at DESC',
      [batch_id]
    );
    return r.rows;
  },
  async getAll() {
    const r = await pool.query(
      'SELECT mt.*, u.username AS inspector_name, m.medicine_name FROM medicine_tests mt JOIN users u ON mt.inspector_id=u.id JOIN medicines m ON mt.batch_id=m.batch_id ORDER BY mt.tested_at DESC'
    );
    return r.rows;
  },
  async getStats() {
    const total    = await pool.query('SELECT COUNT(*) FROM medicine_tests');
    const safe     = await pool.query("SELECT COUNT(*) FROM medicine_tests WHERE test_result='SAFE'");
    const defective= await pool.query("SELECT COUNT(*) FROM medicine_tests WHERE test_result='DEFECTIVE'");
    return {
      total:    parseInt(total.rows[0].count),
      safe:     parseInt(safe.rows[0].count),
      defective:parseInt(defective.rows[0].count)
    };
  }
};

module.exports = TestModel;
