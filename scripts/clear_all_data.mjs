#!/usr/bin/env node
/**
 * Clear all data from database tables for fresh testing
 * This script truncates all tables but keeps the schema intact
 */

import { db } from '../src/common/db.js';

async function clearAllData() {
  try {
    console.log('🗑️  Starting data cleanup...\n');

    // Order matters due to foreign key constraints - delete in reverse dependency order
    const tables = [
      'order_items',
      'orders',
      'menu_modifiers',
      'menu_portions',
      'menu_items',
      'menu_categories',
      'customer_sessions',
      'customer_profiles',
      'tables',
      'areas',
      'staff',
      'branches',
      'restaurants',
      'websocket_connections',
      'ai_knowledge_base'
    ];

    console.log('Tables to clear:');
    tables.forEach(table => console.log(`  - ${table}`));
    console.log();

    for (const table of tables) {
      try {
        const countBefore = await db.query(`SELECT COUNT(*) FROM ${table}`);
        await db.query(`TRUNCATE TABLE ${table} CASCADE`);
        console.log(`✓ Cleared ${table} (had ${countBefore.rows[0].count} rows)`);
      } catch (error) {
        // Table might not exist or might be empty
        console.log(`⚠ Skipped ${table}: ${error.message}`);
      }
    }

    console.log('\n✅ Data cleanup completed successfully!');
    console.log('\n📝 Note: Database schema is intact, only data was removed.');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    process.exit(1);
  }
}

// Confirmation prompt
console.log('⚠️  WARNING: This will DELETE ALL DATA from the database!');
console.log('Schema will remain intact, but all records will be removed.\n');

const args = process.argv.slice(2);
if (!args.includes('--confirm')) {
  console.log('To proceed, run: node scripts/clear_all_data.mjs --confirm');
  process.exit(0);
}

clearAllData();
