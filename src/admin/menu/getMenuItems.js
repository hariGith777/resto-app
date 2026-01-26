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
      payload = await verifyToken(auth);
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

    console.log(`[GetMenuItems] User ${payload.role} accessing menu items for branch: ${branchId}`);

    const { 
      categoryId, 
      foodType, 
      isAvailable, 
      search,
      limit = '50', 
      offset = '0' 
    } = queryStringParameters || {};

    // Build the WHERE clause dynamically
    let whereConditions = ['mc.branch_id = $1'];
    let params = [branchId];
    let paramCount = 2;

    if (categoryId) {
      whereConditions.push(`mi.category_id = $${paramCount}`);
      params.push(categoryId);
      paramCount++;
    }

    if (foodType) {
      whereConditions.push(`mi.food_type = $${paramCount}`);
      params.push(foodType);
      paramCount++;
    }

    if (isAvailable !== undefined) {
      whereConditions.push(`mi.is_available = $${paramCount}`);
      params.push(isAvailable === 'true');
      paramCount++;
    }

    if (search) {
      whereConditions.push(`mi.name ILIKE $${paramCount}`);
      params.push(`%${search}%`);
      paramCount++;
    }

    const whereClause = whereConditions.join(' AND ');

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total 
      FROM menu_items mi
      JOIN menu_categories mc ON mi.category_id = mc.id
      WHERE ${whereClause}
    `;
    const countResult = await db.query(countQuery, params);
    const totalItems = parseInt(countResult.rows[0].total);

    // Get menu items with pagination
    const query = `
      SELECT 
        mi.id,
        mi.category_id,
        mi.name,
        mi.description,
        mi.base_price,
        mi.food_type,
        mi.image_url,
        mi.tags,
        mi.preparation_time,
        mi.kitchen_type,
        mi.spice_level,
        mi.allergens,
        mi.is_available,
        mi.created_at,
        mc.name as category_name,
        mc.display_order,
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
      JOIN menu_categories mc ON mi.category_id = mc.id
      LEFT JOIN menu_portions mp ON mi.id = mp.menu_item_id
      WHERE ${whereClause}
      GROUP BY mi.id, mi.category_id, mi.name, mi.description, mi.base_price, 
               mi.food_type, mi.image_url, mi.tags, mi.preparation_time, 
               mi.kitchen_type, mi.spice_level, mi.allergens, mi.is_available, 
               mi.created_at, mc.name, mc.display_order
      ORDER BY mc.display_order ASC, mi.name ASC
      LIMIT $${paramCount} OFFSET $${paramCount + 1}
    `;

    params.push(parseInt(limit), parseInt(offset));
    const result = await db.query(query, params);

    // Get currency information
    const currencyRes = await db.query(
      'SELECT currency_code, currency_symbol FROM branches WHERE id = $1',
      [branchId]
    );
    const currency = currencyRes.rows[0] || { currency_code: 'INR', currency_symbol: '₹' };

    // Format items with currency
    const items = result.rows.map(item => ({
      ...item,
      price: {
        amount: parseFloat(item.base_price),
        currency: currency.currency_code,
        symbol: currency.currency_symbol,
        formatted: `${currency.currency_symbol}${parseFloat(item.base_price).toFixed(2)}`
      }
    }));

    return {
      statusCode: 200,
      body: JSON.stringify({
        items,
        pagination: {
          total: totalItems,
          limit: parseInt(limit),
          offset: parseInt(offset),
          hasMore: (parseInt(offset) + items.length) < totalItems,
          returned: items.length
        },
        filters: {
          branchId,
          categoryId: categoryId || null,
          foodType: foodType || null,
          isAvailable: isAvailable !== undefined ? isAvailable === 'true' : null,
          search: search || null
        }
      })
    };
  } catch (err) {
    console.error('Get menu items error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to fetch menu items', details: err.message })
    };
  }
};
