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
      payload = verifyToken(token);
    } catch (e) {
      return { statusCode: 401, body: JSON.stringify({ error: 'Invalid token' }) };
    }
    if (!['ADMIN', 'RESTAURANT_ADMIN'].includes(payload.role)) {
      return { statusCode: 403, body: JSON.stringify({ error: 'Admin access required' }) };
    }

    const { restaurantId } = queryStringParameters || {};
    const res = await db.query("SELECT * FROM ai_knowledge_base WHERE restaurant_id=$1 ORDER BY id", [restaurantId]);
    return { statusCode: 200, body: JSON.stringify(res.rows) };
  } catch (error) {
    console.error('Get knowledge error:', error);
    return { statusCode: 500, body: JSON.stringify({ error: 'Internal server error' }) };
  }
};
