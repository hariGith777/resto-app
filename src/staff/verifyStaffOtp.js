import { respondToAuthChallenge, verifyCognitoToken } from "../common/cognitoAuth.js";
import { db } from "../common/db.js";

/**
 * Verify OTP and complete staff login
 */
export const handler = async ({ body }) => {
  try {
    const { phone, otp, session } = JSON.parse(body || '{}');

    if (!phone || !otp || !session) {
      return {
        statusCode: 400,
        body: JSON.stringify({ 
          error: 'Phone number, OTP, and session are required' 
        })
      };
    }

    // Respond to Cognito auth challenge with OTP
    const authResult = await respondToAuthChallenge(phone, otp, session);

    if (!authResult.idToken) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'Invalid OTP' })
      };
    }

    // Verify the ID token and extract claims
    const tokenPayload = await verifyCognitoToken(authResult.idToken);

    // Get fresh staff data from database
    const staffResult = await db.query(
      `SELECT s.id, s.name, s.role, s.branch_id, s.phone, b.restaurant_id 
       FROM staff s 
       LEFT JOIN branches b ON b.id = s.branch_id
       WHERE s.phone = $1 AND s.is_active = true`,
      [phone]
    );

    if (staffResult.rowCount === 0) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Staff member not found' })
      };
    }

    const staff = staffResult.rows[0];

    return {
      statusCode: 200,
      body: JSON.stringify({
        token: authResult.idToken,  // Use idToken as primary token
        accessToken: authResult.accessToken,
        idToken: authResult.idToken,
        refreshToken: authResult.refreshToken,
        expiresIn: authResult.expiresIn,
        staff: {
          id: staff.id,
          name: staff.name,
          role: staff.role,
          branchId: staff.branch_id,
          restaurantId: staff.restaurant_id,
          phone: staff.phone
        }
      })
    };
  } catch (error) {
    console.error('Verify OTP error:', error);
    return {
      statusCode: 401,
      body: JSON.stringify({ 
        error: 'Invalid or expired OTP',
        details: error.message 
      })
    };
  }
};
