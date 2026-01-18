# WebSocket Implementation for Live Kitchen Order Tracking

## Architecture Overview

WebSocket enables real-time, bidirectional communication between the server and kitchen display clients. This allows instant notifications of new orders and status updates.

```
┌─────────────────┐                      ┌──────────────────┐
│   Customer App  │──── HTTP REST ──────▶│                  │
└─────────────────┘  (Place Order)       │  AWS Lambda      │
                                         │  (Order Service) │
                   ◀─────────────────────│                  │
                    (Order Confirmation) └────────┬─────────┘
                                                 │
                                      Updates DB + Sends Event
                                                 │
                                                 ▼
                                    ┌─────────────────────────┐
                                    │  API Gateway WebSocket  │
                                    │  (Connection Manager)   │
                                    └─────────┬───────────────┘
                                              │
                    ┌─────────────────────────┼─────────────────────────┐
                    │                         │                         │
                    ▼                         ▼                         ▼
            ┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐
            │  Kitchen Display │    │  Kitchen Display │    │  Kitchen Display │
            │   (Branch 1)     │    │   (Branch 2)     │    │   (Branch 3)     │
            │                  │    │                  │    │                  │
            │ WebSocket Client │    │ WebSocket Client │    │ WebSocket Client │
            └──────────────────┘    └──────────────────┘    └──────────────────┘
```

## Implementation Steps

### 1. WebSocket Connection Management

**Connect Handler** (`src/kitchen/wsConnect.js`):
```javascript
import { db } from "../common/db.js";
import { verifyToken } from "../common/auth.js";

export const handler = async (event) => {
  try {
    const connectionId = event.requestContext.connectionId;
    const token = event.queryStringParameters?.token;

    // Verify kitchen staff token
    let staffInfo;
    try {
      staffInfo = verifyToken(token);
      if (staffInfo.role !== "KITCHEN") {
        return { statusCode: 403, body: "Unauthorized" };
      }
    } catch (error) {
      return { statusCode: 401, body: "Invalid token" };
    }

    // Store connection with branch ID for filtering
    await db.query(
      `INSERT INTO ws_connections(connection_id, branch_id)
       VALUES($1, $2)`,
      [connectionId, staffInfo.branchId]
    );

    console.log(`Kitchen connected: ${connectionId} (Branch: ${staffInfo.branchId})`);
    return { statusCode: 200, body: "Connected" };
  } catch (error) {
    console.error("WS connect error:", error);
    return { statusCode: 500 };
  }
};
```

**Disconnect Handler** (`src/kitchen/wsDisconnect.js`):
```javascript
import { db } from "../common/db.js";

export const handler = async (event) => {
  try {
    const connectionId = event.requestContext.connectionId;
    
    await db.query(
      "DELETE FROM ws_connections WHERE connection_id = $1",
      [connectionId]
    );

    console.log(`Kitchen disconnected: ${connectionId}`);
    return { statusCode: 200 };
  } catch (error) {
    console.error("WS disconnect error:", error);
    return { statusCode: 500 };
  }
};
```

### 2. Broadcast Handler (Triggered on Order Updates)

When an order status changes, broadcast to all kitchen displays in that branch:

```javascript
import { db } from "../common/db.js";
import AWS from "aws-sdk";

const apiGatewayManagementApi = new AWS.ApiGatewayManagementApi({
  endpoint: process.env.WEBSOCKET_ENDPOINT
});

export const handler = async (event) => {
  try {
    const { orderId, status, branchId } = event.detail;

    // Get all connected kitchen displays for this branch
    const connectionsRes = await db.query(
      `SELECT connection_id FROM ws_connections WHERE branch_id = $1`,
      [branchId]
    );

    // Get order details for broadcast
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

    if (!orderRes.rowCount) return { statusCode: 404 };

    const order = orderRes.rows[0];
    const message = {
      type: "ORDER_UPDATED",
      orderId: order.id,
      status: order.status,
      table: `${order.area_name} - T${order.table_number}`,
      itemCount: order.item_count,
      timestamp: new Date().toISOString()
    };

    // Broadcast to all connected kitchen displays
    const postCalls = connectionsRes.rows.map(({ connection_id }) =>
      apiGatewayManagementApi.postToConnection({
        ConnectionId: connection_id,
        Data: JSON.stringify(message)
      }).promise().catch(err => {
        // Remove stale connections
        if (err.statusCode === 410) {
          return db.query(
            "DELETE FROM ws_connections WHERE connection_id = $1",
            [connection_id]
          );
        }
        throw err;
      })
    );

    await Promise.all(postCalls);
    console.log(`Broadcasted to ${connectionsRes.rowCount} kitchen displays`);

    return { statusCode: 200 };
  } catch (error) {
    console.error("Broadcast error:", error);
    return { statusCode: 500 };
  }
};
```

### 3. Update Order Status with Broadcast

Modify `updateOrderStatus.js` to trigger WebSocket broadcast:

```javascript
import { db } from "../common/db.js";
import { requireRole } from "../common/auth.js";
import AWS from "aws-sdk";

const eventBridge = new AWS.EventBridge();

export const handler = async ({ pathParameters, body, headers }) => {
  try {
    const { orderId } = pathParameters || {};
    const { status } = JSON.parse(body || "{}");

    // Validate and update order
    const orderRes = await db.query(
      `SELECT o.id, o.session_id, 
              ts.table_id,
              a.branch_id,
              k.id as kot_id
       FROM orders o
       LEFT JOIN kots k ON k.order_id = o.id
       LEFT JOIN table_sessions ts ON ts.id = o.session_id
       LEFT JOIN tables t ON t.id = ts.table_id
       LEFT JOIN areas a ON a.id = t.area_id
       WHERE o.id = $1`,
      [orderId]
    );

    if (!orderRes.rowCount) {
      return { statusCode: 404, body: JSON.stringify({ error: "Order not found" }) };
    }

    const order = orderRes.rows[0];

    // Update order and KOT
    const client = await db.pool.connect();
    try {
      await client.query("BEGIN");

      await client.query(
        `UPDATE orders SET status = $1 WHERE id = $2`,
        [status, orderId]
      );

      if (order.kot_id) {
        await client.query(
          `UPDATE kots SET status = $1 WHERE id = $2`,
          [status, order.kot_id]
        );
      }

      await client.query("COMMIT");

      // Trigger EventBridge to broadcast update
      await eventBridge.putEvents({
        Entries: [{
          Source: "kitchen.orders",
          DetailType: "OrderStatusChanged",
          Detail: JSON.stringify({
            orderId: order.id,
            status: status,
            branchId: order.branch_id,
            timestamp: new Date().toISOString()
          })
        }]
      }).promise();

      return {
        statusCode: 200,
        body: JSON.stringify({
          orderId: order.id,
          status: status,
          broadcastSent: true
        })
      };
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("Error:", error);
    return { statusCode: 500, body: JSON.stringify({ error: "Internal error" }) };
  }
};
```

## Kitchen Display Client (WebSocket Consumer)

```html
<!DOCTYPE html>
<html>
<head>
    <title>Kitchen Display System</title>
    <style>
        body { font-family: Arial; background: #1a1a1a; color: white; }
        .orders-container { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 20px; padding: 20px; }
        .order-card { background: #2a2a2a; border-left: 4px solid #4CAF50; padding: 15px; border-radius: 8px; }
        .order-card.ready { border-left-color: #2196F3; }
        .order-card.completed { border-left-color: #9C27B0; opacity: 0.6; }
        .table { font-size: 24px; font-weight: bold; margin-bottom: 10px; }
        .status { display: inline-block; padding: 5px 10px; border-radius: 4px; font-weight: bold; }
        .status.sent { background: #FF9800; }
        .status.ready { background: #2196F3; }
        .status.completed { background: #9C27B0; }
        .items { margin: 10px 0; font-size: 14px; }
        .item { padding: 5px 0; }
        .elapsed { font-size: 12px; color: #999; margin-top: 10px; }
        .connection-status { position: fixed; top: 10px; right: 10px; padding: 10px 15px; border-radius: 4px; font-weight: bold; }
        .connected { background: #4CAF50; }
        .disconnected { background: #F44336; }
    </style>
</head>
<body>
    <div id="connectionStatus" class="connection-status disconnected">Connecting...</div>
    <div class="orders-container" id="ordersContainer"></div>

    <script>
        const WEBSOCKET_URL = "wss://YOUR_WEBSOCKET_URL";
        const token = localStorage.getItem("kitchenToken");
        let ws = null;
        let orders = new Map();

        function connect() {
            ws = new WebSocket(`${WEBSOCKET_URL}?token=${token}`);

            ws.onopen = () => {
                console.log("Connected to kitchen display");
                updateConnectionStatus(true);
            };

            ws.onmessage = (event) => {
                const message = JSON.parse(event.data);
                
                if (message.type === "ORDER_UPDATED") {
                    handleOrderUpdate(message);
                }
            };

            ws.onerror = (error) => {
                console.error("WebSocket error:", error);
                updateConnectionStatus(false);
            };

            ws.onclose = () => {
                console.log("Disconnected from kitchen");
                updateConnectionStatus(false);
                // Reconnect after 3 seconds
                setTimeout(connect, 3000);
            };
        }

        function handleOrderUpdate(message) {
            const { orderId, status, table, itemCount } = message;
            
            orders.set(orderId, {
                id: orderId,
                status: status,
                table: table,
                itemCount: itemCount,
                timestamp: new Date(message.timestamp)
            });

            renderOrders();

            // Auto-remove completed orders after 2 seconds
            if (status === "COMPLETED") {
                setTimeout(() => {
                    orders.delete(orderId);
                    renderOrders();
                }, 2000);
            }
        }

        function renderOrders() {
            const container = document.getElementById("ordersContainer");
            container.innerHTML = "";

            // Group by status: SENT -> READY -> COMPLETED
            const statusOrder = ["SENT", "READY", "COMPLETED"];
            const orderedOrders = Array.from(orders.values())
                .sort((a, b) => statusOrder.indexOf(a.status) - statusOrder.indexOf(b.status));

            orderedOrders.forEach(order => {
                const card = document.createElement("div");
                card.className = `order-card ${order.status.toLowerCase()}`;
                
                const elapsed = Math.floor((Date.now() - order.timestamp) / 60000);
                
                card.innerHTML = `
                    <div class="table">${order.table}</div>
                    <div style="margin-bottom: 10px;">
                        <span class="status ${order.status.toLowerCase()}">${order.status}</span>
                    </div>
                    <div class="items">
                        <strong>${order.itemCount} Items</strong>
                    </div>
                    <div class="elapsed">Waiting ${elapsed} min</div>
                `;

                // Click to update status
                card.addEventListener("click", () => updateStatus(order.id, order.status));
                container.appendChild(card);
            });
        }

        function updateStatus(orderId, currentStatus) {
            const nextStatus = currentStatus === "SENT" ? "READY" : "COMPLETED";
            
            fetch(`/kitchen/order/${orderId}/status`, {
                method: "PATCH",
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ status: nextStatus })
            })
            .then(r => r.json())
            .then(data => {
                console.log("Order updated:", data);
                // WebSocket will notify of the change
            })
            .catch(err => console.error("Update error:", err));
        }

        function updateConnectionStatus(connected) {
            const elem = document.getElementById("connectionStatus");
            if (connected) {
                elem.className = "connection-status connected";
                elem.textContent = "🟢 Connected";
            } else {
                elem.className = "connection-status disconnected";
                elem.textContent = "🔴 Disconnected";
            }
        }

        // Start connection
        connect();
    </script>
</body>
</html>
```

## Database Schema Updates

The `ws_connections` table needs to store branch information:

```sql
ALTER TABLE ws_connections ADD COLUMN branch_id UUID REFERENCES branches(id);
CREATE INDEX idx_ws_branch ON ws_connections(branch_id);
```

## Serverless Configuration

Add WebSocket endpoints to `serverless.yml`:

```yaml
provider:
  name: aws
  runtime: nodejs20.x
  websocketApi:
    routeSelectionExpression: $request.body.action
  environment:
    WEBSOCKET_ENDPOINT: !Sub "https://${WebsocketsApi}.execute-api.${AWS::Region}.amazonaws.com/${Stage}"

functions:
  wsConnect:
    handler: src/kitchen/wsConnect.handler
    events:
      - websocket:
          route: $connect

  wsDisconnect:
    handler: src/kitchen/wsDisconnect.handler
    events:
      - websocket:
          route: $disconnect

  wsOrderUpdate:
    handler: src/kitchen/broadcastOrderUpdate.handler
    events:
      - eventBridge:
          pattern:
            source:
              - kitchen.orders
            detail-type:
              - OrderStatusChanged
```

## Event Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│ CUSTOMER PLACES ORDER                                           │
├─────────────────────────────────────────────────────────────────┤
│ POST /public/order/place                                        │
│   ├─ Create order in DB                                         │
│   ├─ Create order_items                                         │
│   └─ Create KOT (status=SENT)                                   │
└──────────────┬──────────────────────────────────────────────────┘
               │ (Optional: Direct WebSocket call)
               ▼
┌─────────────────────────────────────────────────────────────────┐
│ PUBLISH ORDER_CREATED EVENT                                     │
├─────────────────────────────────────────────────────────────────┤
│ EventBridge Rule triggers WebSocket broadcast                   │
│   └─ Message: { type: "NEW_ORDER", orderId, table, items }    │
└──────────────┬──────────────────────────────────────────────────┘
               │
               ▼ (WebSocket sends to all kitchen displays in branch)
┌─────────────────────────────────────────────────────────────────┐
│ KITCHEN DISPLAY RECEIVES ORDER                                  │
├─────────────────────────────────────────────────────────────────┤
│ Shows new order in "SENT" column                                │
│ Kitchen staff clicks order → POST status update                 │
└──────────────┬──────────────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────────────┐
│ PATCH /kitchen/order/{orderId}/status                          │
├─────────────────────────────────────────────────────────────────┤
│   ├─ Update order status (SENT → READY)                        │
│   ├─ Update KOT status                                          │
│   ├─ Publish ORDER_UPDATED event                               │
│   └─ Trigger EventBridge rule                                  │
└──────────────┬──────────────────────────────────────────────────┘
               │
               ▼ (WebSocket broadcasts to all displays)
┌─────────────────────────────────────────────────────────────────┐
│ ALL KITCHEN DISPLAYS UPDATE IN REAL-TIME                       │
├─────────────────────────────────────────────────────────────────┤
│ Message: { type: "ORDER_UPDATED", orderId, status: "READY" }  │
│   └─ Visual: Move order from SENT column → READY column        │
└─────────────────────────────────────────────────────────────────┘
```

## Key Benefits

✅ **Real-time Updates** - Instant notification to all kitchen displays  
✅ **Low Latency** - WebSocket vs polling (HTTP requests every 5 seconds)  
✅ **Branch Isolation** - Each branch only sees their orders  
✅ **Connection Management** - Automatic cleanup of stale connections  
✅ **Scalable** - Supports 100s of concurrent kitchen displays  
✅ **Cost Effective** - AWS API Gateway WebSocket pricing is efficient  

## Deployment

```bash
serverless deploy --region ap-south-1
```

This will create:
- WebSocket API Gateway endpoint
- Lambda functions for $connect, $disconnect
- EventBridge rules for order updates
- DynamoDB table for connection management (auto-managed by API Gateway)

