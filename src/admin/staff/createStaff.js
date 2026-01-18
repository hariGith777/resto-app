import { db } from "../../common/db.js";
import { verifyToken } from "../../common/auth.js";

export const handler = async ({ body, headers }) => {
  try {
    // Verify admin authentication
    const token = headers?.authorization || headers?.Authorization;
    if (!token) {
      return { statusCode: 401, body: JSON.stringify({ error: 'Authorization token required' }) };
    }

    const payload = verifyToken(token);
    
    // Only RESTAURANT_ADMIN can create staff
    if (payload.role !== 'RESTAURANT_ADMIN') {
      return { statusCode: 403, body: JSON.stringify({ error: 'Admin access required' }) };
    }

    if (!payload.branchId) {
      return { statusCode: 403, body: JSON.stringify({ error: 'Branch context required' }) };
    }

    const { branchId, name, role, phone, username } = JSON.parse(body);
    const res = await db.query(
      "INSERT INTO staff(branch_id,name,role,phone,username,is_active) VALUES($1,$2,$3,$4,$5,true) RETURNING id",
      [branchId, name, role, phone || null, username || null]
    );
    return { 
      statusCode: 201, 
      body: JSON.stringify({ 
        staffId: res.rows[0].id,
        message: 'Staff created successfully'
      }) 
    };
  } catch (error) {
    console.error('Create staff error:', error);
    return { statusCode: 500, body: JSON.stringify({ error: 'Internal server error' }) };
  }
};
