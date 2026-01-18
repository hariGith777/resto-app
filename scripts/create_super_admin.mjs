#!/usr/bin/env node
/**
 * Create Super Admin user in the database
 */

import { db } from '../src/common/db.js';

async function createSuperAdmin() {
  try {
    console.log('🔐 Creating Super Admin user...\n');

    const username = 'admin';
    const name = 'Admin User';
    const phone = '9000000001';

    // Check if super admin already exists
    const existing = await db.query(
      "SELECT id, username, name FROM staff WHERE username = $1 AND role = 'SUPER_ADMIN'",
      [username]
    );

    if (existing.rowCount > 0) {
      console.log('⚠️  Super Admin already exists:');
      console.log(`   Username: ${existing.rows[0].username}`);
      console.log(`   Name: ${existing.rows[0].name}`);
      console.log(`   ID: ${existing.rows[0].id}`);
      console.log('\n✓ No action needed.');
      process.exit(0);
    }

    // Create super admin user
    const result = await db.query(
      `INSERT INTO staff (name, username, role, phone) 
       VALUES ($1, $2, 'SUPER_ADMIN', $3) 
       RETURNING id, name, username, role`,
      [name, username, phone]
    );

    console.log('✅ Super Admin created successfully!\n');
    console.log('Details:');
    console.log(`   Username: ${result.rows[0].username}`);
    console.log(`   Name: ${result.rows[0].name}`);
    console.log(`   Role: ${result.rows[0].role}`);
    console.log(`   ID: ${result.rows[0].id}`);
    console.log('\n📝 Use this username to login via /super-admin/login endpoint');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating super admin:', error);
    process.exit(1);
  }
}

createSuperAdmin();
