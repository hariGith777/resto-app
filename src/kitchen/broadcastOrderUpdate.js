import { db } from "../common/db.js";

export const handler = async (event) => {
  try {
    // Parse the order update event
    const { orderId, status, branchId } = event.detail;

    console.log(`📢 Broadcasting order ${orderId} update: ${status}`);

    // Get order details for the broadcast message
    const orderRes = await db.query(
      `SELECT o.id, o.status, o.total_amount,
              t.table_number, a.name as area_name,
              COUNT(oi.id) as item_count
       FROM orders o
       JOIN table_sessions ts ON ts.id = o.session_id
       JOIN tables t ON t.id = ts.table_id
       JOIN areas a ON a.id = t.area_id
       WHERE o.id = $1
       GROUP BY o.id, t.table_number, a.name`,
      [orderId]
    );

    if (!orderRes.rowCount) {
      console.log(`Order ${orderId} not found`);
      return { statusCode: 404 };
    }

    const order = orderRes.rows[0];

    // Get all connected kitchen displays for this branch
    const connectionsRes = await db.query(
      `SELECT connection_id FROM ws_connections WHERE branch_id = $1`,
      [branchId]
    );

    if (connectionsRes.rowCount === 0) {
      console.log(`No active connections for branch ${branchId}`);
      return { statusCode: 200, body: "No active connections" };
    }

    // Build the broadcast message
    const message = {
      type: "ORDER_UPDATED",
      orderId: order.id,
      status: order.status,
      table: `${order.area_name} - Table T${order.table_number}`,
      itemCount: order.item_count,
      totalAmount: order.total_amount,
      timestamp: new Date().toISOString()
    };

    console.log(`✅ Broadcasting to ${connectionsRes.rowCount} kitchen displays:`, message);

    // In a production environment, you would use AWS API Gateway Management API
    // to post to WebSocket connections. This is a simplified example showing the concept.
    // 
    // To implement actual WebSocket broadcasting, you would need:
    // 1. AWS SDK: const apiGatewayManagementApi = new AWS.ApiGatewayManagementApi({
    //      endpoint: process.env.WEBSOCKET_ENDPOINT
    //    });
    // 2. Then post to each connection:
    //    await apiGatewayManagementApi.postToConnection({
    //      ConnectionId: connection_id,
    //      Data: JSON.stringify(message)
    //    }).promise();

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "Broadcast prepared",
        connections: connectionsRes.rowCount,
        data: message
      })
    };
  } catch (error) {
    console.error("Broadcast error:", error);
    return { statusCode: 500, body: JSON.stringify({ error: "Broadcast failed" }) };
  }
};
