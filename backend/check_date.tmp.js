require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({
  host: process.env.DB_HOST, port: process.env.DB_PORT, user: process.env.DB_USER,
  password: process.env.DB_PASSWORD, database: process.env.DB_NAME,
  ssl: { rejectUnauthorized: false }, options: '-c search_path=expenses_control',
  connectionTimeoutMillis: 20000,
});
(async () => {
  const r = await pool.query(
    "SELECT table_name, column_name, data_type FROM information_schema.columns WHERE table_name IN ('positions','income','expenses') AND column_name = 'date' ORDER BY table_name"
  );
  r.rows.forEach(x => console.log(x.table_name, x.column_name, x.data_type));
  await pool.end();
})().catch(e => { console.error(e.message); process.exit(1); });
