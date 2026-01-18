# WebSocket Kitchen Display - Setup Guide

## 🎯 What This Does

Real-time kitchen notifications! When a customer or captain places an order, the kitchen display updates **instantly** without refreshing or polling.

---

## 📋 Prerequisites

✅ WebSocket deployed (already done - `wss://a8ga9fssb2.execute-api.ap-south-1.amazonaws.com/dev`)  
✅ Kitchen staff user exists in database (username: `chef_kumar`)  
✅ Orders table and menu items seeded

---

## 🚀 Step-by-Step Instructions

### Step 1: Open Kitchen Display in Browser

**Option A: Using Finder (Easiest)**
1. Open Finder
2. Navigate to: `/Users/apple/Documents/Coco/resto-app/`
3. Double-click `test-websocket-kitchen.html`
4. Browser will open automatically

**Option B: Using Terminal**
```bash
cd /Users/apple/Documents/Coco/resto-app
open test-websocket-kitchen.html
```

**Option C: Direct Browser URL**
1. Open Chrome/Safari/Firefox
2. Press `Cmd + L` (address bar)
3. Type: `file:///Users/apple/Documents/Coco/resto-app/test-websocket-kitchen.html`
4. Press Enter

---

### Step 2: Kitchen Display Auto-Connects

**What you'll see:**
```
🍽️ Kitchen Display System

Connect to Kitchen WebSocket
[chef_kumar] [kitchen123] [Connect]

Status: ✅ Connected
```

**Credentials (pre-filled):**
- Username: `chef_kumar`
- Password: `kitchen123`

The page auto-connects on load. If it says "Disconnected", click **Connect** button.

---

### Step 3: Place a Test Order

**Open a new terminal window** (keep browser open):

```bash
cd /Users/apple/Documents/Coco/resto-app
node test-captain-order.mjs
```

**What happens:**
1. Captain logs in
2. Selects a table
3. Places an order
4. Order goes to Lambda
5. **Kitchen display instantly shows notification** 🔔

---

### Step 4: See Real-Time Notification

**In the browser, you'll see:**

```
📋 Incoming Orders (Real-Time)

🔔 NEW ORDER #b0dfc476
Items: 2
Total: ₹150
Time: 12:53:02 AM
Status: PLACED
```

**Features:**
- 🟠 Orange border for new orders (3 seconds)
- 🔵 Blue border for acknowledged orders
- 🔔 Browser notification sound plays
- ⏰ Real-time timestamp
- 📊 Order details (items, total, status)

---

## 🧪 Alternative Test Methods

### Method 1: Use Postman (Manual Order)

1. **Login as Captain:**
   ```
   POST https://c83055bt54.execute-api.ap-south-1.amazonaws.com/staff/login
   Body: {
     "username": "captainuser",
     "password": "captain123"
   }
   ```
   Copy the `token` from response.

2. **Get a table ID from database:**
   ```bash
   node -e "
   import('pg').then(async ({ default: pg }) => {
     const { Pool } = pg;
     const pool = new Pool({ connectionString: 'postgresql://postgres.exjztcguwxtmdpzmwgxc:azLJKyqgJnf4xRGS@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres?sslmode=disable&pgbouncer=true' });
     const res = await pool.query('SELECT id FROM tables LIMIT 1');
     console.log('Table ID:', res.rows[0].id);
     await pool.end();
   });
   "
   ```

3. **Start session:**
   ```
   POST https://c83055bt54.execute-api.ap-south-1.amazonaws.com/public/qr/session/start
   Body: {
     "tableId": "<paste-table-id>"
   }
   ```
   Copy the `sessionId` from response.

4. **Get menu item IDs:**
   ```bash
   node -e "
   import('pg').then(async ({ default: pg }) => {
     const { Pool } = pg;
     const pool = new Pool({ connectionString: 'postgresql://postgres.exjztcguwxtmdpzmwgxc:azLJKyqgJnf4xRGS@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres?sslmode=disable&pgbouncer=true' });
     const res = await pool.query('SELECT id, name FROM menu_items LIMIT 2');
     res.rows.forEach(r => console.log(r.name + ':', r.id));
     await pool.end();
   });
   "
   ```

5. **Place order (watch kitchen display!):**
   ```
   POST https://c83055bt54.execute-api.ap-south-1.amazonaws.com/public/order/place?sessionId=<session-id>
   Headers: {
     "Authorization": "Bearer <captain-token>",
     "Content-Type": "application/json"
   }
   Body: {
     "items": [
       {"menuItemId": "<menu-item-id-1>", "qty": 2},
       {"menuItemId": "<menu-item-id-2>", "qty": 1}
     ]
   }
   ```

**Result:** Kitchen display updates instantly! 🎉

---

### Method 2: Automated Test Script

```bash
# Keep kitchen display open in browser, then run:
node test-websocket.mjs
```

This script:
- ✅ Connects kitchen to WebSocket
- ✅ Places an order as captain
- ✅ Verifies kitchen receives notification
- ✅ Shows timing (< 100ms latency)

---

## 🔍 Troubleshooting

### Issue: "Disconnected" Status

**Check:**
1. Kitchen user exists: `chef_kumar` / `kitchen123`
2. WebSocket endpoint is correct in HTML (line 87)
3. Lambda functions deployed: `serverless deploy`

**Fix:**
```bash
# Re-deploy WebSocket functions
export DATABASE_URL="postgresql://postgres.exjztcguwxtmdpzmwgxc:azLJKyqgJnf4xRGS@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres?sslmode=disable&pgbouncer=true"
export JWT_SECRET="dev_secret_for_tests"
serverless deploy
```

---

### Issue: Login Failed

**Check database for kitchen user:**
```bash
node -e "
import('pg').then(async ({ default: pg }) => {
  const { Pool } = pg;
  const pool = new Pool({ connectionString: 'postgresql://postgres.exjztcguwxtmdpzmwgxc:azLJKyqgJnf4xRGS@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres?sslmode=disable&pgbouncer=true' });
  const res = await pool.query(\"SELECT username, role FROM staff WHERE role = 'KITCHEN'\");
  console.log('Kitchen users:', res.rows);
  await pool.end();
});
"
```

**Create kitchen user if missing:**
```sql
INSERT INTO staff (branch_id, name, username, role, phone)
SELECT id, 'Chef Kumar', 'chef_kumar', 'KITCHEN', '9999999999'
FROM branches LIMIT 1;
```

---

### Issue: No Notifications Received

**Verify WebSocket connection in browser console:**
1. Open browser DevTools (F12)
2. Go to Console tab
3. Should see: `"WebSocket connected"`
4. Place order
5. Should see: `"Message received: ..."`

**Check Lambda logs:**
```bash
serverless logs --function placeOrder --tail
```

---

## 🎨 Customization

### Change Kitchen Credentials

Edit `test-websocket-kitchen.html` (lines 62-63):
```html
<input type="text" id="username" value="your_username">
<input type="password" id="password" value="your_password">
```

### Change WebSocket URL

Edit `test-websocket-kitchen.html` (line 87):
```javascript
wsUrl = 'wss://YOUR_NEW_WEBSOCKET_URL/dev';
```

### Disable Auto-Connect

Edit `test-websocket-kitchen.html` (line 188):
```javascript
// Comment out this line:
// window.onload = () => connect();
```

---

## 📊 What's Happening Behind the Scenes

```
┌─────────────────┐         ┌──────────────┐         ┌─────────────┐
│  Browser        │         │  AWS Lambda  │         │  Database   │
│  (Kitchen)      │         │              │         │             │
└────────┬────────┘         └──────┬───────┘         └──────┬──────┘
         │                         │                        │
         │ 1. Connect WS          │                        │
         │─────────────────────────>│                       │
         │   (with JWT token)      │                       │
         │                         │ 2. Verify token       │
         │                         │ 3. Store connection   │
         │                         │──────────────────────>│
         │ 4. Connection OK        │                       │
         │<─────────────────────────│                       │
         │                         │                        │
         │                         │ 5. New order placed   │
         │                         │<──────────────────────│
         │                         │ 6. Get kitchen WS IDs │
         │                         │──────────────────────>│
         │                         │<──────────────────────│
         │ 7. Push notification    │                       │
         │<─────────────────────────│                       │
         │ [INSTANT UPDATE!]       │                       │
         │                         │                        │
```

**Latency:** < 100ms from order placement to kitchen notification

---

## 🎯 Next Steps

1. **Build a real kitchen display app** (React/Vue/Flutter)
2. **Add order status updates** (preparing, ready, served)
3. **Add KOT printing** via WebSocket
4. **Add sound notifications** (different sounds for different order types)
5. **Add table number display** (show which table the order is from)
6. **Add filters** (pending, in-progress, completed)

---

## 📞 Support

**WebSocket Endpoint:**  
`wss://a8ga9fssb2.execute-api.ap-south-1.amazonaws.com/dev`

**HTTP API Endpoint:**  
`https://c83055bt54.execute-api.ap-south-1.amazonaws.com`

**Database:**  
Supabase PostgreSQL (connection string in .env)

**Logs:**  
```bash
serverless logs --function wsConnect --tail
serverless logs --function placeOrder --tail
```
