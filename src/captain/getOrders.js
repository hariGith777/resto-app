import { db } from "../common/db.js";
import { verifyToken } from "../common/auth.js";

/**
 * Get active orders for captain's branch
 * GET /captain/orders
 * Optional query params: status (PLACED, SENT, READY, COMPLETED)
 */
export const handler = async ({ headers, queryStringParameters }) => {
  try {
    // Verify captain authentication
    const token = headers?.authorization || headers?.Authorization;
    if (!token) {
      return { statusCode: 401, body: JSON.stringify({ error: 'Authorization token required' }) };
    }

    const payload = verifyToken(token);
    
    // Only CAPTAIN role can access
    if (payload.role !== 'CAPTAIN') {
      return { statusCode: 403, body: JSON.stringify({ error: 'Captain access required' }) };
    }

    if (!payload.branchId) {
      return { statusCode: 403, body: JSON.stringify({ error: 'No branch access' }) };
    }

    const { status } = queryStringParameters || {};

    // Build query to get orders with details
    let query = `
      SELECT 
        o.id,
        o.status,
        o.total_amount,
        o.created_at,
        ts.id as session_id,
        t.table_number,
        a.name as area_name,
        json_agg(
          json_build_object(
            'id', oi.id,
            'menuItemId', oi.menu_item_id,
            'menuItemName', mi.name,
            'quantity', oi.qty,
            'portionLabel', mp.label,
            'itemPrice', oi.price
          ) ORDER BY oi.id
        ) FILTER (WHERE oi.id IS NOT NULL) as items,
        array_agg(DISTINCT c.phone) FILTER (WHERE c.phone IS NOT NULL) as customer_phones
      FROM orders o
      JOIN table_sessions ts ON ts.id = o.session_id
      JOIN tables t ON t.id = ts.table_id
      JOIN areas a ON a.id = t.area_id
      LEFT JOIN order_items oi ON oi.order_id = o.id
      LEFT JOIN menu_items mi ON mi.id = oi.menu_item_id
      LEFT JOIN menu_portions mp ON mp.id = oi.portion_id
      LEFT JOIN customers c ON c.session_id = ts.id
      WHERE a.branch_id = $1
        AND ts.ended_at IS NULL
    `;

    const params = [payload.branchId];

    // Filter by status if provided
    if (status) {
      query += ` AND o.status = $2`;
      params.push(status);
    }

    query += `
      GROUP BY o.id, o.status, o.total_amount, o.created_at, 
               ts.id, t.table_number, a.name
      ORDER BY 
        CASE o.status
          WHEN 'PLACED' THEN 1
          WHEN 'PREPARING' THEN 2
          WHEN 'READY' THEN 3
          WHEN 'COMPLETED' THEN 4
          WHEN 'CANCELLED' THEN 5
        END,
        o.created_at DESC
    `;

    const result = await db.query(query, params);

    // Format the response
    const orders = result.rows.map(row => ({
      id: row.id,
      status: row.status,
      totalAmount: parseFloat(row.total_amount),
      table: `${row.area_name} - Table ${row.table_number}`,
      tableNumber: row.table_number,
      areaName: row.area_name,
      items: row.items || [],
      itemCount: row.items ? row.items.length : 0,
      customerPhones: row.customer_phones || [],
      createdAt: row.created_at,
      sessionId: row.session_id
    }));

    // Group by status for easier UI rendering
    const ordersByStatus = {
      PLACED: orders.filter(o => o.status === 'PLACED'),
      PREPARING: orders.filter(o => o.status === 'PREPARING'),
      READY: orders.filter(o => o.status === 'READY'),
      COMPLETED: orders.filter(o => o.status === 'COMPLETED'),
      CANCELLED: orders.filter(o => o.status === 'CANCELLED')
    };

    return {
      statusCode: 200,
      body: JSON.stringify({
        orders,
        ordersByStatus,
        totalOrders: orders.length,
        summary: {
          placed: ordersByStatus.PLACED.length,
          preparing: ordersByStatus.PREPARING.length,
          ready: ordersByStatus.READY.length,
          completed: ordersByStatus.COMPLETED.length,
          cancelled: ordersByStatus.CANCELLED.length
        }
      })
    };

  } catch (error) {
    console.error('Get captain orders error:', error);
    if (error.message === 'Missing token' || error.name === 'JsonWebTokenError') {
      return { statusCode: 401, body: JSON.stringify({ error: 'Invalid token' }) };
    }
    return { statusCode: 500, body: JSON.stringify({ error: 'Internal server error' }) };
  }
};
