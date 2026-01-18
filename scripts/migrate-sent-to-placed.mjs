import pg from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

const { Pool } = pg;

const connectionString = process.env.DATABASE_URL ||
  `postgresql://${process.env.DB_USER}:${encodeURIComponent(process.env.DB_PASSWORD)}@${process.env.DB_HOST}:${process.env.DB_PORT || 5432}/${process.env.DB_NAME}?sslmode=${process.env.DB_SSLMODE || 'disable'}`;

let sslOption = false;
const sslmode = process.env.DB_SSLMODE || 'disable';
const shouldUseSsl = sslmode && sslmode !== 'disable';
if (shouldUseSsl) {
  const caPath = process.env.DB_SSL_CA;
  if (caPath && fs.existsSync(caPath)) {
    const ca = fs.readFileSync(caPath);
    sslOption = { ca, rejectUnauthorized: false };
  } else {
    sslOption = { rejectUnauthorized: false };
  }
}

const poolConfig = connectionString ? { connectionString } : {};
if (sslOption) poolConfig.ssl = sslOption;

const db = new Pool(poolConfig);

async function migrateSentToPlaced() {
  console.log('🔄 Migrating KOT status from SENT to PLACED\n');

  try {
    // Check current SENT KOTs
    const sentKots = await db.query(`
      SELECT COUNT(*) as count
      FROM kots
      WHERE status = 'SENT'
    `);
    
    console.log(`Found ${sentKots.rows[0].count} KOTs with SENT status`);

    if (sentKots.rows[0].count > 0) {
      // Update SENT to PLACED
      const result = await db.query(`
        UPDATE kots
        SET status = 'PLACED'
        WHERE status = 'SENT'
      `);
      
      console.log(`✅ Updated ${result.rowCount} KOTs from SENT to PLACED`);
    } else {
      console.log('ℹ️  No KOTs to migrate');
    }

    // Verify the update
    const placedKots = await db.query(`
      SELECT COUNT(*) as count
      FROM kots
      WHERE status = 'PLACED'
    `);
    
    console.log(`\nNow ${placedKots.rows[0].count} KOTs with PLACED status`);

  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    await db.end();
  }
}

migrateSentToPlaced();
