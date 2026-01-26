import { adminLogin, verifyCognitoToken } from "../common/cognitoAuth.js";
import { db } from "../common/db.js";
import { ok } from "../common/response.js";

/**
 * Restaurant Admin login with username/password (for RESTAURANT_ADMIN)
 * POST /admin/login
 * For CAPTAIN/KITCHEN staff, use sendOtp + verifyStaffOtp endpoints instead
 */
export const handler = async ({ body }) => {
  try {
    const { username, password } = JSON.parse(body || '{}');

    if (!username || !password) {
      return { 
        statusCode: 400, 
        body: JSON.stringify({ error: 'Username and password required' }) 
      };
    }

    const res = await db.query(
      `SELECT s.*, b.restaurant_id 
       FROM staff s 
       LEFT JOIN branches b ON b.id = s.branch_id 
       WHERE s.username = $1 AND s.is_active = true`, 
      [username]
    );
    
    if (!res.rowCount) {
      return { 
        statusCode: 401, 
        body: JSON.stringify({ error: 'Invalid credentials' }) 
      };
    }
    
    const staff = res.rows[0];

    // Only RESTAURANT_ADMIN should use username/password
    // CAPTAIN and KITCHEN should use phone OTP
    if (staff.role !== 'RESTAURANT_ADMIN') {
      return {
        statusCode: 400,
        body: JSON.stringify({ 
          error: 'Please use phone OTP login for your role',
          hint: 'Use POST /staff/send-otp with your phone number'
        })
      };
    }

    // Authenticate with Cognito
    let authResult;
    try {
      authResult = await adminLogin(username, password);
    } catch (authError) {
      console.error('Cognito authentication failed:', authError);
      return { 
        statusCode: 401, 
        body: JSON.stringify({ error: 'Invalid credentials' }) 
      };
    }

    return ok({ 
      token: authResult.idToken,  // Use idToken as primary token
      accessToken: authResult.accessToken,
      idToken: authResult.idToken,
      refreshToken: authResult.refreshToken,
      expiresIn: authResult.expiresIn,
      role: staff.role, 
      branchId: staff.branch_id || null, 
      restaurantId: staff.restaurant_id || null,
      staffId: staff.id,
      name: staff.name
    });
  } catch (error) {
    console.error('Login error:', error);
    return { statusCode: 500, body: JSON.stringify({ error: 'Internal server error' }) };
  }
};
