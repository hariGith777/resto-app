import fs from 'fs';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const connectionString = process.env.DATABASE_URL ||
  (process.env.DB_HOST && `postgresql://${process.env.DB_USER}:${encodeURIComponent(process.env.DB_PASSWORD)}@${process.env.DB_HOST}:${process.env.DB_PORT || 5432}/${process.env.DB_NAME}?sslmode=${process.env.DB_SSLMODE || 'disable'}`);

// SSL configuration - allow self-signed chain, but supply CA when provided
let sslOption = false;
const sslmode = process.env.DB_SSLMODE || (connectionString && connectionString.includes('sslmode=') ? connectionString.split('sslmode=')[1].split('&')[0] : 'disable');
const shouldUseSsl = sslmode && sslmode !== 'disable';
if (shouldUseSsl) {
  const caPath = process.env.DB_SSL_CA;
  if (caPath && fs.existsSync(caPath)) {
    const ca = fs.readFileSync(caPath);
    sslOption = { ca, rejectUnauthorized: false };
    console.warn(`DB SSL: Using CA from ${caPath} with rejectUnauthorized=false`);
  } else {
    sslOption = { rejectUnauthorized: false };
    console.warn(`DB SSL: No CA provided, using rejectUnauthorized=false`);
  }
}

const poolConfig = connectionString ? { connectionString } : {};
if (sslOption) poolConfig.ssl = sslOption;

const pool = new Pool(poolConfig);

pool.on('error', (err) => {
  console.error('Unexpected idle client error', err);
});

export const query = (text, params) => pool.query(text, params);
export const db = { pool, query };
export default db;
