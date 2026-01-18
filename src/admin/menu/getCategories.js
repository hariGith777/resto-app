import { db } from '../../common/db.js';
import { verifyToken } from '../../common/auth.js';

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
      payload = verifyToken(auth);
    } catch (e) {
      return { 
        statusCode: 401, 
        body: JSON.stringify({ error: 'Invalid token' }) 
      };
    }

    // Allow ADMIN, RESTAURANT_ADMIN, STAFF roles
    if (!['ADMIN', 'RESTAURANT_ADMIN', 'STAFF'].includes(payload.role)) {
      return { 
        statusCode: 403, 
        body: JSON.stringify({ error: 'Admin or staff access required', receivedRole: payload.role }) 
      };
    }

    // Get branch_id from token - MUST come from token for security
    const branchId = payload.branchId;

    if (!branchId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Branch ID required - no branch associated with this account' })
      };
    }

    console.log(`[GetCategories] User ${payload.role} accessing categories for branch: ${branchId}`);

    const { includeItemCount, includeItems, limit = '50', offset = '0' } = queryStringParameters || {};

    // Get total count first
    const countQuery = 'SELECT COUNT(*) as total FROM menu_categories WHERE branch_id = $1';
    const countResult = await db.query(countQuery, [branchId]);
    const totalCategories = parseInt(countResult.rows[0].total);

    let query;
    const params = [branchId, parseInt(limit), parseInt(offset)];
    
    if (includeItemCount === 'true') {
      query = `
        SELECT 
          mc.id,
          mc.name,
          mc.display_order,
          mc.is_active,
          COUNT(mi.id) as item_count
        FROM menu_categories mc
        LEFT JOIN menu_items mi ON mc.id = mi.category_id
        WHERE mc.branch_id = $1
        GROUP BY mc.id, mc.name, mc.display_order, mc.is_active
        ORDER BY mc.display_order ASC, mc.name ASC
        LIMIT $2 OFFSET $3
      `;
    } else {
      query = `
        SELECT 
          id,
          name,
          display_order,
          is_active
        FROM menu_categories
        WHERE branch_id = $1
        ORDER BY display_order ASC, name ASC
        LIMIT $2 OFFSET $3
      `;
    }

    const result = await db.query(query, params);
    let categories = result.rows;

    // Fetch menu items for each category
    const itemsQuery = `
      SELECT 
        mi.id,
        mi.category_id,
        mi.name,
        mi.base_price,
        mi.food_type,
        mi.spice_level,
        mi.preparation_time,
        mi.kitchen_type,
        mi.is_available,
        mi.image_url,
        mi.tags,
        mi.allergens,
        COALESCE(
          json_agg(
            json_build_object(
              'id', mp.id,
              'label', mp.label,
              'basePrice', mp.base_price,
              'deliveryPrice', mp.delivery_price,
              'takeawayPrice', mp.takeaway_price
            ) ORDER BY mp.base_price
          ) FILTER (WHERE mp.id IS NOT NULL),
          '[]'
        ) as portions
      FROM menu_items mi
      LEFT JOIN menu_portions mp ON mi.id = mp.menu_item_id
      WHERE mi.category_id = ANY($1)
      GROUP BY mi.id, mi.category_id, mi.name, mi.base_price, mi.food_type, 
               mi.spice_level, mi.preparation_time, mi.kitchen_type, 
               mi.is_available, mi.image_url, mi.tags, mi.allergens
      ORDER BY mi.name ASC
    `;
    
    const categoryIds = categories.map(c => c.id);
    
    if (categoryIds.length > 0) {
      const itemsResult = await db.query(itemsQuery, [categoryIds]);
      
      // Group items by category
      const itemsByCategory = {};
      itemsResult.rows.forEach(item => {
        if (!itemsByCategory[item.category_id]) {
          itemsByCategory[item.category_id] = [];
        }
        const { category_id, ...itemData } = item;
        itemsByCategory[item.category_id].push(itemData);
      });
      
      // Add items to each category
      categories = categories.map(category => ({
        ...category,
        items: itemsByCategory[category.id] || []
      }));
    } else {
      // If no categories, return empty items array for each
      categories = categories.map(category => ({
        ...category,
        items: []
      }));
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        categories: categories,
        pagination: {
          total: totalCategories,
          limit: parseInt(limit),
          offset: parseInt(offset),
          hasMore: (parseInt(offset) + categories.length) < totalCategories,
          returned: categories.length
        }
      })
    };
  } catch (err) {
    console.error('Get categories error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to fetch categories', details: err.message, stack: err.stack })
    };
  }
};
