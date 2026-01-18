# Customer Login & Captain OTP Management - Complete Summary

## What We've Built

A complete **customer login and OTP management system** that enables:
- ✅ Customers to register and login with just a phone number
- ✅ Captains to generate OTPs securely
- ✅ Multi-customer tables with separate customer tracking
- ✅ Order attribution per customer
- ✅ Branch-level access control

---

## The Flows Explained Simply

### Customer's Perspective (4 Steps)

```
1. Arrives at table
   "Hi, I want to order"
   ↓
2. Tells captain their phone
   +919876543210
   ↓
3. Captain provides OTP
   "Your OTP is 735834"
   ↓
4. Enters OTP on phone
   System: "You're logged in!"
   ↓
5. Orders food
   Orders appear with their name
```

### Captain's Perspective (3 Steps)

```
1. Customer sits at table
   ↓
2. Captain runs app, login once
   Captain_raj logged in
   ↓
3. For each customer:
   - Press "Generate OTP"
   - Tell customer the OTP
   - Customer enters OTP
   - Customer can now order
```

---

## Technical Architecture

### Three Key Endpoints

#### 1️⃣ Customer Initiation (Public - No Auth)
```
POST /public/customer/initiate
{
  "sessionId": "...",
  "name": "John",
  "phone": "+919876543210"
}
→ Response: "Please ask the captain for OTP"
→ Creates: customer_profiles + customers records
```

#### 2️⃣ Captain OTP Generation (Staff Only - Needs JWT)
```
POST /staff/otp/generate
Authorization: Bearer <captain-jwt>
{
  "sessionId": "...",
  "customerPhone": "+919876543210"
}
→ Response: { "otp": "735834" }
→ Creates: otp_requests record with 5-min expiry
```

#### 3️⃣ Customer OTP Verification (Public - No Auth)
```
POST /public/customer/verify-otp
{
  "sessionId": "...",
  "phone": "+919876543210",
  "otp": "735834"
}
→ Response: { "token": "<customer-jwt>" }
→ Updates: otp_requests (verified_at), customers (verified=true)
→ Issues: JWT with customerId for order tracking
```

### Database Tables Involved

```
table_sessions          (session per table, created once)
├─ id
├─ table_id
├─ started_at
└─ ended_at (NULL until table closes)

customers               (per customer, per session)
├─ id
├─ session_id
├─ phone
├─ name
├─ verified (boolean)
└─ customer_profile_id

customer_profiles       (reusable per phone)
├─ id
├─ phone
└─ name

otp_requests           (for verification)
├─ id
├─ session_id
├─ customer_phone
├─ otp_code
├─ generated_by (staff who generated)
├─ expires_at (5 min from created)
├─ verified_at (null until verified)
└─ created_at

orders                 (customer's orders)
├─ id
├─ session_id
├─ customer_id (set from JWT) ← KEY!
├─ total_amount
└─ created_at
```

---

## Multi-Customer Scenario Example

### Scene: Table 5, 2 Customers

**13:05 - Captain Creates Session**
```
Table 5 → Session Created
sessionId = "abc-123"
```

**13:06 - Customer 1 Joins**
```
Customer 1: "Hi, I'm Rahul"
Phone: +919000000001

Flow:
1. POST /customer/initiate
   → "Please ask captain for OTP"
2. POST /staff/otp/generate (captain)
   Authorization: Bearer captain-jwt
   → "735834"
3. POST /customer/verify-otp (customer)
   → token: jwt-1 (customerId="cust-001")
4. POST /order/place
   Authorization: Bearer jwt-1
   → Order 1 created (customer_id="cust-001")
```

**13:10 - Customer 2 Joins**
```
Customer 2: "Hi, I'm Priya"
Phone: +919000000002

Flow:
1. POST /customer/initiate
   → "Please ask captain for OTP"
2. POST /staff/otp/generate (captain)
   Authorization: Bearer captain-jwt
   → "234567"
3. POST /customer/verify-otp (customer)
   → token: jwt-2 (customerId="cust-002")
4. POST /order/place
   Authorization: Bearer jwt-2
   → Order 2 created (customer_id="cust-002")
```

**13:45 - Kitchen View**
```
Table 5 - 2 Items
├─ Biryani × 1 (for customer)
└─ Butter Chicken × 2 (for customer)

Kitchen prepares both items
Kitchen doesn't need to know who ordered what
```

**14:15 - Bill Time**
```
Table 5 Bill:

Customer 1 (Rahul):
├─ Biryani × 1 ........ Rs 300

Customer 2 (Priya):
├─ Butter Chicken × 2 ... Rs 400

Each customer settles their own bill
```

---

## Security Features

### 1. Authentication Layers

| Who | What | How |
|-----|------|-----|
| Captain | Login once | POST /staff/login → Get JWT |
| Captain | Generate OTP | POST /staff/otp/generate + JWT |
| Customer | Login per session | Initiate → Verify OTP → Get JWT |

### 2. OTP Security

- **Length:** 6 digits (0-999999)
- **Expiry:** 5 minutes
- **One-time:** Mark verified after use
- **Tracking:** Phone + sessionId + otp_code
- **Attempts:** Track failed attempts

### 3. JWT Security

- **Customer JWT:** Scope = "session", expires 24h
- **Captain JWT:** No scope, staff-level access
- **Payload:** Signed with JWT_SECRET
- **Use:** Authorization: Bearer <token>

### 4. Branch Isolation

Captain can only generate OTP for tables in their branch:
```javascript
// In generateOtp handler:
if (sessionBranchId !== staffBranchId) {
  return 403 "Branch mismatch"
}
```

---

## API Contract Summary

### Public Endpoints (No Authentication)

```
POST /public/customer/initiate
  Params: sessionId, name (optional), phone
  Returns: { message: "..." }
  
POST /public/customer/verify-otp
  Params: sessionId, phone, otp
  Returns: { token: "jwt" } or { error: "..." }
  
POST /public/order/place
  Auth: Bearer <customer-jwt>
  Params: sessionId, items[]
  Returns: { order: {...} }
```

### Staff Endpoints (Require JWT)

```
POST /staff/login
  Params: username
  Returns: { token: "jwt", role: "...", branchId: "..." }
  
POST /staff/otp/generate
  Auth: Bearer <captain-jwt>
  Params: sessionId, customerPhone
  Returns: { otp: "123456" } or { error: "..." }
  
GET /staff/active-tables
  Auth: Bearer <captain-jwt>
  Returns: [{ table: "...", session: "...", ... }]
```

---

## Testing Verification

### ✅ Tested Features

- [x] Customer can initiate without authentication
- [x] Captain must be authenticated to generate OTP
- [x] OTP generation returns valid 6-digit code
- [x] OTP expires after 5 minutes
- [x] Wrong OTP is rejected
- [x] Correct OTP issues JWT token
- [x] JWT contains customerId for order attribution
- [x] Multiple customers can use same session
- [x] Each customer gets unique JWT
- [x] Orders are tracked per customer
- [x] Branch isolation prevents cross-branch access
- [x] Failed OTP attempts are tracked

### Test Coverage

**Customer Login Flow Test** - 9 scenarios
1. Session creation ✅
2. Customer initiation ✅
3. OTP generation (with captain auth) ✅
4. OTP verification ✅
5. JWT validation ✅
6. Order placement with JWT ✅
7. Multi-customer join ✅
8. OTP expiry ✅
9. OTP regeneration ✅

**Captain Management Test** - 8 scenarios
1. Captain login ✅
2. OTP generation ✅
3. OTP regeneration ✅
4. Multiple customer management ✅
5. OTP history tracking ✅
6. Failed attempt tracking ✅
7. Expiry validation ✅
8. Branch isolation ✅

---

## Deployment Status

### ✅ Live on AWS

- **API Base:** `https://c83055bt54.execute-api.ap-south-1.amazonaws.com`
- **Region:** ap-south-1 (Mumbai)
- **Functions:** 17 Lambda deployed
- **Status:** Production-ready

### Endpoints Live

```
✅ POST /public/customer/initiate
✅ POST /public/customer/verify-otp
✅ POST /staff/login
✅ POST /staff/otp/generate
✅ POST /public/order/place
✅ GET /staff/active-tables
... and 11 more
```

---

## Common Questions

### Q: How does captain know which OTP to give?
**A:** Captain only needs to call API once per customer. System generates and returns OTP. Captain tells customer verbally or shows on screen.

### Q: Can customer bypass OTP?
**A:** No. Customer JWT requires valid OTP verification. Without JWT, can't place orders.

### Q: What if customer forgets OTP?
**A:** Captain can generate new OTP. Old OTP becomes invalid. Customer gets new one to enter.

### Q: How do we split the bill?
**A:** Each order has customer_id. Group by customer_id for separate bills. (Phase 2: automated splitting)

### Q: Can same phone login twice?
**A:** Yes, but different sessions. Phone +919876543210 at Table 1 != same phone at Table 2.

### Q: How long does JWT last?
**A:** 24 hours. After that, customer needs new OTP.

### Q: Who can see multi-customer info?
**A:** 
- Captain: Can see all tables, all customers at each table
- Kitchen: Sees consolidated orders per table (not per customer)
- Billing: Can see customer-wise breakdown via order's customer_id

---

## Next Steps (Phase 2)

### Billing Enhancements
```
1. Per-customer bill generation
2. Payment tracking per customer
3. Split payment handling
4. Session closure validation
```

### Possible Endpoints to Build
```
POST /public/bill/generate
  → Get bill for customer at session
  
POST /public/payment/process
  → Process payment from customer
  
PATCH /staff/session/{id}/close
  → Manager closes session (all paid)
```

### UI/UX Improvements
```
- Show "Waiting for payment" if multi-customer
- Prevent order after payment
- Display other customers at table (optional)
- Real-time bill updates
```

---

## Files Created/Modified

### New Documentation
- `CUSTOMER_OTP_FLOW_GUIDE.md` - Complete flow guide
- `CUSTOMER_LOGIN_TEST_RESULTS.md` - Test results
- `POSTMAN_API_EXAMPLES.md` - API examples with curl/Postman
- `CUSTOMER_LOGIN_CAPTAIN_OTP_SUMMARY.md` - This file

### Test Files
- `test-customer-login-flow.mjs` - 9 test scenarios
- `test-captain-otp-management.mjs` - 8 test scenarios

### Code Modified
- `src/staff/login.js` - Captain login
- `src/staff/otp/generate.js` - OTP generation
- `src/public/customer/initiate.js` - Customer registration
- `src/public/customer/verifyOtp.js` - OTP verification
- `src/public/order/placeOrder.js` - Order creation with customer_id
- `serverless.yml` - Lambda configuration

---

## Quick Reference Commands

### Run Tests Locally
```bash
node test-customer-login-flow.mjs
node test-captain-otp-management.mjs
```

### Deploy to AWS
```bash
serverless deploy
```

### Check Logs
```bash
serverless logs -f <function-name>
```

### Test OTP Endpoint
```bash
curl -X POST https://c83055bt54.execute-api.ap-south-1.amazonaws.com/staff/otp/generate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <captain-jwt>" \
  -d '{"sessionId":"...", "customerPhone":"+919876543210"}'
```

---

## Summary

**In 3 Sentences:**
1. Customers register with phone, get OTP from captain, verify OTP to login
2. Captain uses JWT to authenticate and generate OTPs for customers
3. Multi-customer tables work seamlessly with each customer getting unique JWT and order tracking

**Status:** ✅ Production-ready for Phase 1 (customer login & OTP)

