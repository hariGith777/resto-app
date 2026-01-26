import { db } from "../../common/db.js";
import { verifyToken } from "../../common/auth.js";
import { createCognitoUser } from "../../common/cognitoAuth.js";

export const handler = async ({ body, headers }) => {
  try {
    // Verify admin authentication
    const token = headers?.authorization || headers?.Authorization;
    if (!token) {
      return { statusCode: 401, body: JSON.stringify({ error: 'Authorization token required' }) };
    }

    const payload = await verifyToken(token);
    
    // Only RESTAURANT_ADMIN can create staff
    if (payload.role !== 'RESTAURANT_ADMIN') {
      return { statusCode: 403, body: JSON.stringify({ error: 'Admin access required' }) };
    }

    if (!payload.branchId) {
      return { statusCode: 403, body: JSON.stringify({ error: 'Branch context required' }) };
    }

    const { branchId, name, role, phone, username } = JSON.parse(body);
    
    // Get restaurant_id for the branch
    const branchResult = await db.query(
      "SELECT restaurant_id FROM branches WHERE id = $1",
      [branchId]
    );
    
    if (branchResult.rowCount === 0) {
      return { statusCode: 404, body: JSON.stringify({ error: 'Branch not found' }) };
    }
    
    const restaurantId = branchResult.rows[0].restaurant_id;
    
    // Insert into database
    const res = await db.query(
      "INSERT INTO staff(branch_id,name,role,phone,username,is_active) VALUES($1,$2,$3,$4,$5,true) RETURNING id",
      [branchId, name, role, phone || null, username || null]
    );
    
    const staffId = res.rows[0].id;

    // Create user in Cognito
    try {
      const temporaryPassword = username ? `Temp${Math.random().toString(36).slice(-8)}!1` : null;
      
      await createCognitoUser({
        username: username || phone, // Use phone as username if no username provided
        name: name,
        phone: phone,
        role: role,
        staffId: staffId,
        branchId: branchId,
        restaurantId: restaurantId,
        temporaryPassword: temporaryPassword // Only for username-based logins
      });
      
      console.log(`Cognito user created for staff: ${staffId}`);
    } catch (cognitoError) {
      console.error('Cognito user creation failed:', cognitoError);
      // Don't fail the entire request, but log the error
      // Staff exists in DB, Cognito creation can be retried
      return { 
        statusCode: 201, 
        body: JSON.stringify({ 
          staffId: staffId,
          message: 'Staff created successfully, but Cognito setup failed',
          warning: 'User may not be able to login until Cognito user is created',
          error: cognitoError.message
        }) 
      };
    }
    
    return { 
      statusCode: 201, 
      body: JSON.stringify({ 
        staffId: staffId,
        message: 'Staff created successfully',
        loginMethod: phone ? 'Phone OTP' : 'Username/Password'
      }) 
    };
  } catch (error) {
    console.error('Create staff error:', error);
    return { statusCode: 500, body: JSON.stringify({ error: 'Internal server error' }) };
  }
};
