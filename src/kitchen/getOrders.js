import { db } from "../common/db.js";
import { verifyToken } from "../common/auth.js";

export const handler = async ({ headers, queryStringParameters }) => {
  try {
    // Verify kitchen staff authentication
    const token = headers?.authorization;
    if (!token) {
      return { statusCode: 401, body: JSON.stringify({ error: "Missing authorization" }) };
    }

    let staffInfo;
    try {
      staffInfo = verifyToken(token);
      if (staffInfo.role !== "KITCHEN") {
        return { statusCode: 403, body: JSON.stringify({ error: "Insufficient permissions" }) };
      }
    } catch (authError) {
      return { statusCode: 403, body: JSON.stringify({ error: "Invalid token" }) };
    }

    // Get filter status from query params (default: PREPARING)
    const filterStatus = queryStringParameters?.status || "PREPARING";
    const validStatuses = ["PLACED", "PREPARING", "READY", "COMPLETED"];
    if (!validStatuses.includes(filterStatus)) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: `Invalid status. Allowed: ${validStatuses.join(", ")}` })
      };
    }

    // Get all orders with the specified status for kitchen staff's branch
    const ordersRes = await db.query(
      `SELECT o.id, o.session_id, o.status, o.total_amount, o.created_at,
              t.table_number, a.name as area_name, b.name as branch_name,
              b.currency_code, b.currency_symbol,
              COUNT(oi.id) as item_count,
              EXTRACT(EPOCH FROM (NOW() - o.created_at)) as elapsed_seconds
       FROM orders o
       JOIN table_sessions ts ON ts.id = o.session_id
       JOIN tables t ON t.id = ts.table_id
       JOIN areas a ON a.id = t.area_id
       JOIN branches b ON b.id = a.branch_id
       LEFT JOIN order_items oi ON o.id = oi.order_id
       LEFT JOIN kots k ON k.order_id = o.id
       WHERE k.status = $1 AND b.id = $2
       GROUP BY o.id, t.table_number, a.name, b.name, b.currency_code, b.currency_symbol
       ORDER BY o.created_at ASC`,
      [filterStatus, staffInfo.branchId]
    );

    if (!ordersRes.rowCount) {
      return { statusCode: 200, body: JSON.stringify({ orders: [], count: 0 }) };
    }

    // For each order, get the items details
    const ordersWithItems = await Promise.all(
      ordersRes.rows.map(async (order) => {
        const itemsRes = await db.query(
          `SELECT mi.name, mi.description, oi.qty, mi.spice_level,
                  ARRAY_AGG(json_build_object('name', mm.name, 'price_delta', mm.price_delta)) 
                    FILTER (WHERE mm.id IS NOT NULL) as modifiers
           FROM order_items oi
           JOIN menu_items mi ON mi.id = oi.menu_item_id
           LEFT JOIN menu_modifiers mm ON mm.menu_item_id = mi.id
           WHERE oi.order_id = $1
           GROUP BY mi.id, mi.name, mi.description, oi.qty, mi.spice_level`,
          [order.id]
        );

        return {
          orderId: order.id,
          table: `${order.area_name} - T${order.table_number}`,
          branch: order.branch_name,
          status: order.status,
          totalAmount: {
            amount: parseFloat(order.total_amount),
            currency: order.currency_code,
            symbol: order.currency_symbol,
            formatted: `${order.currency_symbol}${parseFloat(order.total_amount).toFixed(2)}`
          },
          itemCount: order.item_count,
          elapsedMinutes: Math.floor(order.elapsed_seconds / 60),
          createdAt: order.created_at,
          items: itemsRes.rows.map(item => ({
            name: item.name,
            description: item.description,
            quantity: item.qty,
            spiceLevel: item.spice_level,
            modifiers: item.modifiers || []
          }))
        };
      })
    );

    return {
      statusCode: 200,
      body: JSON.stringify({
        status: filterStatus,
        count: ordersWithItems.length,
        orders: ordersWithItems,
        timestamp: new Date().toISOString()
      })
    };
  } catch (error) {
    console.error("Get kitchen orders error:", error);
    return { statusCode: 500, body: JSON.stringify({ error: "Internal server error" }) };
  }
};
