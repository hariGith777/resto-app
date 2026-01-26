import { db } from "../common/db.js";
import { verifyToken } from "../common/auth.js";

export const handler = async ({ headers }) => {
  try {
    // Verify captain/staff authentication
    const token = headers?.authorization || headers?.Authorization;
    if (!token) {
      return { statusCode: 401, body: JSON.stringify({ error: 'Authorization token required' }) };
    }

    const payload = await verifyToken(token);
    
    // Only staff with branch access can view active tables
    if (!payload.branchId) {
      return { statusCode: 403, body: JSON.stringify({ error: 'No branch access' }) };
    }

    // Get active sessions for tables in captain's branch with customer phone numbers
    const res = await db.query(
      `SELECT 
         ts.id as session_id,
         ts.table_id,
         ts.status,
         ts.started_at,
         ts.ended_at,
         json_agg(
           json_build_object(
             'phone', c.phone,
             'name', c.name,
             'verified', c.verified
           )
         ) FILTER (WHERE c.id IS NOT NULL) as customers
       FROM table_sessions ts
       JOIN tables t ON t.id = ts.table_id
       JOIN areas a ON a.id = t.area_id
       LEFT JOIN customers c ON c.session_id = ts.id
       WHERE a.branch_id = $1 AND ts.ended_at IS NULL
       GROUP BY ts.id, ts.table_id, ts.status, ts.started_at, ts.ended_at
       ORDER BY ts.started_at DESC`,
      [payload.branchId]
    );

    return { statusCode: 200, body: JSON.stringify({ sessions: res.rows }) };
  } catch (error) {
    console.error('Active tables error:', error);
    if (error.message === 'Missing token' || error.name === 'JsonWebTokenError') {
      return { statusCode: 401, body: JSON.stringify({ error: 'Invalid token' }) };
    }
    return { statusCode: 500, body: JSON.stringify({ error: 'Internal server error' }) };
  }
};
