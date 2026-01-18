import { db } from "../../common/db.js";
import { verifyToken } from "../../common/auth.js";

export const handler = async ({ headers, pathParameters }) => {
  try {
    // Verify authentication
    const token = headers?.authorization || headers?.Authorization;
    if (!token) {
      return { statusCode: 401, body: JSON.stringify({ error: 'Authorization token required' }) };
    }

    let payload;
    try {
      payload = verifyToken(token);
    } catch (e) {
      return { statusCode: 401, body: JSON.stringify({ error: 'Invalid token' }) };
    }
    if (!['ADMIN', 'RESTAURANT_ADMIN', 'STAFF'].includes(payload.role)) {
      return { statusCode: 403, body: JSON.stringify({ error: 'Admin or staff access required' }) };
    }

    const { tableId } = pathParameters || {};
    const res = await db.query("SELECT qr_code FROM tables WHERE id=$1", [tableId]);
    if (!res.rowCount) return { statusCode: 404, body: JSON.stringify({ error: 'Table not found' }) };
    return { statusCode: 200, body: JSON.stringify({ qr: res.rows[0].qr_code }) };
  } catch (error) {
    console.error('Get table QR error:', error);
    return { statusCode: 500, body: JSON.stringify({ error: 'Internal server error' }) };
  }
};
