import { adminLogin, verifyCognitoToken } from "../common/cognitoAuth.js";
import { db } from "../common/db.js";

export const handler = async ({ body }) => {
  try {
    const { username, password } = JSON.parse(body || '{}');

    if (!username || !password) {
      return { 
        statusCode: 400, 
        body: JSON.stringify({ error: 'Username and password required' }) 
      };
    }

    // Verify user is super admin in database
    const res = await db.query(
      "SELECT id, name, role FROM staff WHERE username = $1 AND role = 'SUPER_ADMIN' AND is_active = true", 
      [username]
    );

    if (!res.rowCount) {
      return { 
        statusCode: 401, 
        body: JSON.stringify({ error: 'Invalid credentials or not a super admin' }) 
      };
    }

    const staff = res.rows[0];

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
    
    return { 
      statusCode: 200, 
      body: JSON.stringify({ 
        token: authResult.idToken,  // Use idToken as primary token
        accessToken: authResult.accessToken,
        idToken: authResult.idToken,
        refreshToken: authResult.refreshToken,
        expiresIn: authResult.expiresIn,
        role: staff.role, 
        name: staff.name,
        staffId: staff.id
      }) 
    };
  } catch (error) {
    console.error('Super admin login error:', error);
    return { 
      statusCode: 500, 
      body: JSON.stringify({ error: 'Internal server error' }) 
    };
  }
};
