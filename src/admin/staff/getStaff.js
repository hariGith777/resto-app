import { db } from "../../common/db.js";
import { verifyToken } from "../../common/auth.js";

export const handler = async ({ headers, queryStringParameters }) => {
  try {
    const auth = headers && (headers.authorization || headers.Authorization);
    if (!auth) {
      return { 
        statusCode: 401, 
        body: JSON.stringify({ error: 'Missing authorization' }) 
      };
    }

    let payload;
    try {
      payload = await verifyToken(auth);
    } catch (e) {
      return { 
        statusCode: 401, 
        body: JSON.stringify({ error: 'Invalid token' }) 
      };
    }

    // Allow ADMIN, RESTAURANT_ADMIN, and STAFF roles to view staff list
    if (!['ADMIN', 'RESTAURANT_ADMIN', 'STAFF'].includes(payload.role)) {
      return { 
        statusCode: 403, 
        body: JSON.stringify({ error: 'Admin or staff access required', receivedRole: payload.role }) 
      };
    }

    // Get branch_id from token or query parameters
    let branchId = payload.branchId;
    
    if (!branchId && queryStringParameters?.branchId) {
      branchId = queryStringParameters.branchId;
    }

    if (!branchId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Branch ID required' })
      };
    }

    const { role } = queryStringParameters || {};

    let query = `
      SELECT 
        id,
        username,
        name,
        role,
        phone,
        branch_id,
        created_at
      FROM staff 
      WHERE branch_id = $1
    `;
    
    const params = [branchId];
    let paramCount = 2;

    if (role) {
      query += ` AND role = $${paramCount}`;
      params.push(role);
      paramCount++;
    }

    query += ' ORDER BY created_at DESC, name ASC';

    const res = await db.query(query, params);
    
    return { 
      statusCode: 200, 
      body: JSON.stringify({
        staff: res.rows,
        total: res.rows.length
      }) 
    };
  } catch (error) {
    console.error('Get staff error:', error);
    return { 
      statusCode: 500, 
      body: JSON.stringify({ error: 'Failed to fetch staff', details: error.message }) 
    };
  }
};
