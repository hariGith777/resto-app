#!/usr/bin/env node

/**
 * Migrate existing staff from database to AWS Cognito
 * 
 * Usage: node scripts/migrate_staff_to_cognito.mjs
 */

import 'dotenv/config';
import { db } from '../src/common/db.js';
import { createCognitoUser } from '../src/common/cognitoAuth.js';

const migrateStaff = async () => {
  console.log('🚀 Starting staff migration to Cognito...\n');

  try {
    // Check required environment variables
    if (!process.env.COGNITO_USER_POOL_ID || !process.env.COGNITO_APP_CLIENT_ID) {
      console.error('❌ Missing Cognito environment variables!');
      console.error('Please set COGNITO_USER_POOL_ID and COGNITO_APP_CLIENT_ID');
      process.exit(1);
    }

    // Fetch all active staff
    const result = await db.query(
      `SELECT s.id, s.name, s.username, s.phone, s.role, s.branch_id, b.restaurant_id 
       FROM staff s 
       LEFT JOIN branches b ON b.id = s.branch_id 
       WHERE s.is_active = true
       ORDER BY s.role, s.name`
    );

    const totalStaff = result.rowCount;
    console.log(`Found ${totalStaff} active staff members\n`);

    let successCount = 0;
    let failCount = 0;
    const failures = [];

    for (const staff of result.rows) {
      try {
        // Generate temporary password for username-based logins
        const temporaryPassword = staff.username 
          ? `Temp${Math.random().toString(36).slice(-8)}!1`
          : null;

        await createCognitoUser({
          username: staff.username || staff.phone,
          phone: staff.phone,
          role: staff.role,
          staffId: staff.id,
          branchId: staff.branch_id,
          restaurantId: staff.restaurant_id,
          temporaryPassword: temporaryPassword
        });

        successCount++;
        console.log(`✓ ${staff.role.padEnd(18)} ${staff.name.padEnd(25)} ${staff.phone || staff.username || 'N/A'}`);
        
        if (staff.username && temporaryPassword) {
          console.log(`  └─ Temporary password: ${temporaryPassword}`);
        }
      } catch (error) {
        failCount++;
        failures.push({ staff, error: error.message });
        console.error(`✗ ${staff.role.padEnd(18)} ${staff.name.padEnd(25)} ${error.message}`);
      }
    }

    console.log('\n' + '='.repeat(80));
    console.log(`\n📊 Migration Summary:`);
    console.log(`   Total staff: ${totalStaff}`);
    console.log(`   ✓ Successful: ${successCount}`);
    console.log(`   ✗ Failed: ${failCount}`);

    if (failures.length > 0) {
      console.log('\n❌ Failed migrations:');
      failures.forEach(({ staff, error }) => {
        console.log(`   - ${staff.name} (${staff.role}): ${error}`);
      });
    }

    if (successCount > 0) {
      console.log('\n✅ Migration completed successfully!');
      console.log('\n📝 Next steps:');
      console.log('   1. Users with username can login with temporary password shown above');
      console.log('   2. They will be prompted to change password on first login');
      console.log('   3. Users with phone can use OTP login immediately');
    }

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await db.end();
  }
};

// Run migration
migrateStaff();
