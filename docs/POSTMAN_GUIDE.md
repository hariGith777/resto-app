# Postman Collection - Restaurant Platform End-to-End Flow

## Overview
Complete Postman collection covering the entire restaurant platform flow from super admin login to customer order placement with multi-currency support.

## Quick Start

### 1. Import Collection
1. Open Postman
2. Click **Import**
3. Select `Restaurant_Platform_E2E.postman_collection.json`
4. Collection will appear in your workspace

### 2. Set Initial Variables

Before running the collection, you need to set one variable manually:

**Required Variable:**
- `superAdminUsername` - Username of a super admin from your database

**How to get it:**
```sql
SELECT username FROM staff WHERE role = 'SUPER_ADMIN' LIMIT 1;
```

**Set the variable:**
1. Click on the collection name
2. Go to **Variables** tab
3. Set `superAdminUsername` with the username from database
4. Save the collection

### 3. Additional Setup (Manual Steps)

Some infrastructure needs to be created via database as there are no admin APIs yet:

**After running "Create Restaurant" request**, execute these SQL queries:

```sql
-- 1. Create Area (replace {{branchId}} with actual value from previous request)
INSERT INTO areas(branch_id, name) 
VALUES('your-branch-id-here', 'Main Hall') 
RETURNING id;

-- 2. Create Table (replace {{areaId}} with ID from step 1)
INSERT INTO tables(area_id, table_number, capacity, qr_code, is_active) 
VALUES('your-area-id-here', '1', 4, 'QR_TABLE_1', true) 
RETURNING id;

-- 3. Create Captain (replace {{branchId}} with actual value)
INSERT INTO staff(branch_id, name, username, role, phone, is_active) 
VALUES('your-branch-id-here', 'Postman Captain', 'postman_captain', 'CAPTAIN', '+919876543211', true) 
RETURNING id;
```

**Set these variables in Postman:**
- `tableId` - ID from table creation
- Then continue with the collection

### 4. Run the Flow

Execute requests in order:

1. **Setup** → Get Super Admin ID (info only)
2. **1. Super Admin** → Super Admin Login
3. **1. Super Admin** → Create Restaurant
4. **2. Infrastructure Setup** → Run SQL queries manually
5. **3. Manager - Menu Setup** → All requests in order
6. **4. Captain** → Captain Login
7. **5. Customer Flow** → All requests in order

## Collection Structure

### 📁 Setup
- Health check and variable setup instructions

### 📁 1. Super Admin
- **Super Admin Login** - Authenticate as platform admin
- **Create Restaurant** - Create restaurant with branches and currency

### 📁 2. Infrastructure Setup (Manual)
- Create Area (SQL)
- Create Table (SQL)
- Create Captain (SQL)

### 📁 3. Manager - Menu Setup
- **Manager Login** - Authenticate as branch manager
- **Create Menu Category** - Add category (e.g., Starters)
- **Create Menu Item - VEG** - Add vegetarian item
- **Create Menu Item - NON_VEG** - Add non-veg item
- **Create Menu Item - EGG** - Add egg-containing item

### 📁 4. Captain
- **Captain Login** - Authenticate for OTP generation

### 📁 5. Customer Flow
- **Start Session** - Customer scans QR code
- **Customer Initiate Login** - Customer enters phone
- **Generate OTP** - Captain generates OTP
- **Verify OTP** - Customer verifies and gets token
- **Browse Menu** - View menu with prices
- **Place Order** - Submit order (2x Chicken Wings + 1x Egg Rolls = ₹560)
- **Get Order Details** - Retrieve order with currency

### 📁 6. Optional - Kitchen & Admin
- Additional endpoints for exploration

## Variables

The collection uses these variables (most are auto-populated):

| Variable | Description | Auto-filled? |
|----------|-------------|--------------|
| `baseUrl` | API base URL | ✅ Pre-set |
| `superAdminUsername` | Super admin username | ❌ Manual |
| `superAdminToken` | Super admin JWT | ✅ From login |
| `managerToken` | Manager JWT | ✅ From login |
| `captainToken` | Captain JWT | ✅ From login |
| `customerToken` | Customer JWT | ✅ From OTP verify |
| `restaurantId` | Created restaurant | ✅ From create |
| `branchId` | Created branch | ✅ From create |
| `tableId` | Created table | ❌ Manual (SQL) |
| `categoryId` | Menu category | ✅ From create |
| `menuItem1Id` | First menu item | ✅ From create |
| `menuItem2Id` | Second menu item | ✅ From create |
| `menuItem3Id` | Third menu item | ✅ From create |
| `sessionId` | Table session | ✅ From QR scan |
| `customerPhone` | Customer phone | ✅ Pre-set |
| `otp` | Generated OTP | ✅ From generate |
| `orderId` | Placed order | ✅ From order |

## Test Scripts

Each request includes test scripts that:
- ✅ Validate response status codes
- ✅ Check response structure
- ✅ Extract values for next requests
- ✅ Set collection variables automatically
- ✅ Log important information to console

## Key Features Demonstrated

### 🌍 Multi-Currency Support
```json
{
  "price": {
    "amount": 220,
    "currency": "INR",
    "symbol": "₹",
    "formatted": "₹220.00"
  }
}
```

### 🥗 Food Type Classification
- **VEG** - Vegetarian (Paneer Tikka)
- **NON_VEG** - Non-vegetarian (Chicken Wings)
- **EGG** - Contains eggs (Egg Rolls)

### 🔐 Authentication
- JWT tokens for all user types
- OTP-based customer authentication
- Role-based access control

### 📱 Complete Order Flow
1. QR scan → Session
2. Customer login → OTP verification
3. Browse menu → Place order
4. Order confirmation with currency

## Expected Results

### Order Calculation
```
2x Chicken Wings @ ₹220 = ₹440
1x Egg Rolls @ ₹120 = ₹120
-----------------------------------
Total: ₹560.00
```

### Response Examples

**Create Menu Item Response:**
```json
{
  "message": "Menu item created successfully",
  "menuItem": {
    "id": "uuid",
    "name": "Paneer Tikka",
    "base_price": "180.00",
    "food_type": "VEG",
    "price": {
      "amount": 180,
      "currency": "INR",
      "symbol": "₹",
      "formatted": "₹180.00"
    }
  }
}
```

**Place Order Response:**
```json
{
  "orderId": "uuid",
  "totalAmount": {
    "amount": 560,
    "currency": "INR",
    "symbol": "₹",
    "formatted": "₹560.00"
  },
  "itemCount": 2,
  "status": "PLACED"
}
```

## Troubleshooting

### Issue: Super Admin Login Fails
- Ensure `superAdminUsername` variable is set correctly
- Verify super admin exists in database with username
- Check username format is correct

### Issue: Restaurant Creation Fails
- Verify super admin token is valid
- Check request body format
- Ensure JWT_SECRET matches server

### Issue: Menu Item Creation Fails
- Ensure manager is logged in
- Check `categoryId` is set
- Verify branch ownership

### Issue: Order Placement Fails
- Verify customer token is valid
- Check menu item IDs exist
- Ensure session is active

## API Endpoints Reference

```
Base URL: https://c83055bt54.execute-api.ap-south-1.amazonaws.com

Authentication:
POST /super-admin/login
POST /staff/login
POST /public/customer/verify-otp

Restaurant Setup:
POST /super-admin/createRestaurant

Menu Management:
POST /admin/menu/categories
POST /admin/menu/items
GET  /public/menu/categories
GET  /public/menu/items

Customer Flow:
POST /public/qr/session/start
POST /public/customer/initiate
POST /staff/otp/generate
POST /public/order/place
GET  /public/order

Staff:
GET  /staff/active-tables
```

## Database Schema Notes

### Branches Table
```sql
CREATE TABLE branches (
  id UUID PRIMARY KEY,
  restaurant_id UUID REFERENCES restaurants(id),
  name TEXT,
  address TEXT,
  country VARCHAR(50) DEFAULT 'India',
  currency_code VARCHAR(3) DEFAULT 'INR',
  currency_symbol VARCHAR(5) DEFAULT '₹',
  is_active BOOLEAN DEFAULT true
);
```

### Menu Items Table
```sql
CREATE TABLE menu_items (
  id UUID PRIMARY KEY,
  category_id UUID REFERENCES menu_categories(id),
  name TEXT,
  description TEXT,
  base_price NUMERIC(10,2),
  food_type VARCHAR(20) CHECK (food_type IN ('VEG', 'NON_VEG', 'EGG')),
  is_veg BOOLEAN,
  spice_level VARCHAR(20),
  allergens JSONB,
  is_available BOOLEAN DEFAULT true
);
```

## Tips

1. **Use Collection Runner** - Run entire flow automatically
2. **Check Console** - Important IDs logged after each request
3. **Save Responses** - Add examples for common scenarios
4. **Environment Variables** - Create dev/staging/prod environments
5. **Pre-request Scripts** - Add custom logic if needed

## Next Steps

After successful run:
1. Test with different currencies (USD, GBP, EUR)
2. Create multiple customers at same table
3. Test OTP reuse feature
4. Test kitchen order updates
5. Add WebSocket testing
6. Test error scenarios

## Support

For issues or questions:
1. Check console logs in Postman
2. Verify all variables are set
3. Ensure database is accessible
4. Check Lambda function logs in AWS CloudWatch
