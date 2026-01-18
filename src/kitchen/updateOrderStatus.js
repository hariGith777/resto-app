import { db } from "../common/db.js";
import { requireRole } from "../common/auth.js";
import { broadcastToCaptain } from "../common/websocket.js";

export const handler = async ({ pathParameters, body, headers }) => {
  try {
    const { orderId } = pathParameters || {};
    if (!orderId) {
      return { statusCode: 400, body: JSON.stringify({ error: "orderId required" }) };
    }

    const { status } = JSON.parse(body || "{}");
    if (!status) {
      return { statusCode: 400, body: JSON.stringify({ error: "status required" }) };
    }

    // Validate allowed status transitions
    const validStatuses = ["PREPARING", "READY", "COMPLETED", "CANCELLED"];
    if (!validStatuses.includes(status)) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: `Invalid status. Allowed: ${validStatuses.join(", ")}` })
      };
    }

    // Verify kitchen staff authentication
    const token = headers?.authorization;
    if (!token) {
      return { statusCode: 401, body: JSON.stringify({ error: "Missing authorization" }) };
    }

    try {
      requireRole(token, "KITCHEN");
    } catch (authError) {
      return { statusCode: 403, body: JSON.stringify({ error: "Insufficient permissions" }) };
    }

    // Get order details first
    const orderRes = await db.query(
      `SELECT o.id, o.session_id, o.status as current_status, 
              k.id as kot_id, k.status as kot_status,
              ts.table_id
       FROM orders o
       LEFT JOIN kots k ON k.order_id = o.id
       LEFT JOIN table_sessions ts ON ts.id = o.session_id
       WHERE o.id = $1`,
      [orderId]
    );

    if (!orderRes.rowCount) {
      return { statusCode: 404, body: JSON.stringify({ error: "Order not found" }) };
    }

    const order = orderRes.rows[0];

    // Start transaction
    const client = await db.pool.connect();
    try {
      await client.query("BEGIN");

      // Update order status
      await client.query(
        `UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2`,
        [status, orderId]
      );

      // Update KOT status if it exists
      if (order.kot_id) {
        await client.query(
          `UPDATE kots SET status = $1, updated_at = NOW() WHERE id = $2`,
          [status, order.kot_id]
        );
      }

      // Get updated order with items for response
      const updatedRes = await client.query(
        `SELECT o.id, o.session_id, o.status, o.total_amount, o.created_at,
                COUNT(oi.id) as item_count
         FROM orders o
         LEFT JOIN order_items oi ON o.id = oi.order_id
         WHERE o.id = $1
         GROUP BY o.id`,
        [orderId]
      );

      const updatedOrder = updatedRes.rows[0];

      // Get table number for kitchen display
      const tableRes = await client.query(
        `SELECT t.table_number, a.name as area_name
         FROM tables t
         JOIN areas a ON a.id = t.area_id
         WHERE t.id = $1`,
        [order.table_id]
      );

      const tableInfo = tableRes.rowCount ? tableRes.rows[0] : null;

      // Get branch_id for WebSocket broadcast
      const branchRes = await client.query(
        `SELECT b.id as branch_id
         FROM table_sessions ts
         JOIN tables t ON t.id = ts.table_id
         JOIN areas a ON a.id = t.area_id
         JOIN branches b ON b.id = a.branch_id
         WHERE ts.id = $1`,
        [order.session_id]
      );
      const branchId = branchRes.rows[0]?.branch_id;

      await client.query("COMMIT");

      console.log(`Order ${orderId} status updated to ${status}`);

      // Broadcast status update to captain apps
      if (branchId) {
        await broadcastToCaptain(branchId, {
          type: 'ORDER_STATUS_UPDATE',
          orderId: updatedOrder.id,
          status: updatedOrder.status,
          table: tableInfo ? `${tableInfo.area_name} - Table ${tableInfo.table_number}` : null,
          timestamp: new Date().toISOString()
        });
      }

      return {
        statusCode: 200,
        body: JSON.stringify({
          orderId: updatedOrder.id,
          status: updatedOrder.status,
          totalAmount: updatedOrder.total_amount,
          itemCount: updatedOrder.item_count,
          table: tableInfo ? `${tableInfo.area_name} - Table ${tableInfo.table_number}` : null,
          kotStatus: status,
          timestamp: new Date().toISOString()
        })
      };
    } catch (txError) {
      await client.query("ROLLBACK");
      throw txError;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("Update order status error:", error);
    return { statusCode: 500, body: JSON.stringify({ error: "Internal server error" }) };
  }
};
