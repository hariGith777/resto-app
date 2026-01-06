import dotenv from 'dotenv';
dotenv.config();

import fs from 'fs/promises';
import path from 'path';

const migrationsDir = path.resolve(process.cwd(), 'db', 'migrations');

const dbModule = (await import('../src/libs/db.js')).default;

async function run() {
  console.log('Reading migrations from', migrationsDir);
  const files = (await fs.readdir(migrationsDir)).filter(f => f.endsWith('.sql')).sort();
  if (!files.length) {
    console.log('No migrations found');
    process.exit(0);
  }

  for (const file of files) {
    const full = path.join(migrationsDir, file);
    console.log('Applying', file);
    const sql = await fs.readFile(full, 'utf8');
    // naively split statements by semicolon to avoid sending huge multi-statement payloads
    const stmts = sql.split(';').map(s => s.trim()).filter(Boolean);
    try {
      for (const stmt of stmts) {
        await dbModule.query(stmt);
      }
      console.log('Applied', file);
    } catch (err) {
      console.error('Failed to apply', file, err);
      await dbModule.pool.end?.();
      process.exit(1);
    }
  }

  await dbModule.pool.end?.();
  console.log('All migrations applied');
}

run();
