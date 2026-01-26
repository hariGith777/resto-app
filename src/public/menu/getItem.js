import { db } from "../../common/db.js";
import { validateSessionOpen } from "../../common/sessionValidator.js";
import { verifyToken } from "../../common/auth.js";

export const handler = async ({ headers, pathParameters, queryStringParameters }) => {
  try {
    // Verify customer authentication
    const token = headers?.authorization || headers?.Authorization;
    if (!token) {
      return { statusCode: 401, body: JSON.stringify({ error: "Authentication required" }) };
    }

    try {
      await verifyToken(token);
    } catch (error) {
      return { statusCode: 401, body: JSON.stringify({ error: "Invalid or expired token" }) };
    }

    const { itemId } = pathParameters || {};
    const { sessionId } = queryStringParameters || {};
    
    if (!sessionId) {
      return { statusCode: 400, body: JSON.stringify({ error: "sessionId required" }) };
    }

    if (!itemId) {
      return { statusCode: 400, body: JSON.stringify({ error: "itemId required" }) };
    }

    // Validate session is OPEN
    try {
      await validateSessionOpen(sessionId);
    } catch (error) {
      if (error.message === 'SESSION_NOT_FOUND') {
        return { statusCode: 404, body: JSON.stringify({ error: 'Session not found' }) };
      }
      if (error.message === 'SESSION_CLOSED') {
        return { statusCode: 403, body: JSON.stringify({ error: 'Session is closed. Cannot view menu item.' }) };
      }
      throw error;
    }

    const res = await db.query("SELECT * FROM menu_items WHERE id=$1", [itemId]);
    if (!res.rowCount) return { statusCode: 404, body: JSON.stringify({ error: "Menu item not found" }) };
    return { statusCode: 200, body: JSON.stringify(res.rows[0]) };
  } catch (error) {
    console.error('Get menu item error:', error);
    return { statusCode: 500, body: JSON.stringify({ error: 'Internal server error' }) };
  }
};
