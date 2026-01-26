import { initiatePhoneAuth } from "../common/cognitoAuth.js";
import { db } from "../common/db.js";

/**
 * Send OTP to staff member's phone
 * Initiates Cognito custom auth flow
 */
export const handler = async ({ body }) => {
  try {
    const { phone } = JSON.parse(body || '{}');

    if (!phone) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Phone number required' })
      };
    }

    // Verify staff exists and is active
    const staffResult = await db.query(
      `SELECT s.id, s.name, s.role, s.branch_id, b.restaurant_id 
       FROM staff s 
       LEFT JOIN branches b ON b.id = s.branch_id
       WHERE s.phone = $1 AND s.is_active = true`,
      [phone]
    );

    if (staffResult.rowCount === 0) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Staff member not found or inactive' })
      };
    }

    const staff = staffResult.rows[0];

    // Initiate Cognito custom auth flow (sends OTP)
    const authResponse = await initiatePhoneAuth(phone);

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'OTP sent successfully',
        session: authResponse.session,
        phone: phone,
        // For development only - remove in production
        ...(process.env.NODE_ENV === 'development' && { 
          debug: 'Check logs or database for OTP' 
        })
      })
    };
  } catch (error) {
    console.error('Send OTP error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: 'Failed to send OTP',
        details: error.message 
      })
    };
  }
};
