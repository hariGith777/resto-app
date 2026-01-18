# Customer & Captain OTP Flow Documentation

## Overview

The system supports two distinct flows:
1. **Customer Flow**: Register → Get OTP → Login → Order
2. **Captain Flow**: Login → Generate OTP for customers → Manage multi-customer tables

---

## Part 1: Customer Login Flow

### Step 1: Customer Initiates
**Endpoint:** `POST /public/customer/initiate`
**No auth required**

Request:
```json
{
  "sessionId": "uuid-of-table-session",
  "name": "John Doe",
  "phone": "+919876543210"
}
```

Response (200):
```json
{
  "message": "Please ask the captain for OTP"
}
```

**What happens:**
- System creates `customer_profiles` record if phone is new
- Creates `customers` record linked to session
- Sets `verified = false` initially

---

### Step 2: Captain Generates OTP
**Endpoint:** `POST /staff/otp/generate`
**Requires:** Captain JWT Bearer token (from `/staff/login`)

Request:
```json
{
  "sessionId": "uuid-of-table-session",
  "customerPhone": "+919876543210"
}
```

Response (200):
```json
{
  "otp": "735834"
}
```

**What happens:**
- System validates captain is authenticated
- Validates captain's branch matches table's branch
- Generates 6-digit numeric OTP
- Stores in `otp_requests` table with 5-minute expiry
- Captain verbally tells customer the OTP

**Key Detail:** Only captains/staff with proper JWT can generate OTPs

---

### Step 3: Customer Verifies OTP
**Endpoint:** `POST /public/customer/verify-otp`
**No auth required initially**

Request:
```json
{
  "sessionId": "uuid-of-table-session",
  "phone": "+919876543210",
  "otp": "735834"
}
```

Success Response (200):
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

Error Response (401):
```json
{
  "error": "Invalid OTP"
}
```

**What happens:**
- Validates OTP matches stored value
- Validates OTP hasn't expired (5 minutes)
- Increments `attempts` counter if wrong
- Marks OTP as `verified_at = NOW()`
- Updates `customers.verified = true`
- **Issues JWT with payload:**
  ```json
  {
    "sessionId": "uuid",
    "customerId": "uuid-of-customer-in-session",
    "profileId": "uuid-of-customer-profile",
    "scope": "session"
  }
  ```

---

### Step 4: Customer Places Order
**Endpoint:** `POST /public/order/place`
**Requires:** Customer JWT Bearer token (from verify-otp)

Request:
```json
{
  "sessionId": "uuid-of-table-session",
  "items": [
    { "menuItemId": "uuid", "quantity": 2 }
  ]
}
```

Response (201):
```json
{
  "order": {
    "id": "uuid",
    "sessionId": "uuid",
    "customerId": "uuid",  // ← Automatically set from JWT
    "items": [...],
    "totalAmount": 450,
    "kotId": "uuid"
  }
}
```

**Key Detail:** `customer_id` is automatically extracted from JWT token

---

## Part 2: Captain OTP Management

### Captain Login
**Endpoint:** `POST /staff/login`

Request:
```json
{
  "username": "captain_raj"
}
```

Response (200):
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "role": "CAPTAIN",
  "branchId": "uuid"
}
```

**JWT Payload:**
```json
{
  "staffId": "uuid",
  "role": "CAPTAIN",
  "branchId": "uuid",
  "restaurantId": "uuid"
}
```

---

### Captain Responsibilities

#### 1. Generate OTP for Customer
- Customer at table asks to order
- Customer provides phone number
- Captain calls: `POST /staff/otp/generate` with JWT token
- System validates captain's branch matches table
- Returns OTP, captain tells customer verbally

#### 2. Regenerate OTP if Needed
- Customer forgot OTP or made mistakes
- Captain calls same endpoint again
- New OTP is generated and returned
- Old OTP is invalidated (different row in db)

#### 3. Manage Multiple Customers at Same Table
- First customer: Generate OTP → Verify → Get JWT → Order
- Second customer: Generate different OTP → Verify → Get different JWT → Order
- Both use **same sessionId** but **different customerId**
- Orders are tracked per customer

---

## Multi-Customer Session Example

### Timeline

**13:00 - Table 5 is occupied**
```
Captain creates session for Table 5
sessionId = abc-123
```

**13:05 - Customer 1 arrives**
```
Customer 1 initiates: phone +919000000001
Captain generates OTP for +919000000001 → "456789"
Customer 1 enters OTP → Gets JWT₁(customerId=cust-001)
Customer 1 places order with JWT₁
```

**13:10 - Customer 2 arrives at same table**
```
Customer 2 initiates: phone +919000000002
Captain generates OTP for +919000000002 → "234567"
Customer 2 enters OTP → Gets JWT₂(customerId=cust-002)
Customer 2 places order with JWT₂
```

**13:15 - Kitchen View**
```
Table 5 has 2 orders:
- Order 1: Biryani × 1 (Customer 1)
- Order 2: Butter Chicken × 2 (Customer 2)
KOT shows all items but kitchen doesn't see who ordered what
```

**13:45 - Billing**
```
Captain requests bill for Table 5
Bill shows:
- Customer 1: Biryani (Rs 300)
- Customer 2: Butter Chicken (Rs 400)
Each customer settles separately
```

---

## Schema Relationships

```
table_sessions
├── id (UUID)
├── table_id → tables
├── started_at (TIMESTAMP)
└── ended_at (TIMESTAMP, NULL while active)

customers
├── id (UUID)
├── customer_profile_id → customer_profiles
├── session_id → table_sessions
├── phone (VARCHAR)
├── name (VARCHAR)
├── verified (BOOLEAN)
└── created_at (TIMESTAMP)

otp_requests
├── id (UUID)
├── session_id → table_sessions
├── customer_phone (VARCHAR)
├── otp_code (VARCHAR)
├── generated_by → staff
├── expires_at (TIMESTAMP)
├── verified_at (TIMESTAMP, NULL until verified)
└── created_at (TIMESTAMP)

orders
├── id (UUID)
├── session_id → table_sessions
├── customer_id → customers (NULL for captain orders)
├── total_amount
├── status
└── created_at (TIMESTAMP)
```

---

## Key Security Features

### 1. Branch Isolation
- Captain can only generate OTP for tables in their branch
- Validated in `generateOtp` handler
- Prevents cross-branch access

### 2. OTP Validation
- Only valid for 5 minutes
- One-time use (marked as verified_at)
- Tracks attempted phone number
- Requires exact session match

### 3. JWT Scope
- Customer JWTs have `scope: "session"` (24-hour expiry)
- Staff JWTs don't have scope limit
- Customer can't access other session's data

### 4. Customer Attribution
- Orders include `customer_id` from JWT
- Kitchen sees consolidated orders per table
- Billing tracks per-customer expenses
- Can split bills accurately

---

## Error Scenarios & Handling

### Scenario 1: Wrong OTP Entered
```
Status: 401
Error: "Invalid OTP"
Action: Counter incremented, customer can retry
```

### Scenario 2: OTP Expired
```
Status: 401
Error: "No valid OTP request"
Action: Captain must regenerate new OTP
```

### Scenario 3: Captain From Different Branch
```
Status: 403
Error: "Branch mismatch"
Action: Only captain's own branch tables allowed
```

### Scenario 4: Invalid SessionId
```
Status: 404
Error: "Session not found"
Action: Session must exist first (created at table setup)
```

---

## Workflow Comparison

### Single Customer (Traditional)
```
1. Customer arrives at table
2. Captain creates session
3. Captain generates OTP for customer
4. Customer enters OTP → Gets JWT
5. Customer orders → Order.customer_id = customer-uuid
6. Kitchen prepares
7. Captain brings bill
8. Customer pays
```

### Multi-Customer (New Feature)
```
1. Customers 1 & 2 arrive at table
2. Captain creates session (once)
3. Captain generates OTP₁ for customer 1
4. Customer 1: OTP₁ → JWT₁(cust-id=1)
5. Captain generates OTP₂ for customer 2
6. Customer 2: OTP₂ → JWT₂(cust-id=2)
7. Customer 1 orders → Order.customer_id = 1
8. Customer 2 orders → Order.customer_id = 2
9. Kitchen sees table 5 has 2 orders (unified KOT)
10. Captain splits bill:
    - Customer 1 pays for their items
    - Customer 2 pays for their items
```

---

## Test Results Summary

### ✅ Customer Login Flow
- Customer initiation works
- Captain generates OTP with authentication
- Customer enters OTP and receives JWT
- JWT contains sessionId, customerId, profileId
- Multi-customer scenario works (different JWTs same session)
- OTP expires after 5 minutes
- Captain can regenerate OTP

### ✅ Captain OTP Management
- Captain login issues correct JWT
- OTP generation requires authentication
- Branch isolation prevents cross-branch access
- Multiple customers can be managed independently
- OTP request tracking in database
- Different OTPs for different customers at same table

---

## Next Phase: Multi-Customer Billing

### Phase 2 Features to Implement
1. **Bill Splitting**
   - Group orders by customer_id
   - Calculate per-customer subtotal
   - Add taxes per customer

2. **Payment Tracking**
   - Create `payments` table
   - Track payment status per customer
   - Support partial payments

3. **Session Closure**
   - Validate all customers have settled
   - Generate final consolidated bill
   - Mark session as ended

### Phase 2 Endpoints (To Be Built)
- `POST /public/bill/generate` - Get customer's portion
- `POST /public/payment/process` - Process payment
- `PATCH /staff/session/{sessionId}/close` - Manager closes session

