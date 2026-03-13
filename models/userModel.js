const pool = require('../config/database');

const UserModel = {
  async findById(id) {
    const r = await pool.query('SELECT * FROM users WHERE id=$1', [id]);
    return r.rows[0] || null;
  },
  async findByEmail(email) {
    const r = await pool.query('SELECT * FROM users WHERE email=$1', [email]);
    return r.rows[0] || null;
  },
  async getAll() {
    const r = await pool.query('SELECT id,username,email,role,organization,created_at FROM users ORDER BY created_at DESC');
    return r.rows;
  },
  async getByRole(role) {
    const r = await pool.query('SELECT id,username,email,role,organization FROM users WHERE role=$1', [role]);
    return r.rows;
  }
};

module.exports = UserModel;
