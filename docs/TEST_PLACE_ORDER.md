# Place Order Endpoint Tests

## ✅ Implementation Summary

The `POST /public/order/place` endpoint has been successfully implemented with full database integration:

### Features Implemented
1. **Order Creation** - Records new orders with session_id and status=PLACED
2. **Order Items** - Snapshots menu item prices at order time (prevents price changes affecting past orders)
3. **Price Calculation** - Calculates total_amount from base_price * qty for each item
4. **Portion Support** - Allows ordering with specific portion IDs (which have different prices)
5. **KOT Creation** - Automatically creates Kitchen Order Ticket with status=SENT
6. **Transaction Support** - Uses database transactions to ensure data consistency
7. **Multiple Orders Per Session** - Supports multiple orders per table session (add-ons, desserts, drinks)

---

## API Endpoint

```
POST /public/order/place?sessionId={sessionId}
```

### Request Format
```json
{
  "items": [
    {
      "menuItemId": "uuid",
      "portionId": "uuid (optional)",
      "qty": 2
    }
  ]
}
```

### Response (201 Created)
```json
{
  "orderId": "uuid",
  "totalAmount": 120.00,
  "itemCount": 1,
  "status": "PLACED"
}
```

---

## ✅ Test Results

### Test 1: Single Item Order
**Request:**
```bash
curl -X POST "https://c83055bt54.execute-api.ap-south-1.amazonaws.com/public/order/place?sessionId=ab8256f9-088f-4466-8498-c9338ccc2936" \
  -H "Content-Type: application/json" \
  -d '{"items":[{"menuItemId":"ea4a509f-5d7a-4e4d-867a-0457e7961ad6","qty":2}]}'
```

**Response:**
```json
{
  "orderId": "fc4377ba-a842-4d6e-ab5d-ad5541c20aa7",
  "totalAmount": 120,
  "itemCount": 1,
  "status": "PLACED"
}
```

**Verification:**
- ✅ Order created in `orders` table
- ✅ Price snapshot: 2 × 60.00 (Pakora) = 120.00
- ✅ Order item inserted in `order_items` table
- ✅ KOT created with status=SENT

---

### Test 2: Multiple Orders Per Session
**Scenario:** Same table session, customer places add-on order

**Orders Created:**
| Order ID | Total Amount | Item Count | Status |
|----------|-------------|-----------|--------|
| 5e8f729e... | 60.00 | 1 | PLACED |
| 377fb997... | 300.00 | 2 | PLACED |
| bb35b7a9... | 540.00 | 3 | PLACED |
| fc4377ba... | 120.00 | 1 | PLACED |
| edb7f328... | 240.00 | 2 | PLACED |

**Result:** ✅ All 5 orders successfully created in same session with individual KOTs

---

### Test 3: Get Order Details
**Request:**
```bash
GET https://c83055bt54.execute-api.ap-south-1.amazonaws.com/public/order/fc4377ba-a842-4d6e-ab5d-ad5541c20aa7
```

**Response:**
```json
{
  "id": "fc4377ba-a842-4d6e-ab5d-ad5541c20aa7",
  "session_id": "ab8256f9-088f-4466-8498-c9338ccc2936",
  "customer_id": null,
  "status": "PLACED",
  "total_amount": "120.00",
  "created_at": "2026-01-06T10:08:50.222Z",
  "items": [
    {
      "id": "ebf58043-4c09-4b1e-9f53-f6373123b207",
      "menu_item_id": "ea4a509f-5d7a-4e4d-867a-0457e7961ad6",
      "portion_id": null,
      "qty": 2,
      "price": "60.00",
      "name": "Pakora",
      "description": "Battered and deep-fried vegetables"
    }
  ]
}
```

**Result:** ✅ Order retrieval with nested items and snapshotted prices

---

### Test 4: Error Handling

**Test 4.1: Missing sessionId**
```bash
curl -X POST "https://c83055bt54.execute-api.ap-south-1.amazonaws.com/public/order/place" \
  -H "Content-Type: application/json" \
  -d '{"items":[{"menuItemId":"ea4a509f-5d7a-4e4d-867a-0457e7961ad6","qty":1}]}'
```

**Response:** ✅ 400 - `{"error":"sessionId required"}`

**Test 4.2: Invalid sessionId**
```bash
curl -X POST "https://c83055bt54.execute-api.ap-south-1.amazonaws.com/public/order/place?sessionId=invalid-uuid" \
  -H "Content-Type: application/json" \
  -d '{"items":[{"menuItemId":"ea4a509f-5d7a-4e4d-867a-0457e7961ad6","qty":1}]}'
```

**Response:** ✅ 404 - `{"error":"Session not found"}`

**Test 4.3: Empty items array**
```bash
curl -X POST "https://c83055bt54.execute-api.ap-south-1.amazonaws.com/public/order/place?sessionId=ab8256f9-088f-4466-8498-c9338ccc2936" \
  -H "Content-Type: application/json" \
  -d '{"items":[]}'
```

**Response:** ✅ 400 - `{"error":"items array required"}`

**Test 4.4: Invalid menu item**
```bash
curl -X POST "https://c83055bt54.execute-api.ap-south-1.amazonaws.com/public/order/place?sessionId=ab8256f9-088f-4466-8498-c9338ccc2936" \
  -H "Content-Type: application/json" \
  -d '{"items":[{"menuItemId":"invalid-uuid","qty":1}]}'
```

**Response:** ✅ 404 - `{"error":"Menu item invalid-uuid not found"}`

---

## Database Schema Verification

### Orders Table
```
id (UUID) | session_id (FK) | customer_id (FK) | status | total_amount | created_at
```

### Order Items Table
```
id (UUID) | order_id (FK) | menu_item_id (FK) | portion_id (FK) | qty | price (SNAPSHOT)
```

### KOTs Table
```
id (UUID) | order_id (FK) | status | created_at
```

---

## Key Implementation Details

### 1. Price Snapshotting
```javascript
// Prices captured at order time, not at billing
if (portionId) {
  const portionRes = await client.query(
    "SELECT price FROM menu_portions WHERE id = $1 AND menu_item_id = $2",
    [portionId, menuItemId]
  );
  itemPrice = portionRes.rows[0].price;
} else {
  const itemRes = await client.query(
    "SELECT base_price FROM menu_items WHERE id = $1",
    [menuItemId]
  );
  itemPrice = itemRes.rows[0].base_price;
}
```

### 2. Transaction Management
```javascript
const client = await db.pool.connect();
try {
  await client.query("BEGIN");
  // Create order, items, KOT
  await client.query("COMMIT");
} catch (txError) {
  await client.query("ROLLBACK");
  throw txError;
} finally {
  client.release();
}
```

### 3. KOT Status = "SENT"
Indicates the KOT has been sent to kitchen and is awaiting preparation.

---

## Next Steps

### 4️⃣ KOT Kitchen Flow (Implement Next)
- [ ] `PATCH /kitchen/order/{orderId}/status` - Update KOT status to READY/COMPLETED
- [ ] WebSocket push to kitchen on NEW_KOT
- [ ] Kitchen display screen integration

### 5️⃣ Billing System
- [ ] `GET /public/bill/{sessionId}` - Generate bill for completed orders
- [ ] Bill creation with subtotal, tax, service charge calculation
- [ ] Payment integration

### 6️⃣ Customer Session Linking
- [ ] Link customer_profile_id after OTP verification
- [ ] Update orders with customer_id once verified

---

## Deployment Status

**✅ Deployed to:** `ap-south-1` region  
**✅ Endpoint Live:** https://c83055bt54.execute-api.ap-south-1.amazonaws.com/public/order/place  
**✅ Lambda Size:** 61 MB  
**✅ Tests Passed:** All error scenarios + happy path
