import { db } from "../../common/db.js";
import { verifyToken } from "../../common/auth.js";

export const handler = async ({ headers, queryStringParameters }) => {
  try {
    // Verify authentication
    const token = headers?.authorization || headers?.Authorization;
    if (!token) {
      return { statusCode: 401, body: JSON.stringify({ error: 'Authorization token required' }) };
    }

    let payload;
    try {
      payload = await verifyToken(token);
    } catch (e) {
      return { statusCode: 401, body: JSON.stringify({ error: 'Invalid token' }) };
    }
    if (!['ADMIN', 'RESTAURANT_ADMIN', 'STAFF'].includes(payload.role)) {
      return { statusCode: 403, body: JSON.stringify({ error: 'Admin or staff access required' }) };
    }

    // Use branchId from token for security
    const branchId = payload.branchId || queryStringParameters?.branchId;
    if (!branchId) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Branch ID required' }) };
    }
    
    // Get areas with their tables
    const query = `
      SELECT 
        a.id,
        a.name,
        a.branch_id,
        a.created_at,
        COALESCE(
          json_agg(
            json_build_object(
              'id', t.id,
              'tableNumber', t.table_number,
              'capacity', t.capacity,
              'qrCode', t.qr_code,
              'createdAt', t.created_at
            ) ORDER BY t.table_number
          ) FILTER (WHERE t.id IS NOT NULL),
          '[]'::json
        ) as tables
      FROM areas a
      LEFT JOIN tables t ON t.area_id = a.id
      WHERE a.branch_id = $1
      GROUP BY a.id, a.name, a.branch_id, a.created_at
      ORDER BY a.id
    `;
    
    const res = await db.query(query, [branchId]);
    return { statusCode: 200, body: JSON.stringify(res.rows) };
  } catch (error) {
    console.error('Get areas error:', error);
    return { statusCode: 500, body: JSON.stringify({ error: 'Internal server error' }) };
  }
};
