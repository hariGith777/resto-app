import { db } from "../../common/db.js";

export const handler = async ({ queryStringParameters }) => {
  try {
    const { sessionId } = queryStringParameters || {};
    if (!sessionId) {
      return { statusCode: 400, body: JSON.stringify({ error: "sessionId required" }) };
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

    // Fetch menu items for these categories
    const categoryIds = categoriesRes.rows.map(c => c.id);
    const itemsRes = await db.query(
      `SELECT mi.id, mi.category_id, mi.name, mi.description, mi.base_price, 
              mi.is_veg, mi.spice_level, mi.is_available
       FROM menu_items mi
       WHERE mi.category_id = ANY($1)
         AND mi.is_available = true
       ORDER BY mi.name ASC`,
      [categoryIds]
    );

    // Group items by category
    const categories = categoriesRes.rows.map(category => ({
      ...category,
      items: itemsRes.rows.filter(item => item.category_id === category.id)
    }));

    return { statusCode: 200, body: JSON.stringify(categories) };
  } catch (error) {
    console.error('Get categories error:', error);
    return { statusCode: 500, body: JSON.stringify({ error: 'Internal server error' }) };
  }
};
