# Captain Orders Feature

## Overview
The Captain Orders feature allows restaurant captains to view and monitor all active orders in their branch with real-time status updates.

## Endpoint

### Get Captain Orders
**GET** `/captain/orders`

Retrieves all active orders (orders from sessions that haven't ended) in the captain's branch, with optional status filtering.

## Authentication
- **Required:** Yes
- **Role:** `CAPTAIN`
- **Header:** `Authorization: Bearer <captain_token>`

The captain must be authenticated and have a valid JWT token. The endpoint automatically filters orders by the captain's branch ID from the token.

## Query Parameters

| Parameter | Type | Required | Description | Values |
|-----------|------|----------|-------------|--------|
| `status` | string | No | Filter orders by status | `PLACED`, `SENT`, `READY`, `COMPLETED`, `CANCELLED` |

## Response Format

```json
{
  "orders": [
    {
      "id": "uuid",
      "status": "PLACED",
      "totalAmount": 560,
      "table": "Main Hall - Table 1",
      "tableNumber": 1,
      "areaName": "Main Hall",
      "items": [
        {
          "id": "uuid",
          "menuItemId": "uuid",
          "menuItemName": "Butter Chicken",
          "quantity": 2,
          "portionLabel": "Full",
          "itemPrice": 350
        }
      ],
      "itemCount": 4,
      "customerPhones": ["+919999888877"],
      "createdAt": "2024-01-15T10:30:00.000Z",
      "sessionId": "uuid"
    }
  ],
  "ordersByStatus": {
    "PLACED": [...],
    "SENT": [...],
    "READY": [...],
    "COMPLETED": [...],
    "CANCELLED": [...]
  },
  "summary": {
    "placed": 2,
    "sent": 3,
    "ready": 1,
    "completed": 5,
    "cancelled": 0
  }
}
```

## Response Fields

### Order Object
| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Order UUID |
| `status` | string | Current order status |
| `totalAmount` | number | Total order amount |
| `table` | string | Formatted table location (Area - Table Number) |
| `tableNumber` | number | Table number |
| `areaName` | string | Area name |
| `items` | array | Array of order items |
| `itemCount` | number | Count of items in order |
| `customerPhones` | array | Customer phone numbers at the table |
| `createdAt` | string | Order creation timestamp |
| `sessionId` | string | Table session UUID |

### Order Item Object
| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Order item UUID |
| `menuItemId` | string | Menu item UUID |
| `menuItemName` | string | Menu item name |
| `quantity` | number | Quantity ordered |
| `portionLabel` | string | Portion size (e.g., "Half", "Full") |
| `itemPrice` | number | Item price |

## Order Status Flow

```
PLACED → SENT → READY → COMPLETED
   ↓        ↓      ↓
CANCELLED ←←←←←←←←←
```

- **PLACED**: Order placed by customer, waiting to be sent to kitchen
- **SENT**: Order sent to kitchen, being prepared
- **READY**: Order prepared, ready for serving
- **COMPLETED**: Order delivered to customer
- **CANCELLED**: Order cancelled (can happen at any stage)

## Example Requests

### Get All Orders

```bash
curl -X GET \
  https://c83055bt54.execute-api.ap-south-1.amazonaws.com/captain/orders \
  -H 'Authorization: Bearer <captain_token>'
```

### Get Orders by Status

```bash
curl -X GET \
  'https://c83055bt54.execute-api.ap-south-1.amazonaws.com/captain/orders?status=PLACED' \
  -H 'Authorization: Bearer <captain_token>'
```

## Use Cases

### 1. Captain Dashboard
Display all active orders grouped by status for quick overview:

```javascript
const response = await fetch(`${API_BASE}/captain/orders`, {
  headers: { 'Authorization': `Bearer ${captainToken}` }
});

const { ordersByStatus, summary } = await response.json();

// Show summary in dashboard
console.log(`Pending Orders: ${summary.placed + summary.sent + summary.ready}`);
console.log(`Completed Today: ${summary.completed}`);

// Display orders by status
for (const [status, orders] of Object.entries(ordersByStatus)) {
  console.log(`${status}: ${orders.length} orders`);
}
```

### 2. Order Monitoring
Monitor specific order statuses for action:

```javascript
// Get orders ready for serving
const response = await fetch(`${API_BASE}/captain/orders?status=READY`, {
  headers: { 'Authorization': `Bearer ${captainToken}` }
});

const { orders } = await response.json();

// Alert captain about ready orders
orders.forEach(order => {
  notifyCaptain(`Order #${order.id} ready at ${order.table}`);
});
```

### 3. Table Management
Track orders per table for better service:

```javascript
const response = await fetch(`${API_BASE}/captain/orders`, {
  headers: { 'Authorization': `Bearer ${captainToken}` }
});

const { orders } = await response.json();

// Group by table
const ordersByTable = orders.reduce((acc, order) => {
  const key = `${order.areaName}-${order.tableNumber}`;
  acc[key] = acc[key] || [];
  acc[key].push(order);
  return acc;
}, {});

// Show busy tables
console.log('Busy Tables:', Object.keys(ordersByTable));
```

## Integration with WebSocket

For real-time updates, combine this endpoint with WebSocket notifications:

```javascript
// Connect to WebSocket
const ws = new WebSocket('wss://a8ga9fssb2.execute-api.ap-south-1.amazonaws.com/dev');

ws.onopen = () => {
  ws.send(JSON.stringify({
    action: 'authenticate',
    token: captainToken
  }));
};

// Listen for order updates
ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  
  if (message.type === 'ORDER_STATUS_UPDATE') {
    // Refresh orders when status changes
    refreshOrders();
  }
};

async function refreshOrders() {
  const response = await fetch(`${API_BASE}/captain/orders`, {
    headers: { 'Authorization': `Bearer ${captainToken}` }
  });
  
  const data = await response.json();
  updateUI(data);
}
```

## Error Responses

### 401 Unauthorized
```json
{
  "error": "Authorization token required"
}
```
**Cause:** No token provided in Authorization header

### 403 Forbidden
```json
{
  "error": "Captain access required"
}
```
**Cause:** User role is not CAPTAIN

```json
{
  "error": "No branch access"
}
```
**Cause:** Captain token doesn't contain branchId

### 500 Internal Server Error
```json
{
  "message": "Internal Server Error"
}
```
**Cause:** Database connection issue or query error

## Testing

Run the automated test:

```bash
node tests/test-captain-orders.mjs
```

The test verifies:
- Captain authentication
- Order fetching
- Response structure
- Status filtering
- Required fields presence

## Database Query

The endpoint performs a complex join across multiple tables:

```sql
SELECT 
  o.id, o.status, o.total_amount, o.created_at,
  t.table_number, a.name as area_name,
  json_agg(order_items) as items,
  array_agg(customer_phones) as customer_phones
FROM orders o
JOIN table_sessions ts ON ts.id = o.session_id
JOIN tables t ON t.id = ts.table_id
JOIN areas a ON a.id = t.area_id
LEFT JOIN order_items oi ON oi.order_id = o.id
LEFT JOIN menu_items mi ON mi.id = oi.menu_item_id
LEFT JOIN menu_portions mp ON mp.id = oi.portion_id
LEFT JOIN customers c ON c.session_id = ts.id
WHERE a.branch_id = $1 AND ts.ended_at IS NULL
GROUP BY o.id, ...
ORDER BY status, created_at DESC
```

## Performance Considerations

- Orders are filtered by `ts.ended_at IS NULL` to only show active sessions
- Results are ordered by status priority (PLACED first) then by creation time
- Uses LEFT JOINs to include orders without items or customers
- Aggregates items and phones using JSON functions for efficient response

## Future Enhancements

1. **Pagination**: Add limit/offset for branches with many orders
2. **Date Range**: Filter orders by date range
3. **Table Filtering**: Filter by specific area or table
4. **Order Details**: Deep link to specific order details
5. **Export**: Export orders to CSV for reporting
6. **Analytics**: Order preparation time analysis
