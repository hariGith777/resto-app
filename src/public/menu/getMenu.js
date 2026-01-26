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
      await verifyToken(token);
    } catch (error) {
      return { statusCode: 401, body: JSON.stringify({ error: "Invalid or expired token" }) };
    }

    const { sessionId } = queryStringParameters || {};
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
        return { statusCode: 403, body: JSON.stringify({ error: 'Session is closed. Cannot view menu.' }) };
      }
      throw error;
    }

    // Fetch branch-level menu categories with items via table session
    const categoriesRes = await db.query(
      `SELECT mc.id, mc.name, mc.display_order
       FROM menu_categories mc
       JOIN branches b ON b.id = mc.branch_id
       JOIN areas a ON a.branch_id = b.id
       JOIN tables t ON t.area_id = a.id
       JOIN table_sessions ts ON ts.table_id = t.id
       WHERE ts.id = $1
         AND mc.is_active = true
       ORDER BY mc.display_order ASC`,
      [sessionId]
    );

    if (!categoriesRes.rowCount) {
      return { statusCode: 404, body: JSON.stringify({ error: "Session not found or no categories" }) };
    }

    // Fetch menu items for these categories with currency
    const categoryIds = categoriesRes.rows.map(c => c.id);
    const itemsRes = await db.query(
      `SELECT mi.id, mi.category_id, mi.name, mi.description, mi.base_price, 
              mi.food_type, mi.is_veg, mi.spice_level, mi.is_available,
              b.currency_code, b.currency_symbol
       FROM menu_items mi
       JOIN menu_categories mc ON mc.id = mi.category_id
       JOIN branches b ON b.id = mc.branch_id
       WHERE mi.category_id = ANY($1)
         AND mi.is_available = true
       ORDER BY mi.name ASC`,
      [categoryIds]
    );

    // Group items by category with formatted prices
    const categories = categoriesRes.rows.map(category => ({
      ...category,
      items: itemsRes.rows.filter(item => item.category_id === category.id).map(item => ({
        ...item,
        price: {
          amount: parseFloat(item.base_price),
          currency: item.currency_code,
          symbol: item.currency_symbol,
          formatted: `${item.currency_symbol}${item.base_price}`
        }
      }))
    }));

    return { statusCode: 200, body: JSON.stringify(categories) };
  } catch (error) {
    console.error('Get categories error:', error);
    return { statusCode: 500, body: JSON.stringify({ error: 'Internal server error' }) };
  }
};
