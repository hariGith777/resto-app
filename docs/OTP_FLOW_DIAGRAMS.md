# Customer & Captain OTP Flow - Visual Diagrams

## 1. Single Customer Flow (Simple Case)

```
┌──────────────┐
│   Customer   │
└──────┬───────┘
       │ Arrives at table
       │ Scans QR (starts session)
       ↓
┌──────────────────────────────────┐
│  Session Created                 │
│  tableId = "xyz"                 │
│  sessionId = "abc-123"           │
│  isNew = true                    │
└──────┬───────────────────────────┘
       │
       ├→ POST /customer/initiate
       │  {sessionId, name, phone}
       │
       ├→ Database creates:
       │  - customer_profiles
       │  - customers (verified=false)
       │
       ↓
   "Ask captain for OTP"
       │
       ↓
┌──────────────────────────────────┐
│      Captain (Authenticated)     │
│      captain_raj (logged in)     │
│      Has: Bearer JWT token       │
└──────┬───────────────────────────┘
       │
       ├→ POST /staff/otp/generate
       │  Auth: Bearer <jwt>
       │  {sessionId, customerPhone}
       │
       ├→ System validates:
       │  - Captain authenticated ✓
       │  - Captain's branch == table's branch ✓
       │
       ├→ Generates: OTP = "735834"
       │  Stores with 5-min expiry
       │
       ↓
   Captain tells customer: "735834"
       │
       ↓
┌──────────────┐
│   Customer   │ Enters OTP: 735834
└──────┬───────┘
       │
       ├→ POST /customer/verify-otp
       │  {sessionId, phone, otp}
       │
       ├→ System validates:
       │  - OTP matches ✓
       │  - Not expired ✓
       │  - Not already used ✓
       │
       ├→ Updates:
       │  - otp_requests.verified_at = NOW()
       │  - customers.verified = true
       │
       ├→ Issues JWT with:
       │  {sessionId, customerId, profileId}
       │
       ↓
   Customer gets: JWT token
       │
       ↓
┌──────────────────────────────────┐
│   Customer Places Order          │
│   Auth: Bearer <customer-jwt>    │
└──────┬───────────────────────────┘
       │
       ├→ POST /public/order/place
       │  Auth: Bearer <jwt>
       │  {sessionId, items}
       │
       ├→ System extracts customerId from JWT
       │
       ├→ Creates order with:
       │  - customer_id = customerId (from JWT)
       │  - session_id = sessionId
       │  - items, totalAmount, kotId
       │
       ↓
  Order placed successfully!
```

---

## 2. Multi-Customer Flow (New Feature!)

```
Table 5 Opened
│
├─ Session Created: sessionId = "abc-123"
│
├──────────────────────────────────────────────────────────┐
│                                                          │
│  CUSTOMER 1 (Rahul)                                     │
│  ├─ Phone: +919876543210                               │
│  │                                                      │
│  ├─ POST /customer/initiate                            │
│  │  "Please ask captain for OTP"                       │
│  │                                                      │
│  ├─ POST /staff/otp/generate (Captain)                 │
│  │  OTP = "456789"                                     │
│  │                                                      │
│  ├─ POST /customer/verify-otp                          │
│  │  JWT₁ (customerId = "cust-001")                     │
│  │                                                      │
│  ├─ POST /order/place (with JWT₁)                      │
│  │  Order 1: customer_id = "cust-001"                  │
│  │           Biryani × 1                               │
│  │                                                      │
│  └─ DONE                                               │
│                                                          │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  CUSTOMER 2 (Priya)                                     │
│  ├─ Phone: +919999999999                               │
│  │                                                      │
│  ├─ POST /customer/initiate                            │
│  │  "Please ask captain for OTP"                       │
│  │                                                      │
│  ├─ POST /staff/otp/generate (Captain)                 │
│  │  OTP = "234567"                                     │
│  │  (Different from Customer 1)                        │
│  │                                                      │
│  ├─ POST /customer/verify-otp                          │
│  │  JWT₂ (customerId = "cust-002")                     │
│  │  (Different from Customer 1)                        │
│  │                                                      │
│  ├─ POST /order/place (with JWT₂)                      │
│  │  Order 2: customer_id = "cust-002"                  │
│  │           Butter Chicken × 2                        │
│  │                                                      │
│  └─ DONE                                               │
│                                                          │
└──────────────────────────────────────────────────────────┘
│
├─ Kitchen View (Same sessionId)
│  ├─ Table 5 KOT
│  │  ├─ Biryani × 1
│  │  └─ Butter Chicken × 2
│  │  (Kitchen doesn't care who ordered what)
│  │
│
├─ Billing (Grouped by customerId)
│  ├─ Customer 1 (Rahul): Rs 300
│  │  └─ Biryani × 1
│  │
│  └─ Customer 2 (Priya): Rs 400
│     └─ Butter Chicken × 2
│
└─ Session Closed
   Total: Rs 700
   Both customers settled separately
```

---

## 3. Database Schema Relationship

```
┌─────────────────────┐
│   table_sessions    │
├─────────────────────┤
│ id (UUID)           │
│ table_id (FK)       │
│ started_at          │
│ ended_at (NULL)     │
└─────────┬───────────┘
          │ 1
          │
          │ M
┌─────────┴──────────────┐
│    customers           │
├───────────────────────┤
│ id (UUID)             │
│ session_id (FK)       │──→ table_sessions
│ phone (VARCHAR)       │
│ name (VARCHAR)        │
│ verified (BOOLEAN)    │
│ customer_profile_id   │──→ customer_profiles
└─────────┬──────────────┘
          │ 1
          │
          │ M
          │
    ┌─────┴──────────────┐
    │      orders        │
    ├───────────────────┤
    │ id (UUID)         │
    │ session_id (FK)   │
    │ customer_id (FK)  │──→ customers
    │ total_amount      │
    │ created_at        │
    │ kotId             │
    └───────────────────┘

┌────────────────────────┐
│   otp_requests         │
├────────────────────────┤
│ id (UUID)              │
│ session_id (FK)        │──→ table_sessions
│ customer_phone (VARCHAR)
│ otp_code (VARCHAR)     │
│ generated_by (FK)      │──→ staff
│ expires_at (TIMESTAMP) │
│ verified_at (NULL)     │
│ created_at             │
└────────────────────────┘

┌──────────────────────────┐
│   customer_profiles      │
├──────────────────────────┤
│ id (UUID)                │
│ phone (VARCHAR)          │
│ name (VARCHAR)           │
└──────────────────────────┘
```

---

## 4. Authentication Flow

```
┌─────────────────────────────────────────────────────┐
│                   AUTHENTICATION FLOW               │
└─────────────────────────────────────────────────────┘

CAPTAIN AUTHENTICATION:
   │
   ├─ Username: "captain_raj"
   │
   ├─ POST /staff/login
   │
   ├─ Response:
   │  {
   │    "token": "eyJ...",
   │    "role": "CAPTAIN",
   │    "branchId": "7a7d1888..."
   │  }
   │
   ├─ Store token in memory/session
   │
   ├─ Use in Authorization header:
   │  Authorization: Bearer eyJ...
   │
   ├─ For all staff operations:
   │  - /staff/otp/generate
   │  - /staff/active-tables
   │  - etc.
   │
   └─ Expires: No limit (staff session)


CUSTOMER AUTHENTICATION:
   │
   ├─ Phone: "+919876543210"
   │
   ├─ Step 1: POST /customer/initiate
   │         (No auth needed)
   │
   ├─ Step 2: POST /staff/otp/generate
   │         (Captain auth needed)
   │
   ├─ Step 3: POST /customer/verify-otp
   │         (OTP verification)
   │         → Response: JWT token
   │
   ├─ Store JWT token in app
   │
   ├─ Use in Authorization header:
   │  Authorization: Bearer eyJ...
   │
   ├─ For all customer operations:
   │  - /order/place
   │  - /order/{id}
   │  - /bill/generate (Phase 2)
   │
   └─ Expires: 24 hours
```

---

## 5. OTP Generation & Verification Flow

```
              CAPTAIN                        SYSTEM
               │                               │
               │ POST /staff/otp/generate     │
               ├──────────────────────────────→│
               │  + Bearer JWT                │
               │  + sessionId                 │
               │  + customerPhone             │
               │                              │
               │                    Validates:
               │                    - JWT token
               │                    - Staff role
               │                    - Branch match
               │                              │
               │                    Generates:
               │                    - 6-digit OTP
               │                    - expires_at
               │                              │
               │                    Stores in DB:
               │                    - otp_requests
               │                      .otp_code
               │                      .expires_at
               │                      .generated_by
               │                              │
               │ ← { "otp": "735834" }       │
               │
        (Captain tells customer verbally)
               │
            CUSTOMER
               │
               │ POST /customer/verify-otp
               ├──────────────────────────────→│
               │  + sessionId                 │
               │  + phone                     │
               │  + otp (entered by customer) │
               │                              │
               │                    Validates:
               │                    - OTP matches
               │                    - Not expired
               │                    - Not used yet
               │                              │
               │                    If valid:
               │                    - UPDATE verified_at
               │                    - UPDATE customers.verified
               │                    - SIGN JWT token
               │                              │
               │ ← { "token": "eyJ..." }     │
               │
        (Customer has JWT, can order)
```

---

## 6. Order Placement with Customer Attribution

```
┌──────────────────────────────────────────────────────┐
│        ORDER PLACEMENT FLOW                          │
└──────────────────────────────────────────────────────┘

CUSTOMER 1 (JWT₁ with customerId="cust-001"):
   │
   ├─ POST /order/place
   │  Authorization: Bearer eyJ...customerId=cust-001...
   │  {
   │    "sessionId": "abc-123",
   │    "items": [
   │      { "menuItemId": "xyz", "quantity": 2 }
   │    ]
   │  }
   │
   ├─ System extracts from JWT:
   │  customerId = "cust-001"
   │
   ├─ Creates order:
   │  INSERT orders(
   │    id,
   │    session_id = "abc-123",
   │    customer_id = "cust-001",  ← AUTOMATIC!
   │    total_amount,
   │    status
   │  )
   │
   ├─ Response:
   │  {
   │    "order": {
   │      "id": "order-001",
   │      "customer_id": "cust-001",
   │      "items": [...]
   │    }
   │  }
   │
   └─ Kitchen sees: "Table 5, 1 item"


CUSTOMER 2 (JWT₂ with customerId="cust-002"):
   │
   ├─ POST /order/place
   │  Authorization: Bearer eyJ...customerId=cust-002...
   │  {
   │    "sessionId": "abc-123",  ← SAME SESSION
   │    "items": [
   │      { "menuItemId": "qwe", "quantity": 1 }
   │    ]
   │  }
   │
   ├─ System extracts from JWT:
   │  customerId = "cust-002"  ← DIFFERENT!
   │
   ├─ Creates order:
   │  INSERT orders(
   │    id,
   │    session_id = "abc-123",
   │    customer_id = "cust-002",  ← DIFFERENT FROM ABOVE
   │    total_amount,
   │    status
   │  )
   │
   ├─ Response:
   │  {
   │    "order": {
   │      "id": "order-002",
   │      "customer_id": "cust-002",
   │      "items": [...]
   │    }
   │  }
   │
   └─ Kitchen sees: "Table 5, 1 more item"


KITCHEN VIEW (Same table, different customers):
   ┌─────────────────────────────────┐
   │ Table 5 KOT                     │
   ├─────────────────────────────────┤
   │ Item 1: xyz × 2                 │
   │ Item 2: qwe × 1                 │
   │                                 │
   │ Total items: 3                  │
   │                                 │
   │ (No customer info shown)         │
   └─────────────────────────────────┘


BILLING (Per customer):
   ┌──────────────────────────────┐
   │ Customer 1 (cust-001)        │
   ├──────────────────────────────┤
   │ Order ID: order-001          │
   │ Item: xyz × 2 = Rs 300       │
   │ Total: Rs 300                │
   └──────────────────────────────┘

   ┌──────────────────────────────┐
   │ Customer 2 (cust-002)        │
   ├──────────────────────────────┤
   │ Order ID: order-002          │
   │ Item: qwe × 1 = Rs 200       │
   │ Total: Rs 200                │
   └──────────────────────────────┘
```

---

## 7. Error Scenarios

```
┌─────────────────────────────────────────────────────┐
│            ERROR HANDLING PATHS                     │
└─────────────────────────────────────────────────────┘

WRONG OTP:
   POST /customer/verify-otp
   { otp: "000000" }
        │
        ├─ System checks: "000000" != "735834"
        │
        ├─ Response (401):
        │  { "error": "Invalid OTP" }
        │
        └─ Customer can retry


OTP EXPIRED (after 5 min):
   POST /customer/verify-otp
   { otp: "735834" }
        │
        ├─ System checks: now() > expires_at
        │
        ├─ Response (401):
        │  { "error": "No valid OTP request" }
        │
        └─ Captain must generate new OTP


BRANCH MISMATCH:
   POST /staff/otp/generate (Captain from Branch A)
   { sessionId: "table from Branch B" }
        │
        ├─ System checks:
        │  captain.branchId != table.area.branchId
        │
        ├─ Response (403):
        │  { "error": "Branch mismatch" }
        │
        └─ Only captain's own tables accessible


MISSING AUTHENTICATION:
   POST /staff/otp/generate (no Bearer token)
        │
        ├─ System checks: Authorization header
        │
        ├─ Response (401):
        │  { "error": "Missing authorization" }
        │
        └─ Must login first


INVALID SESSION:
   POST /customer/verify-otp
   { sessionId: "invalid-uuid" }
        │
        ├─ System checks: SELECT FROM table_sessions
        │
        ├─ Response (404):
        │  { "error": "Session not found" }
        │
        └─ Session must exist first
```

---

## 8. State Transitions

```
CUSTOMER STATE MACHINE:

┌──────────────────┐
│  Not Registered  │
└────────┬─────────┘
         │ POST /customer/initiate
         ↓
┌──────────────────┐
│  Waiting for OTP │  verified = false
└────────┬─────────┘
         │ POST /staff/otp/generate (captain)
         │ POST /customer/verify-otp (customer, correct OTP)
         ↓
┌──────────────────┐
│   Authenticated  │  verified = true, has JWT
└────────┬─────────┘
         │ Can place orders
         ├─ POST /order/place ✓
         ├─ POST /bill/generate ✓ (Phase 2)
         │
         │ JWT expires after 24h
         ↓
┌──────────────────┐
│  Session Expired │  JWT no longer valid
└────────┬─────────┘
         │ Must verify OTP again
         └→ Back to "Waiting for OTP" state


OTP REQUEST STATE MACHINE:

┌──────────────────────┐
│   Created (Pending)  │  verified_at = NULL
└─────────┬────────────┘
          │ 5 minutes
          ├─ Expires (not verified)
          │  └→ DELETE or mark expired
          │
          └─ POST /customer/verify-otp (correct OTP)
             ↓
        ┌──────────────────────┐
        │    Verified          │  verified_at = NOW()
        │ (One-time used)      │
        └──────────────────────┘
             
             Can't be reused
             Next OTP must be generated
```

---

## 9. Complete Timeline Example

```
13:00 ─ Table 5 Created
        sessionId: abc-123

13:05 ─ Customer 1 Arrives (Rahul, +919000000001)
        ├─ POST /customer/initiate
        │  Status: 200 "Ask captain for OTP"
        │
        ├─ DB: customer_profiles + customers created
        │  verified: false
        │
        └─ Waiting for OTP


13:06 ─ Captain Generates OTP for Customer 1
        ├─ POST /staff/otp/generate
        │  Auth: Bearer captain-jwt
        │
        ├─ Response: OTP = "456789"
        │  Expires: 13:11 (5 min)
        │
        └─ Captain tells customer: "456789"


13:07 ─ Customer 1 Enters OTP
        ├─ POST /customer/verify-otp
        │  OTP: "456789" (correct)
        │
        ├─ DB: otp_requests.verified_at = NOW()
        │       customers.verified = true
        │
        ├─ Response: JWT₁ token
        │  customerId: cust-001
        │  Expires: 13:07 + 24h
        │
        └─ Customer 1 can now order


13:08 ─ Customer 1 Places Order
        ├─ POST /order/place
        │  Auth: Bearer JWT₁
        │
        ├─ DB: orders created
        │  customer_id: cust-001
        │  items: Biryani × 1
        │
        ├─ Response: Order 001
        │
        └─ Kitchen receives KOT


13:10 ─ Customer 2 Arrives (Priya, +919000000002)
        ├─ POST /customer/initiate
        │  Status: 200 "Ask captain for OTP"
        │
        └─ Waiting for OTP


13:11 ─ Captain Generates OTP for Customer 2
        ├─ POST /staff/otp/generate
        │  Auth: Bearer captain-jwt
        │
        ├─ Response: OTP = "234567" (different!)
        │  Expires: 13:16 (5 min)
        │
        └─ Captain tells customer: "234567"


13:12 ─ Customer 2 Enters OTP
        ├─ POST /customer/verify-otp
        │  OTP: "234567" (correct)
        │
        ├─ Response: JWT₂ token
        │  customerId: cust-002
        │
        └─ Customer 2 can now order


13:13 ─ Customer 2 Places Order
        ├─ POST /order/place
        │  Auth: Bearer JWT₂ (DIFFERENT JWT!)
        │
        ├─ DB: orders created
        │  customer_id: cust-002  (DIFFERENT CUSTOMER!)
        │  items: Butter Chicken × 2
        │
        ├─ Response: Order 002
        │
        └─ Kitchen receives update


13:45 ─ Bill Time
        ├─ Customer 1 (Rahul):
        │  Biryani × 1 = Rs 300
        │
        ├─ Customer 2 (Priya):
        │  Butter Chicken × 2 = Rs 400
        │
        ├─ Total: Rs 700
        │
        └─ Each settles separately


13:50 ─ Session Closed
        └─ Table 5 available for next customers
```

---

These diagrams show:
1. How single customer flow works
2. How multi-customer flow differs
3. Database relationships
4. Authentication mechanisms
5. OTP lifecycle
6. Order attribution
7. Error handling
8. State transitions
9. Real timeline example

