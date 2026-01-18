# End-to-End Testing Guide

## Overview
Comprehensive test covering the complete restaurant platform flow from super admin setup to customer order placement.

## Test Execution

```bash
node test-end-to-end.mjs
```

## Test Flow

### Step 0: Database Cleanup
- Clears all test data while preserving super admin
- Removes orders, KOTs, order items
- Clears customer data and sessions
- Deletes menu items and categories
- Removes staff (except super admin), tables, areas, branches, and restaurants

### Step 1: Super Admin Login ✅
- Fetches super admin from database
- Authenticates via `/super-admin/login` endpoint
- Receives JWT token for privileged operations

### Step 2: Restaurant Creation ✅
- Creates new restaurant with branding
- Sets up Downtown Branch with INR currency
- Adds branch manager (Test Manager)
- **Currency Support**: India/INR/₹

### Step 3: Infrastructure Setup ✅
- Creates area (Main Hall)
- Adds table with QR code
- Links table to area and branch

### Step 4: Menu Management ✅
- Manager logs in with username
- Creates menu category (Starters)
- Adds 3 menu items:
  - **Paneer Tikka** (VEG) - ₹180
  - **Chicken Wings** (NON_VEG) - ₹220
  - **Egg Rolls** (EGG) - ₹120
- All items include price with currency formatting

### Step 5: Staff Setup ✅
- Creates captain (Test Captain)
- Captain logs in for OTP generation

### Step 6: Customer QR Scan ✅
- Customer scans table QR code
- System creates/reuses table session
- Returns session ID for customer

### Step 7: Customer Authentication ✅
- Customer initiates login with phone number
- Captain generates OTP (6-digit code)
- Customer verifies OTP
- Receives JWT token for order placement

### Step 8: Menu Browsing ✅
- Customer fetches menu categories
- Receives items with:
  - Food type indicators (🥬/🍖/🥚)
  - Formatted prices (₹180.00)
  - Currency information
  - Descriptions and allergens

### Step 9: Order Placement ✅
- Customer adds items to order:
  - 2x Chicken Wings (₹220 each)
  - 1x Egg Rolls (₹120)
- Places order via authenticated endpoint
- System calculates total: **₹560.00**
- Creates KOT (Kitchen Order Ticket)
- Returns order ID and formatted total

### Step 10: Database Verification ✅
- Verifies order exists in database
- Confirms item count and total amount
- Validates currency symbol association

### Step 11: Order Retrieval ✅
- Customer fetches order details
- Receives complete order with:
  - All order items with quantities
  - Total amount with currency
  - Order status
  - Item details

## Test Results

```
✅ END-TO-END TEST COMPLETED SUCCESSFULLY!

📊 Test Summary:
   ✅ Super Admin: Admin User
   ✅ Restaurant: Test Restaurant
   ✅ Branch: Downtown Branch
   ✅ Manager: Test Manager
   ✅ Captain: Test Captain
   ✅ Area: Main Hall with Table 1
   ✅ Menu: 3 items across 1 category
   ✅ Customer: Test Customer (+919999888877)
   ✅ Order: ₹560.00
   ✅ Currency: INR (₹)

🎉 All systems operational!
```

## Key Features Validated

### Multi-Currency Support
- Restaurant onboarded with currency (INR)
- All prices display with correct symbol (₹)
- Order totals formatted properly
- API responses include currency metadata

### Food Type Categorization
- VEG items marked with 🥬
- NON_VEG items marked with 🍖
- EGG items marked with 🥚
- Proper filtering and display

### Authentication Flow
- Super admin JWT authentication
- Staff (manager/captain) authentication
- Customer OTP-based authentication
- Token validation across all endpoints

### Order Management
- Price calculation with currency
- Item quantity handling
- KOT generation
- Order status tracking
- Multi-item order support

### Session Management
- QR code-based session creation
- Session reuse for multiple customers
- Session-based order retrieval

## API Endpoints Tested

1. `POST /super-admin/login` - Super admin authentication
2. `POST /super-admin/createRestaurant` - Restaurant onboarding
3. `POST /staff/login` - Staff authentication
4. `POST /admin/menu/categories` - Category creation
5. `POST /admin/menu/items` - Menu item creation
6. `POST /public/qr/session/start` - Table session start
7. `POST /public/customer/initiate` - Customer login initiation
8. `POST /staff/otp/generate` - OTP generation
9. `POST /public/customer/verify-otp` - OTP verification
10. `GET /public/menu/categories` - Menu browsing
11. `POST /public/order/place` - Order placement
12. `GET /public/order` - Order retrieval

## Database Tables Validated

- ✅ restaurants
- ✅ branches (with currency fields)
- ✅ staff (super admin, manager, captain)
- ✅ areas
- ✅ tables
- ✅ menu_categories
- ✅ menu_items (with food_type)
- ✅ table_sessions
- ✅ customers
- ✅ customer_profiles
- ✅ otp_requests
- ✅ orders
- ✅ order_items
- ✅ kots

## Next Steps

To extend testing:
1. Add multiple customers to same session
2. Test OTP reuse for same table
3. Test kitchen order status updates
4. Test WebSocket real-time notifications
5. Test order modifications
6. Test payment flow
7. Test multi-currency restaurants (USD, GBP, EUR)

## Troubleshooting

If test fails:
1. Ensure super admin exists in database
2. Check DATABASE_URL connection string
3. Verify JWT_SECRET is configured
4. Ensure all Lambda functions are deployed
5. Check API Gateway endpoints are accessible

## Running Individual Steps

You can extract specific steps for focused testing:
- Restaurant creation only
- Menu management flow
- Customer authentication flow
- Order placement flow
