#!/usr/bin/env node
import 'dotenv/config';
import { db } from '../src/common/db.js';
import { createCognitoUser } from '../src/common/cognitoAuth.js';
import { CognitoIdentityProviderClient, AdminGetUserCommand } from '@aws-sdk/client-cognito-identity-provider';

const COGNITO_USER_POOL_ID = process.env.COGNITO_USER_POOL_ID;
const COGNITO_REGION = process.env.COGNITO_REGION || 'ap-south-1';

const cognitoClient = new CognitoIdentityProviderClient({ region: COGNITO_REGION });

async function checkCognitoUser(username) {
  try {
    const command = new AdminGetUserCommand({
      UserPoolId: COGNITO_USER_POOL_ID,
      Username: username
    });
    await cognitoClient.send(command);
    return true;
  } catch (error) {
    if (error.name === 'UserNotFoundException') {
      return false;
    }
    throw error;
  }
}

async function fixMissingCognitoUsers() {
  console.log('🔍 Finding managers missing from Cognito...\n');

  // Get all restaurant admins from database
  const result = await db.query(`
    SELECT s.id, s.username, s.name, s.phone, s.branch_id, b.restaurant_id
    FROM staff s
    LEFT JOIN branches b ON s.branch_id = b.id
    WHERE s.role = 'RESTAURANT_ADMIN' AND s.username IS NOT NULL
    ORDER BY s.created_at DESC
  `);

  let fixed = 0;
  let alreadyExists = 0;
  let errors = 0;

  for (const manager of result.rows) {
    const existsInCognito = await checkCognitoUser(manager.username);

    if (existsInCognito) {
      console.log(`✅ ${manager.username} - already in Cognito`);
      alreadyExists++;
      continue;
    }

    console.log(`❌ ${manager.username} - NOT in Cognito, creating...`);

    // Prompt for password (in real use, you'd want to generate or prompt)
    const defaultPassword = 'TempPass123!'; // They should change this on first login

    try {
      await createCognitoUser({
        username: manager.username,
        name: manager.name,
        password: defaultPassword,
        phone: manager.phone || null,
        role: 'RESTAURANT_ADMIN',
        staffId: manager.id,
        branchId: manager.branch_id,
        restaurantId: manager.restaurant_id
      });

      console.log(`   ✓ Created in Cognito with password: ${defaultPassword}`);
      console.log(`   ⚠️  User should change password on first login\n`);
      fixed++;
    } catch (error) {
      console.log(`   ❌ Failed: ${error.message}\n`);
      errors++;
    }
  }

  console.log('═══════════════════════════════════════');
  console.log(`✅ Already in Cognito: ${alreadyExists}`);
  console.log(`🔧 Fixed (added to Cognito): ${fixed}`);
  console.log(`❌ Errors: ${errors}`);
  console.log('═══════════════════════════════════════');

  await db.pool.end();
}

fixMissingCognitoUsers().catch(error => {
  console.error('Script failed:', error);
  process.exit(1);
});
