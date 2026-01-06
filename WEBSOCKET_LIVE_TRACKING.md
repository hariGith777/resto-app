# Live Kitchen Order Tracking - Complete Implementation Guide

## How WebSocket Achieves Real-Time Order Updates

### The Problem Without WebSocket
```
Traditional HTTP Polling (❌ Inefficient)
Customer App              Server
    │                       │
    ├──────── GET orders ──▶│
    │◀────────────────────────│ (Poll every 5 seconds)
    │                       │
    ├──────── GET orders ──▶│
    │◀────────────────────────│ (Poll every 5 seconds)
    │                       │
    ├──────── GET orders ──▶│
    │◀────────────────────────│ (Poll every 5 seconds)
    │                       │
    └──────── GET orders ──▶│ (Most polls are empty!)
     (Wasteful, Slow, High Bandwidth)
```

### The Solution With WebSocket
```
WebSocket (✅ Efficient)
Customer App              Server
    │                       │
    └──────── CONNECT ────▶│ (One-time connection)
                           │
    │◀───────── PUSH ──────│ (New order arrives)
    │           ORDER       │
    │                       │
    │◀───────── PUSH ──────│ (Order status changes)
    │          STATUS       │
    │                       │
    │◀───────── PUSH ──────│ (Instant updates)
    │          STATUS       │
    │                       │
    └─────────DISCONNECT──▶│ (Close connection)
    (Low latency, Persistent, One connection)
```

---

## Architecture Components

### 1️⃣ WebSocket Connection Lifecycle

```
KITCHEN DISPLAY LOGIN
        │
        ▼
┌──────────────────────┐
│ Generate JWT Token   │ (staff/login endpoint)
│ Role: KITCHEN        │
│ BranchId: stored     │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────────────────────┐
│ Connect to WebSocket                 │
│ wss://api.../kitchen/display         │
│ ?token={JWT}                         │
└──────────┬───────────────────────────┘
           │
           ▼
┌──────────────────────────────────────┐
│ $connect Route (Lambda)              │
├──────────────────────────────────────┤
│ 1. Verify JWT token                  │
│ 2. Extract role (must be KITCHEN)    │
│ 3. Get branchId from token           │
│ 4. Store in ws_connections table:    │
│    {connection_id, branch_id}        │
│ 5. Return 200 Connected              │
└──────────┬───────────────────────────┘
           │
           ▼
   KITCHEN DISPLAY READY
   (Listening for events)
```

### 2️⃣ Order Placement Event Flow

```
┌─────────────────────────┐
│ Customer Places Order   │
│ POST /public/order/place│
└──────────┬──────────────┘
           │
           ▼
┌──────────────────────────────────────┐
│ Server-Side Processing               │
├──────────────────────────────────────┤
│ 1. Insert order record               │
│ 2. Insert order items (prices)       │
│ 3. Insert KOT (status=SENT)          │
│ 4. Commit transaction                │
└──────────┬───────────────────────────┘
           │
           ▼ (Optional: Direct WebSocket or EventBridge)
┌──────────────────────────────────────┐
│ Publish Order Event                  │
│ (EventBridge Rule)                   │
├──────────────────────────────────────┤
│ Event: {                             │
│   source: "kitchen.orders",          │
│   detailType: "NewOrder",            │
│   detail: {                          │
│     orderId,                         │
│     branchId,                        │
│     status: "SENT"                   │
│   }                                  │
│ }                                    │
└──────────┬───────────────────────────┘
           │
           ▼
┌──────────────────────────────────────┐
│ Lambda: Broadcast New Order          │
├──────────────────────────────────────┤
│ 1. Get all ws_connections for branch │
│ 2. Build message: {                 │
│      type: "NEW_ORDER",             │
│      orderId,                        │
│      table,                          │
│      items,                          │
│      status: "SENT"                  │
│    }                                 │
│ 3. Send via API Gateway Management   │
│ 4. Kitchen displays receive push     │
└──────────┬───────────────────────────┘
           │
           ▼
┌──────────────────────────────────────┐
│ Kitchen Display Browser              │
├──────────────────────────────────────┤
│ onmessage handler:                   │
│ 1. Parse message                     │
│ 2. Add order to DOM                  │
│ 3. Render in "SENT" column           │
│ 4. Enable click-to-confirm button    │
└──────────────────────────────────────┘
```

### 3️⃣ Status Update Event Flow

```
┌──────────────────────────────┐
│ Kitchen Staff Clicks Order   │
│ (Status: SENT → READY)       │
└──────────┬────────────────────┘
           │
           ▼
┌────────────────────────────────────────────┐
│ Browser: POST /kitchen/order/{id}/status   │
│ Body: { status: "READY" }                  │
│ Headers: Authorization: Bearer {token}    │
└──────────┬─────────────────────────────────┘
           │
           ▼
┌────────────────────────────────────────────┐
│ Lambda: updateOrderStatus                  │
├────────────────────────────────────────────┤
│ 1. Verify KITCHEN role from token          │
│ 2. Begin transaction                       │
│ 3. UPDATE orders SET status = 'READY'      │
│ 4. UPDATE kots SET status = 'READY'        │
│ 5. Commit transaction                      │
│ 6. Publish ORDER_UPDATED event             │
│    (via EventBridge.putEvents)             │
└──────────┬─────────────────────────────────┘
           │
           ▼
┌────────────────────────────────────────────┐
│ EventBridge Route: OrderStatusChanged      │
│ Triggers → Lambda: Broadcast               │
└──────────┬─────────────────────────────────┘
           │
           ▼
┌────────────────────────────────────────────┐
│ Lambda: broadcastOrderUpdate               │
├────────────────────────────────────────────┤
│ 1. Query orders table for order details    │
│ 2. Query ws_connections for branch         │
│ 3. Build message:                          │
│    {                                       │
│      type: "ORDER_UPDATED",               │
│      orderId,                              │
│      status: "READY",                      │
│      table,                                │
│      itemCount,                            │
│      timestamp                             │
│    }                                       │
│ 4. Post to each connection via API Gateway │
└──────────┬─────────────────────────────────┘
           │
           ├─────────────────────────────────┐
           │                                 │
           ▼                                 ▼
    KITCHEN 1              KITCHEN 2
    Receives message       Receives message
    │                      │
    ├─ Parse               ├─ Parse
    ├─ Update DOM          ├─ Update DOM
    ├─ Move from SENT      ├─ Move from SENT
    │  to READY column     │  to READY column
    └─ Keep listening      └─ Keep listening
```

---

## Database Schema

### ws_connections Table

```sql
CREATE TABLE ws_connections (
  connection_id TEXT PRIMARY KEY,
  branch_id UUID NOT NULL REFERENCES branches(id),
  connected_at TIMESTAMP DEFAULT now(),
  last_activity TIMESTAMP DEFAULT now()
);

CREATE INDEX idx_ws_branch ON ws_connections(branch_id);
```

**Why Store branch_id?**
- ✅ Filter connections per branch
- ✅ Multi-tenant isolation
- ✅ Efficient bulk messaging

---

## Implementation Comparison: REST vs WebSocket

| Aspect | REST Polling | WebSocket |
|--------|------------|-----------|
| **Connection** | New HTTP request per update | One persistent connection |
| **Latency** | 5-10 seconds (polling interval) | <100ms (instant push) |
| **Bandwidth** | High (many empty polls) | Low (only real updates) |
| **Server Load** | High (many requests) | Low (one connection) |
| **Scalability** | ❌ Poor (N clients = N requests/s) | ✅ Great (persistent connections) |
| **Real-time** | ❌ Delayed by polling interval | ✅ Instant updates |
| **Complexity** | ✅ Simple | Moderate |
| **Cost** | Higher (more Lambda invokes) | Lower (fewer invokes) |

---

## Deployment Configuration

Add to `serverless.yml`:

```yaml
provider:
  name: aws
  runtime: nodejs20.x
  region: ap-south-1
  stage: dev
  environment:
    DATABASE_URL: ${env:DATABASE_URL}
    JWT_SECRET: ${env:JWT_SECRET}
    WEBSOCKET_ENDPOINT: !Sub "https://${WebsocketsApi}.execute-api.${AWS::Region}.amazonaws.com/${Stage}"

functions:
  # WebSocket Route: $connect
  wsConnect:
    handler: src/kitchen/wsConnect.handler
    events:
      - websocket:
          route: $connect

  # WebSocket Route: $disconnect
  wsDisconnect:
    handler: src/kitchen/wsDisconnect.handler
    events:
      - websocket:
          route: $disconnect

  # REST API: Update order status
  updateOrderStatus:
    handler: src/kitchen/updateOrderStatus.handler
    events:
      - httpApi:
          path: /kitchen/order/{orderId}/status
          method: patch

  # EventBridge Trigger: Broadcast order updates
  broadcastOrderUpdate:
    handler: src/kitchen/broadcastOrderUpdate.handler
    events:
      - eventBridge:
          pattern:
            source:
              - kitchen.orders
            detail-type:
              - OrderStatusChanged
              - NewOrder
```

---

## Kitchen Display Client Implementation

```javascript
class KitchenDisplay {
  constructor() {
    this.ws = null;
    this.orders = new Map();
    this.token = localStorage.getItem('kitchenToken');
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
  }

  connect() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//YOUR_WEBSOCKET_ENDPOINT?token=${this.token}`;
    
    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      console.log('✅ Connected to kitchen display');
      this.reconnectAttempts = 0;
      this.updateConnectionStatus(true);
      this.syncOrders(); // Get any missed orders
    };

    this.ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        this.handleMessage(message);
      } catch (e) {
        console.error('Failed to parse message:', e);
      }
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      this.updateConnectionStatus(false);
    };

    this.ws.onclose = () => {
      console.log('Disconnected from kitchen display');
      this.updateConnectionStatus(false);
      this.attemptReconnect();
    };
  }

  handleMessage(message) {
    switch (message.type) {
      case 'NEW_ORDER':
        this.addOrder(message);
        break;
      case 'ORDER_UPDATED':
        this.updateOrder(message);
        break;
      default:
        console.warn('Unknown message type:', message.type);
    }
  }

  addOrder(message) {
    const { orderId, status, table, itemCount } = message;
    this.orders.set(orderId, {
      id: orderId,
      status,
      table,
      itemCount,
      timestamp: new Date(message.timestamp),
      elapsedTime: 0
    });
    this.render();
  }

  updateOrder(message) {
    const order = this.orders.get(message.orderId);
    if (order) {
      order.status = message.status;
      order.timestamp = new Date(message.timestamp);
      
      if (message.status === 'COMPLETED') {
        // Keep for 2 seconds, then remove
        setTimeout(() => {
          this.orders.delete(message.orderId);
          this.render();
        }, 2000);
      } else {
        this.render();
      }
    }
  }

  render() {
    const container = document.getElementById('orders');
    container.innerHTML = '';

    // Group by status
    const grouped = { SENT: [], READY: [], COMPLETED: [] };
    
    this.orders.forEach((order) => {
      if (grouped[order.status]) {
        grouped[order.status].push(order);
      }
    });

    ['SENT', 'READY', 'COMPLETED'].forEach((status) => {
      const column = document.createElement('div');
      column.className = `column column-${status.toLowerCase()}`;
      column.innerHTML = `<h2>${status}</h2>`;

      grouped[status].forEach((order) => {
        const card = document.createElement('div');
        card.className = `order-card status-${status.toLowerCase()}`;
        card.innerHTML = `
          <div class="table">${order.table}</div>
          <div class="items">${order.itemCount} items</div>
          <div class="elapsed">${this.formatElapsed(order.timestamp)}</div>
          <button onclick="kitchen.updateStatus('${order.id}', '${status}')">
            ${status === 'SENT' ? 'Mark Ready' : 'Complete'}
          </button>
        `;
        column.appendChild(card);
      });

      container.appendChild(column);
    });
  }

  updateStatus(orderId, currentStatus) {
    const nextStatus = currentStatus === 'SENT' ? 'READY' : 'COMPLETED';
    
    fetch(`/kitchen/order/${orderId}/status`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ status: nextStatus })
    })
    .then(r => r.json())
    .then(() => {
      // WebSocket will notify of change
      console.log(`Order ${orderId} updated to ${nextStatus}`);
    })
    .catch(err => console.error('Update failed:', err));
  }

  attemptReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
      console.log(`Reconnecting in ${delay / 1000}s (attempt ${this.reconnectAttempts})`);
      setTimeout(() => this.connect(), delay);
    }
  }

  updateConnectionStatus(connected) {
    const elem = document.getElementById('connectionStatus');
    if (connected) {
      elem.className = 'connected';
      elem.textContent = '🟢 Connected';
    } else {
      elem.className = 'disconnected';
      elem.textContent = '🔴 Disconnected';
    }
  }

  formatElapsed(timestamp) {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return `${seconds}s`;
    return `${Math.floor(seconds / 60)}m`;
  }

  syncOrders() {
    // Fetch current orders in case any were missed
    fetch(`/kitchen/orders?status=SENT`, {
      headers: { 'Authorization': `Bearer ${this.token}` }
    })
    .then(r => r.json())
    .then(data => {
      data.orders.forEach(order => {
        if (!this.orders.has(order.orderId)) {
          this.addOrder(order);
        }
      });
    });
  }
}

// Initialize
const kitchen = new KitchenDisplay();
kitchen.connect();
```

---

## Performance Metrics

### Without WebSocket (HTTP Polling)
- **Latency:** 2.5s average (5s interval, half on average)
- **Requests/minute:** 12 per client (720 for 60 clients)
- **Bandwidth/hour:** ~1.2 MB per client
- **Lambda invokes:** 12 per client per minute

### With WebSocket
- **Latency:** 50ms average (instant push)
- **Connections:** 1 persistent per client
- **Bandwidth/hour:** ~10 KB per client (only real updates)
- **Lambda invokes:** Only on actual order changes

### Cost Comparison (100 kitchen displays, 8 hours/day, 30 days)
```
HTTP Polling:
  12 requests/min × 100 clients × 480 min/day × 30 days = 1.728M invokes
  Cost: ~$34.56/month

WebSocket:
  Connection-hours: 100 × 8 × 30 = 24,000
  Message cost (500/day avg): 500 × 30 = 15,000
  Cost: ~$18.00/month

Savings: ~48% reduction
```

---

## Conclusion

WebSockets provide:
✅ **Real-time updates** (instant vs 2.5s delay)
✅ **Lower bandwidth** (only changes, not polls)
✅ **Reduced server load** (1 connection vs many requests)
✅ **Better user experience** (no refresh delays)
✅ **Cost savings** (fewer Lambda invokes)

Perfect for kitchen display systems where instant order notifications are critical!
