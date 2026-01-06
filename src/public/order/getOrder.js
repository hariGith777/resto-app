import { db } from "../../common/db.js";

export const handler = async ({ pathParameters, queryStringParameters }) => {
  try {
    const orderId = pathParameters?.orderId || queryStringParameters?.orderId;
    const sessionId = queryStringParameters?.sessionId;

    // If a sessionId is provided, return all orders for that session (used by customers to see combined orders)
    if (sessionId) {
      const ordersRes = await db.query(
        `SELECT id, session_id, customer_id, status, total_amount, created_at
         FROM orders
         WHERE session_id = $1
         ORDER BY created_at ASC`,
        [sessionId]
      );

      if (!ordersRes.rowCount) {
        return { statusCode: 404, body: JSON.stringify({ error: "No orders found for session" }) };
      }

      const orderIds = ordersRes.rows.map((row) => row.id);

      const itemsRes = await db.query(
        `SELECT oi.order_id, oi.id, oi.menu_item_id, oi.portion_id, oi.qty, oi.price,
                mi.name, mi.description
         FROM order_items oi
         JOIN menu_items mi ON mi.id = oi.menu_item_id
         WHERE oi.order_id = ANY($1::uuid[])`,
        [orderIds]
      );

      const itemsByOrder = new Map();
      for (const item of itemsRes.rows) {
        const list = itemsByOrder.get(item.order_id) || [];
        list.push(item);
        itemsByOrder.set(item.order_id, list);
      }

      const enriched = ordersRes.rows.map((order) => ({
        ...order,
        items: itemsByOrder.get(order.id) || []
      }));

      return { statusCode: 200, body: JSON.stringify({ orders: enriched }) };
    }

    if (!orderId) {
      return { statusCode: 400, body: JSON.stringify({ error: "orderId required" }) };
    }

    // Fetch single order with items
    const orderRes = await db.query(
      `SELECT o.id, o.session_id, o.customer_id, o.status, o.total_amount, o.created_at
       FROM orders o
       WHERE o.id = $1`,
      [orderId]
    );

    if (!orderRes.rowCount) {
      return { statusCode: 404, body: JSON.stringify({ error: "Order not found" }) };
    }

    const order = orderRes.rows[0];

    const itemsRes = await db.query(
      `SELECT oi.id, oi.menu_item_id, oi.portion_id, oi.qty, oi.price,
              mi.name, mi.description
       FROM order_items oi
       JOIN menu_items mi ON mi.id = oi.menu_item_id
       WHERE oi.order_id = $1`,
      [orderId]
    );

    return {
      statusCode: 200,
      body: JSON.stringify({
        ...order,
        items: itemsRes.rows
      })
    };
  } catch (error) {
    console.error("Get order error:", error);
    return { statusCode: 500, body: JSON.stringify({ error: "Internal server error" }) };
  }
};
