import { db } from "../../common/db.js";
import { validateSessionOpen } from "../../common/sessionValidator.js";
import { verifyToken } from "../../common/auth.js";

export const handler = async ({ headers, queryStringParameters }) => {
  try {
    // Verify customer authentication
    const token = headers?.authorization || headers?.Authorization;
    if (!token) {
      return { statusCode: 401, body: JSON.stringify({ error: "Authentication required" }) };
    }

    try {
      verifyToken(token);
    } catch (error) {
      return { statusCode: 401, body: JSON.stringify({ error: "Invalid or expired token" }) };
    }

    const { categoryId, sessionId } = queryStringParameters || {};
    
    if (!sessionId) {
      return { statusCode: 400, body: JSON.stringify({ error: "sessionId required" }) };
    }

    // Validate session is OPEN
    try {
      await validateSessionOpen(sessionId);
    } catch (error) {
      if (error.message === 'SESSION_NOT_FOUND') {
        return { statusCode: 404, body: JSON.stringify({ error: 'Session not found' }) };
      }
      if (error.message === 'SESSION_CLOSED') {
        return { statusCode: 403, body: JSON.stringify({ error: 'Session is closed. Cannot view menu items.' }) };
      }
      throw error;
    }

    const res = await db.query(
      `SELECT mi.*, b.currency_code, b.currency_symbol
       FROM menu_items mi
       JOIN menu_categories mc ON mc.id = mi.category_id
       JOIN branches b ON b.id = mc.branch_id
       WHERE mi.category_id=$1 AND mi.is_available=true`,
      [categoryId]
    );
    const items = res.rows.map(item => ({
      ...item,
      price: {
        amount: parseFloat(item.base_price),
        currency: item.currency_code,
        symbol: item.currency_symbol,
        formatted: `${item.currency_symbol}${item.base_price}`
      }
    }));
    return { statusCode: 200, body: JSON.stringify(items) };
  } catch (error) {
    console.error('Get items error:', error);
    return { statusCode: 500, body: JSON.stringify({ error: 'Internal server error' }) };
  }
};
