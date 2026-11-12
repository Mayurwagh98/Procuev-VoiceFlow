const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const isProduction = process.env.NODE_ENV === 'production';
const connectionString = process.env.DATABASE_URL;

const pool = new Pool({
  connectionString,
  ssl:
    isProduction || (connectionString && connectionString.includes('sslmode=require'))
      ? { rejectUnauthorized: false }
      : false,
});

pool.on('error', (err) => {
  console.error('Unexpected PostgreSQL pool error:', err.message);
});

async function initDb() {
  const schemaPath = path.join(__dirname, 'schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');
  await pool.query(schemaSql);
}

async function checkHealth() {
  const result = await pool.query('SELECT NOW() AS server_time');
  return result.rows[0];
}

module.exports = {
  pool,
  initDb,
  checkHealth,
};
