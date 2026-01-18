import { db } from "../../common/db.js";
import { verifyToken } from "../../common/auth.js";
import { validateSessionOpen } from "../../common/sessionValidator.js";

export const handler = async ({ pathParameters, queryStringParameters, headers }) => {
  try {
    // Verify JWT token
    const auth = headers?.authorization || headers?.Authorization;
    if (!auth) {
      return { statusCode: 401, body: JSON.stringify({ error: "Missing authorization" }) };
    }

    let payload;
    try {
      payload = verifyToken(auth);
    } catch (error) {
      return { statusCode: 401, body: JSON.stringify({ error: "Invalid token" }) };
    }

    const orderId = pathParameters?.orderId || queryStringParameters?.orderId;
    const sessionId = queryStringParameters?.sessionId;

    // If a sessionId is provided, return all orders for that session (used by customers to see combined orders)
    if (sessionId) {
      // Verify the customer is requesting their own session
      if (payload.sessionId && payload.sessionId !== sessionId) {
        return { statusCode: 403, body: JSON.stringify({ error: "Access denied to this session" }) };
      }

      // Validate session is OPEN (customers can still view orders in closed sessions, but this ensures session exists)
      try {
        await validateSessionOpen(sessionId);
      } catch (error) {
        if (error.message === 'SESSION_NOT_FOUND') {
          return { statusCode: 404, body: JSON.stringify({ error: 'Session not found' }) };
        }
        if (error.message === 'SESSION_CLOSED') {
          return { statusCode: 403, body: JSON.stringify({ error: 'Session is closed. Cannot view orders.' }) };
        }
        throw error;
      }

      const ordersRes = await db.query(
        `SELECT o.id, o.session_id, o.customer_id, o.status, o.total_amount, o.created_at,
                b.currency_code, b.currency_symbol
         FROM orders o
         JOIN table_sessions ts ON ts.id = o.session_id
         JOIN tables t ON t.id = ts.table_id
         JOIN areas a ON a.id = t.area_id
         JOIN branches b ON b.id = a.branch_id
         WHERE o.session_id = $1
         ORDER BY o.created_at ASC`,
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
        totalAmount: {
          amount: parseFloat(order.total_amount),
          currency: order.currency_code,
          symbol: order.currency_symbol,
          formatted: `${order.currency_symbol}${parseFloat(order.total_amount).toFixed(2)}`
        },
        items: itemsByOrder.get(order.id) || []
      }));

      return { statusCode: 200, body: JSON.stringify({ orders: enriched }) };
    }

    if (!orderId) {
      return { statusCode: 400, body: JSON.stringify({ error: "orderId or sessionId required" }) };
    }

    // Fetch single order with items
    const orderRes = await db.query(
      `SELECT o.id, o.session_id, o.customer_id, o.status, o.total_amount, o.created_at,
              b.currency_code, b.currency_symbol
       FROM orders o
       JOIN table_sessions ts ON ts.id = o.session_id
       JOIN tables t ON t.id = ts.table_id
       JOIN areas a ON a.id = t.area_id
       JOIN branches b ON b.id = a.branch_id
       WHERE o.id = $1`,
      [orderId]
    );

    if (!orderRes.rowCount) {
      return { statusCode: 404, body: JSON.stringify({ error: "Order not found" }) };
    }

    const order = orderRes.rows[0];

    // Verify customer has access to this order (either their own order or same session)
    if (payload.customerId && order.customer_id !== payload.customerId && order.session_id !== payload.sessionId) {
      return { statusCode: 403, body: JSON.stringify({ error: "Access denied to this order" }) };
    }

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
        totalAmount: {
          amount: parseFloat(order.total_amount),
          currency: order.currency_code,
          symbol: order.currency_symbol,
          formatted: `${order.currency_symbol}${parseFloat(order.total_amount).toFixed(2)}`
        },
        items: itemsRes.rows
      })
    };
  } catch (error) {
    console.error("Get order error:", error);
    return { statusCode: 500, body: JSON.stringify({ error: "Internal server error" }) };
  }
};
