#!/usr/bin/env node

import 'dotenv/config';
import pg from 'pg';
import { 
  CognitoIdentityProviderClient, 
  AdminCreateUserCommand,
  AdminSetUserPasswordCommand
} from "@aws-sdk/client-cognito-identity-provider";

const { Client } = pg;

const COGNITO_USER_POOL_ID = process.env.COGNITO_USER_POOL_ID;
const COGNITO_REGION = process.env.COGNITO_REGION || 'ap-south-1';

const cognitoClient = new CognitoIdentityProviderClient({ region: COGNITO_REGION });
const dbClient = new Client({ connectionString: process.env.DATABASE_URL });

await dbClient.connect();

// Get the super admin
const result = await dbClient.query(
  "SELECT id, name, username, phone, role FROM staff WHERE role = 'SUPER_ADMIN' AND is_active = true LIMIT 1"
);

if (result.rowCount === 0) {
  console.log('❌ No super admin found');
  process.exit(1);
}

const staff = result.rows[0];
console.log(`\n🔧 Creating Cognito user for: ${staff.name}`);
console.log(`   Role: ${staff.role}`);
console.log(`   Username: ${staff.username || staff.phone}`);

const userAttributes = [
  { Name: 'custom:role', Value: staff.role },
  { Name: 'custom:staffId', Value: staff.id }
];

// Only add phone if it's in E.164 format (starts with +)
if (staff.phone && staff.phone.startsWith('+')) {
  userAttributes.push({ Name: 'phone_number', Value: staff.phone });
  userAttributes.push({ Name: 'phone_number_verified', Value: 'true' });
}

try {
  // Create user
  const createCommand = new AdminCreateUserCommand({
    UserPoolId: COGNITO_USER_POOL_ID,
    Username: staff.username || staff.phone,
    UserAttributes: userAttributes,
    MessageAction: 'SUPPRESS'
  });

  await cognitoClient.send(createCommand);
  console.log('✅ User created in Cognito');

  // Set permanent password
  const tempPassword = 'TestPass123!';
  const setPasswordCommand = new AdminSetUserPasswordCommand({
    UserPoolId: COGNITO_USER_POOL_ID,
    Username: staff.username || staff.phone,
    Password: tempPassword,
    Permanent: true
  });

  await cognitoClient.send(setPasswordCommand);
  console.log(`✅ Password set: ${tempPassword}`);
  
  console.log('\n📝 Test Login:');
  console.log(`   Username: ${staff.username || staff.phone}`);
  console.log(`   Password: ${tempPassword}`);
  console.log('\n📋 Curl Command:');
  console.log(`curl -X POST https://c83055bt54.execute-api.ap-south-1.amazonaws.com/super-admin/login \\
  -H "Content-Type: application/json" \\
  -d '{"username": "${staff.username || staff.phone}", "password": "${tempPassword}"}'`);
  
} catch (error) {
  console.error('❌ Error:', error.message);
}

await dbClient.end();
