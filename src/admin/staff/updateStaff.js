import { db } from "../../common/db.js";
import { verifyToken } from "../../common/auth.js";
import { updateCognitoUserAttributes, getCognitoUser } from "../../common/cognitoAuth.js";
import { CognitoIdentityProviderClient, AdminUpdateUserAttributesCommand } from "@aws-sdk/client-cognito-identity-provider";

const COGNITO_USER_POOL_ID = process.env.COGNITO_USER_POOL_ID;
const COGNITO_REGION = process.env.COGNITO_REGION || 'ap-south-1';
const cognitoClient = new CognitoIdentityProviderClient({ region: COGNITO_REGION });

export const handler = async ({ pathParameters, body, headers }) => {
  try {
    const token = headers?.authorization || headers?.Authorization;
    if (!token) {
      return { statusCode: 401, body: JSON.stringify({ error: "Missing authorization" }) };
    }

    const payload = await verifyToken(token);
    if (!["ADMIN", "RESTAURANT_ADMIN"].includes(payload.role)) {
      return { statusCode: 403, body: JSON.stringify({ error: "Admin access required" }) };
    }

    const { id } = pathParameters;
    const { name, username, role, phone, isActive } = JSON.parse(body || '{}');

    const updates = [];
    const values = [];
    let paramCount = 1;

    if (name !== undefined) {
      updates.push(`name = $${paramCount++}`);
      values.push(name);
    }
    if (username !== undefined) {
      updates.push(`username = $${paramCount++}`);
      values.push(username);
    }
    if (role !== undefined) {
      const validRoles = ['CAPTAIN', 'KITCHEN', 'STAFF', 'RESTAURANT_ADMIN'];
      if (!validRoles.includes(role)) {
        return { statusCode: 400, body: JSON.stringify({ error: "Invalid role" }) };
      }
      updates.push(`role = $${paramCount++}`);
      values.push(role);
    }
    if (phone !== undefined) {
      updates.push(`phone = $${paramCount++}`);
      values.push(phone);
    }
    if (isActive !== undefined) {
      updates.push(`is_active = $${paramCount++}`);
      values.push(isActive);
    }

    if (updates.length === 0) {
      return { statusCode: 400, body: JSON.stringify({ error: "No fields to update" }) };
    }

    values.push(id);
    values.push(payload.branchId);
    
    const result = await db.query(
      `UPDATE staff 
       SET ${updates.join(', ')}, updated_at = NOW()
       WHERE id = $${paramCount} AND branch_id = $${paramCount + 1}
       RETURNING id, name, username, role, phone, branch_id, created_at, updated_at`,
      values
    );

    if (!result.rowCount) {
      return { statusCode: 404, body: JSON.stringify({ error: "Staff not found or access denied" }) };
    }

    const updatedStaff = result.rows[0];

    // Update Cognito user if username exists
    if (updatedStaff.username) {
      try {
        // Check if user exists in Cognito (might use staffId as username for old users)
        let cognitoUsername = updatedStaff.username;
        let userExists = await getCognitoUser(cognitoUsername);
        
        // If not found with username, try with staffId (for legacy users)
        if (!userExists) {
          cognitoUsername = updatedStaff.id;
          userExists = await getCognitoUser(cognitoUsername);
        }

        if (userExists) {
          const attributesToUpdate = [];

          // Update name
          if (name !== undefined) {
            attributesToUpdate.push({ Name: 'name', Value: name });
          }

          // Update phone
          if (phone !== undefined && phone) {
            attributesToUpdate.push({ Name: 'phone_number', Value: phone });
            attributesToUpdate.push({ Name: 'phone_number_verified', Value: 'true' });
          }

          // Update email if username is email format
          if (username !== undefined && username && username.includes('@')) {
            attributesToUpdate.push({ Name: 'email', Value: username });
            attributesToUpdate.push({ Name: 'email_verified', Value: 'true' });
          }

          // Update custom attributes
          if (role !== undefined) {
            attributesToUpdate.push({ Name: 'custom:role', Value: role });
          }

          // Update attributes in Cognito
          if (attributesToUpdate.length > 0) {
            const command = new AdminUpdateUserAttributesCommand({
              UserPoolId: COGNITO_USER_POOL_ID,
              Username: cognitoUsername,
              UserAttributes: attributesToUpdate
            });
            await cognitoClient.send(command);
            console.log(`✓ Cognito user updated: ${cognitoUsername}`);
          }
        } else {
          console.log(`⚠ Staff ${updatedStaff.id} not found in Cognito - skipping sync`);
        }
      } catch (cognitoError) {
        console.error('Failed to update Cognito user:', cognitoError);
        // Continue - Cognito update is not critical
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "Staff updated successfully",
        staff: updatedStaff
      })
    };
  } catch (error) {
    console.error("Update staff error:", error);
    return { statusCode: 500, body: JSON.stringify({ error: "Internal server error" }) };
  }
};
