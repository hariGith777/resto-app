# WebSocket Testing Guide

## Overview

This guide covers comprehensive testing of the restaurant order management WebSocket features, including real-time order notifications, status updates, and reconnection scenarios.

## Test Suite

### test-websocket-flow.mjs

Complete end-to-end WebSocket testing covering:

1. **Authentication** - Captain and kitchen staff login
2. **WebSocket Connections** - Establishing connections for both roles
3. **Customer Session** - Table session and customer authentication
4. **Order Placement** - Customer orders → Kitchen WebSocket notification
5. **Status Updates** - Kitchen updates → Captain WebSocket notification
6. **Disconnect/Reconnect** - Testing resilience and pending order loading
7. **Cleanup** - Proper connection teardown

## Prerequisites

**IMPORTANT:** Run the E2E setup test first:

```bash
node tests/test-end-to-end.mjs
```

This creates the required infrastructure:
- Restaurant and branch
- Manager, captain, and kitchen staff (with usernames)
- Areas and tables
- Menu categories and items

## Running Tests

### Complete Test Suite

Run both setup and WebSocket tests:

```bash
node tests/test-end-to-end.mjs && node tests/test-websocket-flow.mjs
```

### WebSocket Test Only

If infrastructure already exists:

```bash
node tests/test-websocket-flow.mjs
```

## Test Flow Details

### STEP 1: Authentication Setup

- Captain login: `username: test_captain`
- Kitchen staff login: `username: test_kitchen`
- Extracts branch ID from captain's JWT token

### STEP 2-3: WebSocket Connections

Establishes WebSocket connections for:
- Kitchen staff (connection_type: 'KITCHEN')
- Captain (connection_type: 'CAPTAIN')

WebSocket URL: `wss://a8ga9fssb2.execute-api.ap-south-1.amazonaws.com/dev`

### STEP 4-5: Customer Session

1. Gets active table from captain's branch
2. Starts table session via QR code scan simulation
3. Initiates customer login (OTP request)
4. Captain generates OTP
5. Customer verifies OTP and gets authenticated

### STEP 6: Order Placement → Kitchen Notification

**Flow:**
1. Customer fetches menu categories
2. Customer places order (2x first menu item)
3. Order broadcast to kitchen via WebSocket

**Kitchen receives:**
```json
{
  "type": "NEW_ORDER",
  "orderId": "uuid",
  "totalAmount": {
    "amount": 440,
    "currency": "INR",
    "symbol": "₹",
    "formatted": "₹440.00"
  },
  "itemCount": 1,
  "status": "PLACED",
  "timestamp": "2026-01-16T13:54:30.997Z"
}
```

**Verification:** Kitchen message queue contains NEW_ORDER message

### STEP 7: Kitchen Disconnect/Reconnect

**Test Scenario:**
1. Kitchen WebSocket disconnects (simulating network issue)
2. Kitchen reconnects
3. Kitchen loads pending orders via API: `GET /kitchen/orders?status=SENT`

**Expected Result:** All PLACED/SENT orders are retrieved, allowing kitchen to catch up

**Sample Output:**
```
✅ Found 2 pending order(s)
   - Order #58d972f0... | Main Hall - T1 | PLACED
   - Order #f8489df4... | Main Hall - T1 | PLACED
```

### STEP 8: Status Update → Captain Notification

**Flow:**
1. Kitchen updates order status to READY: `PUT /kitchen/orders/:orderId`
2. Status update broadcast to captain via WebSocket

**Captain receives:**
```json
{
  "type": "ORDER_STATUS_UPDATE",
  "orderId": "uuid",
  "status": "READY",
  "table": "Main Hall - Table 1",
  "timestamp": "2026-01-16T13:54:40.367Z"
}
```

**Verification:** Captain message queue contains ORDER_STATUS_UPDATE message

### STEP 9: Captain Disconnect/Reconnect

**Test Scenario:**
1. Captain WebSocket disconnects
2. Kitchen updates order to COMPLETED (while captain offline)
3. Captain reconnects
4. Captain loads current order status via API: `GET /public/order?sessionId=...`

**Expected Result:** Captain sees updated order status even though update was missed

### STEP 10: Cleanup

- Closes all WebSocket connections
- Terminates database pool
- Reports test summary

## Test Results

### Successful Test Output

```
✅ Kitchen WebSocket: Connected and received order notifications
✅ Captain WebSocket: Connected and received status updates
✅ Kitchen reconnection: Successfully loaded pending orders
✅ Captain reconnection: Successfully loaded order status
✅ Order flow: Customer → Kitchen → Captain (COMPLETED)

Test completed successfully! 🎉
```

## WebSocket Message Types

### NEW_ORDER (→ Kitchen)

Sent when customer places an order.

**Source:** `src/customer/placeOrder.js`  
**Broadcast Function:** `broadcastToKitchen()`

```javascript
{
  type: 'NEW_ORDER',
  orderId: string,
  totalAmount: {
    amount: number,
    currency: string,
    symbol: string,
    formatted: string
  },
  itemCount: number,
  status: 'PLACED',
  timestamp: ISO8601
}
```

### ORDER_STATUS_UPDATE (→ Captain)

Sent when kitchen updates order status.

**Source:** `src/kitchen/updateOrderStatus.js`  
**Broadcast Function:** `broadcastToCaptain()`

```javascript
{
  type: 'ORDER_STATUS_UPDATE',
  orderId: string,
  status: 'READY' | 'COMPLETED' | 'CANCELLED',
  table: string, // e.g., "Main Hall - Table 1"
  timestamp: ISO8601
}
```

## Reconnection Strategy

### Kitchen Reconnection

When kitchen app reconnects:
1. Establish WebSocket connection
2. Load pending orders: `GET /kitchen/orders?status=SENT`
3. Display all PLACED and SENT orders
4. Resume normal operation

### Captain Reconnection

When captain app reconnects:
1. Establish WebSocket connection
2. Load active sessions: `GET /staff/active-tables`
3. For each session, load order status: `GET /public/order?sessionId=...`
4. Update UI with current status
5. Resume receiving real-time updates

## Database Schema

### websocket_connections Table

```sql
CREATE TABLE websocket_connections (
  connection_id VARCHAR(255) PRIMARY KEY,
  staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  connection_type VARCHAR(20) NOT NULL, -- 'KITCHEN' or 'CAPTAIN'
  connected_at TIMESTAMP DEFAULT now()
);
```

**Purpose:** Track active WebSocket connections for broadcasting

**Cleanup:** Stale connections removed on 410 (Gone) status from AWS API Gateway

## Error Handling

### Connection Failures

- **410 Gone:** Connection removed from database, broadcast continues to other connections
- **Network Errors:** Client implements reconnection with pending order/status load

### Missing Data

- **No pending orders:** Kitchen shows empty state
- **No active sessions:** Captain shows no orders
- **Authentication failure:** Test fails with clear error message

## Configuration

### Environment Variables

- `API_BASE`: REST API endpoint (default: production URL)
- `WS_BASE`: WebSocket endpoint (default: production WebSocket URL)
- `DB_URL`: PostgreSQL connection string (optional, defaults to hardcoded value)

### Test Credentials

- **Captain:** `username: test_captain`, `phone: +919876543211`
- **Kitchen:** `username: test_kitchen`, `phone: +919876543299`
- **Customer:** `phone: +919999888877`

## Troubleshooting

### Test fails with "Invalid credentials"

**Cause:** E2E test not run or kitchen staff missing username  
**Solution:** Run `node tests/test-end-to-end.mjs` first

### Test fails with "No active tables"

**Cause:** Database cleared without running E2E setup  
**Solution:** Run E2E test to recreate infrastructure

### WebSocket connection timeout

**Cause:** Network issues or AWS API Gateway unavailable  
**Solution:** Check internet connection and AWS console

### No messages received via WebSocket

**Cause:** Connection not registered in database or wrong branch  
**Solution:** Verify connection_id in websocket_connections table

## Performance Notes

- **Broadcast Efficiency:** Single query fetches all connections per branch
- **Message Size:** Minimal payload (< 500 bytes per message)
- **Latency:** Typically < 200ms from action to WebSocket delivery
- **Stale Connections:** Automatically cleaned up on first 410 error

## Future Enhancements

- [ ] Test multiple concurrent orders
- [ ] Test order modifications (add/remove items)
- [ ] Test multiple captains receiving same update
- [ ] Test multiple kitchen displays simultaneously
- [ ] Performance testing with 100+ concurrent connections
- [ ] Test WebSocket message ordering guarantees

## Related Documentation

- [API Documentation](./API_DOCUMENTATION.md)
- [WebSocket Implementation](../src/common/websocket.js)
- [E2E Testing Guide](./TESTING.md)
