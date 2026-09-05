require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const pool = new Pool({
  host: process.env.DB_HOST, port: process.env.DB_PORT, user: process.env.DB_USER,
  password: process.env.DB_PASSWORD, database: process.env.DB_NAME,
  ssl: { rejectUnauthorized: false }, options: '-c search_path=expenses_control',
  connectionTimeoutMillis: 20000,
});
(async () => {
  const sql = fs.readFileSync('migrations/018_budget_type_cycle.sql', 'utf8');
  await pool.query(sql);
  console.log('Migration 018 applied');
  await pool.end();
})().catch(e => { console.error(e.message); process.exit(1); });
