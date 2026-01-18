import jwt from "jsonwebtoken";
import { db } from "../common/db.js";

export const handler = async ({ body }) => {
  try {
    const { username } = JSON.parse(body || '{}');

    if (!username) {
      return { 
        statusCode: 400, 
        body: JSON.stringify({ error: 'username required' }) 
      };
    }

    const res = await db.query(
      "SELECT id, name, role FROM staff WHERE username = $1 AND role = 'SUPER_ADMIN'", 
      [username]
    );

    if (!res.rowCount) {
      return { 
        statusCode: 401, 
        body: JSON.stringify({ error: 'Invalid credentials or not a super admin' }) 
      };
    }

    const staff = res.rows[0];

    const payload = {
      staffId: staff.id,
      role: staff.role,
      branchId: null,
      restaurantId: null
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET);
    
    return { 
      statusCode: 200, 
      body: JSON.stringify({ 
        token, 
        role: staff.role, 
        name: staff.name 
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
