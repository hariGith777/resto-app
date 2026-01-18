# Customer Login & Captain OTP - Postman Examples

## Quick Start: Complete Flow

### Step 1: Captain Login

**Request:**
```http
POST https://c83055bt54.execute-api.ap-south-1.amazonaws.com/staff/login
Content-Type: application/json

{
  "username": "captain_raj"
}
```

**Response (200):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdGFmZklkIjoiYTJhMjc4YjktOTNjNC00YzkyLTljNWItYTJhNjI3YzM1NzFhIiwicm9sZSI6IkNBUFRBSU4iLCJicmFuY2hJZCI6IjdhN2QxODg4LWQyNzctNGZlNS05YzU4LWJkZjAwZGRmMTg3NSIsInJlc3RhdXJhbnRJZCI6IjhhN2QxODg4LWQyNzctNGZlNS05YzU4LWJkZjAwZGRmMTg3NSIsImlhdCI6MTczNTA0MjAwMH0.xyz...",
  "role": "CAPTAIN",
  "branchId": "7a7d1888-d277-4fe5-9c58-bdf00ddf1875"
}
```

**Save as:** `CAPTAIN_JWT` for next requests

---

### Step 2: Start Session (QR Code Scan)

**Request:**
```http
POST https://c83055bt54.execute-api.ap-south-1.amazonaws.com/public/qr/session/start
Content-Type: application/json

{
  "tableId": "8bf02260-45e3-44fa-96f8-f8b7f2960d25"
}
```

**Response (201):**
```json
{
  "sessionId": "7d7e3eb4-ef79-4c84-ad69-69d8071125d4",
  "isNew": true
}
```

**Save as:** `SESSION_ID`

---

### Step 3: Customer Initiates

**Request:**
```http
POST https://c83055bt54.execute-api.ap-south-1.amazonaws.com/public/customer/initiate
Content-Type: application/json

{
  "sessionId": "7d7e3eb4-ef79-4c84-ad69-69d8071125d4",
  "name": "Rahul Sharma",
  "phone": "+919876543210"
}
```

**Response (200):**
```json
{
  "message": "Please ask the captain for OTP"
}
```

---

### Step 4: Captain Generates OTP

**Request:**
```http
POST https://c83055bt54.execute-api.ap-south-1.amazonaws.com/staff/otp/generate
Content-Type: application/json
Authorization: Bearer {{CAPTAIN_JWT}}

{
  "sessionId": "7d7e3eb4-ef79-4c84-ad69-69d8071125d4",
  "customerPhone": "+919876543210"
}
```

**Response (200):**
```json
{
  "otp": "735834"
}
```

**Captain tells customer: "Your OTP is 735834"**

---

### Step 5: Customer Verifies OTP

**Request:**
```http
POST https://c83055bt54.execute-api.ap-south-1.amazonaws.com/public/customer/verify-otp
Content-Type: application/json

{
  "sessionId": "7d7e3eb4-ef79-4c84-ad69-69d8071125d4",
  "phone": "+919876543210",
  "otp": "735834"
}
```

**Response (200):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzZXNzaW9uSWQiOiI3ZDdlM2ViNC1lZjc5LTRjODQtYWQ2OS02OWQ4MDcxMTI1ZDQiLCJjdXN0b21lcklkIjoiMzJmYzZkNmMtZTc2OS00YWQyLWEwZmEtM2Q1ZjVhN2NmNTYxIiwicHJvZmlsZUlkIjoiNDRmYzZkNmMtZTc2OS00YWQyLWEwZmEtM2Q1ZjVhN2NmNTYxIiwic2NvcGUiOiJzZXNzaW9uIiwiaWF0IjoxNzM1MDQyMDAwLCJleHAiOjE3MzUxMjgwMDB9.abc..."
}
```

**Save as:** `CUSTOMER_JWT`

---

### Step 6: Customer Places Order

**Request:**
```http
POST https://c83055bt54.execute-api.ap-south-1.amazonaws.com/public/order/place
Content-Type: application/json
Authorization: Bearer {{CUSTOMER_JWT}}

{
  "sessionId": "7d7e3eb4-ef79-4c84-ad69-69d8071125d4",
  "items": [
    {
      "menuItemId": "f1234567-890a-bcde-f123-456789abcdef",
      "quantity": 2
    }
  ]
}
```

**Response (201):**
```json
{
  "order": {
    "id": "order-uuid-here",
    "sessionId": "7d7e3eb4-ef79-4c84-ad69-69d8071125d4",
    "customerId": "32fc6d6c-e769-4ad2-a0fa-3d5f5a7cf561",
    "totalAmount": 450,
    "items": [
      {
        "menuItemId": "f1234567-890a-bcde-f123-456789abcdef",
        "quantity": 2,
        "itemPrice": 225,
        "subtotal": 450
      }
    ],
    "kotId": "kot-uuid-here",
    "createdAt": "2025-01-06T10:30:00Z"
  }
}
```

**Note:** `customerId` is automatically from JWT token!

---

## Multi-Customer Scenario

### Same Table, Different Customers

#### Customer 1 Flow (as above)
- Phone: +919876543210 → OTP: 735834 → JWT₁ → Order

#### Customer 2 Flow

**Request - Generate OTP:**
```http
POST https://c83055bt54.execute-api.ap-south-1.amazonaws.com/staff/otp/generate
Content-Type: application/json
Authorization: Bearer {{CAPTAIN_JWT}}

{
  "sessionId": "7d7e3eb4-ef79-4c84-ad69-69d8071125d4",
  "customerPhone": "+919999999999"
}
```

**Response:**
```json
{
  "otp": "234567"
}
```

**Request - Verify OTP:**
```http
POST https://c83055bt54.execute-api.ap-south-1.amazonaws.com/public/customer/verify-otp
Content-Type: application/json

{
  "sessionId": "7d7e3eb4-ef79-4c84-ad69-69d8071125d4",
  "phone": "+919999999999",
  "otp": "234567"
}
```

**Response:**
```json
{
  "token": "eyJ... (different customerId than Customer 1) ...abc"
}
```

**Request - Place Order:**
```http
POST https://c83055bt54.execute-api.ap-south-1.amazonaws.com/public/order/place
Content-Type: application/json
Authorization: Bearer {{CUSTOMER_2_JWT}}

{
  "sessionId": "7d7e3eb4-ef79-4c84-ad69-69d8071125d4",
  "items": [
    {
      "menuItemId": "g2345678-901b-cdef-0123-456789defabc",
      "quantity": 1
    }
  ]
}
```

**Response:**
```json
{
  "order": {
    "id": "order-uuid-2",
    "sessionId": "7d7e3eb4-ef79-4c84-ad69-69d8071125d4",
    "customerId": "55fd7e7d-f870-5be3-b1gb-4e6g6b8dg672",  ← Different!
    "totalAmount": 350,
    "kotId": "kot-uuid-2"
  }
}
```

---

## Error Scenarios

### Wrong OTP

**Request:**
```http
POST https://c83055bt54.execute-api.ap-south-1.amazonaws.com/public/customer/verify-otp
Content-Type: application/json

{
  "sessionId": "7d7e3eb4-ef79-4c84-ad69-69d8071125d4",
  "phone": "+919876543210",
  "otp": "000000"
}
```

**Response (401):**
```json
{
  "error": "Invalid OTP"
}
```

---

### Expired OTP (after 5 minutes)

**Request:**
```http
POST https://c83055bt54.execute-api.ap-south-1.amazonaws.com/public/customer/verify-otp
Content-Type: application/json

{
  "sessionId": "7d7e3eb4-ef79-4c84-ad69-69d8071125d4",
  "phone": "+919876543210",
  "otp": "735834"
}
```

**Response (401):**
```json
{
  "error": "No valid OTP request"
}
```

**Action:** Captain must generate new OTP

---

### Missing Authorization (Captain endpoint)

**Request:**
```http
POST https://c83055bt54.execute-api.ap-south-1.amazonaws.com/staff/otp/generate
Content-Type: application/json

{
  "sessionId": "7d7e3eb4-ef79-4c84-ad69-69d8071125d4",
  "customerPhone": "+919876543210"
}
```

**Response (401):**
```json
{
  "error": "Missing authorization"
}
```

---

### Invalid Token (Wrong Role)

**Request:**
```http
POST https://c83055bt54.execute-api.ap-south-1.amazonaws.com/staff/otp/generate
Content-Type: application/json
Authorization: Bearer {{INVALID_KITCHEN_JWT}}

{
  "sessionId": "7d7e3eb4-ef79-4c84-ad69-69d8071125d4",
  "customerPhone": "+919876543210"
}
```

**Response (403):**
```json
{
  "error": "Insufficient role"
}
```

---

### Session Not Found

**Request:**
```http
POST https://c83055bt54.execute-api.ap-south-1.amazonaws.com/staff/otp/generate
Content-Type: application/json
Authorization: Bearer {{CAPTAIN_JWT}}

{
  "sessionId": "invalid-uuid-not-exists",
  "customerPhone": "+919876543210"
}
```

**Response (404):**
```json
{
  "error": "Session not found"
}
```

---

## JWT Token Structure

### Customer JWT (from verify-otp)

```
Header:
{
  "alg": "HS256",
  "typ": "JWT"
}

Payload:
{
  "sessionId": "7d7e3eb4-ef79-4c84-ad69-69d8071125d4",
  "customerId": "32fc6d6c-e769-4ad2-a0fa-3d5f5a7cf561",
  "profileId": "44fc6d6c-e769-4ad2-a0fa-3d5f5a7cf561",
  "scope": "session",
  "iat": 1735042000,
  "exp": 1735128400
}

Expiry: 24 hours
```

### Captain JWT (from staff login)

```
Header:
{
  "alg": "HS256",
  "typ": "JWT"
}

Payload:
{
  "staffId": "a2a278b9-93c4-4c92-9c5b-a2a627c3571a",
  "role": "CAPTAIN",
  "branchId": "7a7d1888-d277-4fe5-9c58-bdf00ddf1875",
  "restaurantId": "8a7d1888-d277-4fe5-9c58-bdf00ddf1875",
  "iat": 1735042000
}

Expiry: No expiry (staff session)
```

---

## Environment Variables

```
API_BASE=https://c83055bt54.execute-api.ap-south-1.amazonaws.com
DATABASE_URL=postgresql://...
JWT_SECRET=dev_secret_for_tests
```

---

## Key Points for Implementation

### On Customer App Side
1. Display message: "Please ask captain for OTP"
2. Show input field for 6-digit OTP
3. After OTP verified, save JWT token
4. Use JWT in Authorization header for all subsequent requests
5. On order placement, system automatically adds customer_id from JWT

### On Captain's POS Side
1. Login once to get captain JWT
2. For each customer: POST /staff/otp/generate
3. Tell customer the OTP verbally or show on screen
4. Monitor active sessions: GET /staff/active-tables
5. Track which customers at which tables

### Multi-Customer Workflow
1. Same sessionId for all customers at table
2. Different phone number = different customer
3. Different OTP = different customer
4. Different JWT = different customer
5. Different orders = tracked to each customer
6. Split billing per customer

