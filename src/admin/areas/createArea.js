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
    
    // Only RESTAURANT_ADMIN can create areas
    if (payload.role !== 'RESTAURANT_ADMIN') {
      return { statusCode: 403, body: JSON.stringify({ error: 'Admin access required' }) };
    }

    const { branchId, name } = JSON.parse(body || '{}');
    
    if (!branchId) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Branch ID is required' }) };
    }
    if (!name) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Area name is required' }) };
    }

    // Verify user has access to this branch
    if (payload.branchId && payload.branchId !== branchId) {
      return { statusCode: 403, body: JSON.stringify({ error: 'Access denied to this branch' }) };
    }

    const res = await db.query(
      "INSERT INTO areas(branch_id,name) VALUES($1,$2) RETURNING id",
      [branchId, name]
    );
    return { statusCode: 201, body: JSON.stringify({ areaId: res.rows[0].id }) };
  } catch (error) {
    console.error('Create area error:', error);
    return { statusCode: 500, body: JSON.stringify({ error: 'Internal server error' }) };
  }
};
