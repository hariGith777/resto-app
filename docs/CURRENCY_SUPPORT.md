# Multi-Currency Support Documentation

## Overview
The restaurant platform now supports multi-currency functionality, allowing restaurants from different countries to be onboarded with their local currency. All price-related APIs have been updated to include currency information in a standardized format.

## Database Changes

### Branches Table
Added three new columns to the `branches` table:

```sql
ALTER TABLE branches 
ADD COLUMN country VARCHAR(50) DEFAULT 'India',
ADD COLUMN currency_code VARCHAR(3) DEFAULT 'INR',
ADD COLUMN currency_symbol VARCHAR(5) DEFAULT '₹';
```

**Column Details:**
- `country`: Full country name (e.g., 'USA', 'India', 'UK')
- `currency_code`: ISO 4217 currency code (e.g., 'USD', 'INR', 'GBP', 'EUR')
- `currency_symbol`: Currency symbol (e.g., '$', '₹', '£', '€')

## API Changes

### 1. Restaurant Onboarding

**Endpoint:** `POST /super-admin/createRestaurant`

**Updated Request Body:**
```json
{
  "name": "Restaurant Name",
  "logoUrl": "https://...",
  "primaryColor": "#FF5733",
  "secondaryColor": "#3366FF",
  "branches": [
    {
      "name": "Branch Name",
      "address": "Street Address",
      "country": "USA",
      "currencyCode": "USD",
      "currencySymbol": "$",
      "manager": {
        "name": "Manager Name",
        "username": "manager_username",
        "phone": "+12125551234"
      }
    }
  ]
}
```

**New Fields:**
- `country` (optional): Defaults to 'India'
- `currencyCode` (optional): Defaults to 'INR'
- `currencySymbol` (optional): Defaults to '₹'

### 2. Menu APIs

#### Get Menu Categories
**Endpoint:** `GET /public/menu/categories?sessionId=<session-id>`

**Updated Response:**
```json
[
  {
    "id": "category-uuid",
    "name": "Appetizers",
    "display_order": 1,
    "items": [
      {
        "id": "item-uuid",
        "name": "Grilled Salmon",
        "description": "Fresh Atlantic salmon",
        "base_price": "24.99",
        "price": {
          "amount": 24.99,
          "currency": "USD",
          "symbol": "$",
          "formatted": "$24.99"
        },
        "food_type": "NON_VEG",
        "is_veg": false,
        "spice_level": "MILD"
      }
    ]
  }
]
```

#### Get Menu Items
**Endpoint:** `GET /public/menu/items?categoryId=<category-id>`

**Updated Response:**
```json
[
  {
    "id": "item-uuid",
    "category_id": "category-uuid",
    "name": "Butter Chicken",
    "description": "Creamy tomato curry",
    "base_price": "350.00",
    "price": {
      "amount": 350,
      "currency": "INR",
      "symbol": "₹",
      "formatted": "₹350.00"
    },
    "food_type": "NON_VEG",
    "spice_level": "MEDIUM"
  }
]
```

#### Create Menu Item (Admin)
**Endpoint:** `POST /admin/menu/items`

**Request Body:** (unchanged)
```json
{
  "categoryId": "category-uuid",
  "name": "Item Name",
  "basePrice": 24.99,
  "foodType": "VEG",
  "spiceLevel": "MEDIUM"
}
```

**Updated Response:**
```json
{
  "message": "Menu item created successfully",
  "menuItem": {
    "id": "item-uuid",
    "name": "Item Name",
    "base_price": "24.99",
    "price": {
      "amount": 24.99,
      "currency": "USD",
      "symbol": "$",
      "formatted": "$24.99"
    },
    "food_type": "VEG"
  }
}
```

### 3. Order APIs

#### Place Order
**Endpoint:** `POST /public/order/place?sessionId=<session-id>`

**Request Body:** (unchanged)
```json
{
  "items": [
    {
      "menuItemId": "item-uuid",
      "qty": 2
    }
  ]
}
```

**Updated Response:**
```json
{
  "message": "Order placed successfully",
  "orderId": "order-uuid",
  "totalAmount": {
    "amount": 49.98,
    "currency": "USD",
    "symbol": "$",
    "formatted": "$49.98"
  },
  "itemCount": 1,
  "status": "PLACED"
}
```

#### Get Order
**Endpoint:** `GET /public/order/{orderId}` or `GET /public/order?sessionId=<session-id>`

**Updated Response:**
```json
{
  "id": "order-uuid",
  "session_id": "session-uuid",
  "status": "PLACED",
  "totalAmount": {
    "amount": 49.98,
    "currency": "USD",
    "symbol": "$",
    "formatted": "$49.98"
  },
  "created_at": "2026-01-07T...",
  "items": [...]
}
```

### 4. Kitchen APIs

#### Get Kitchen Orders
**Endpoint:** `GET /kitchen/orders?status=SENT`

**Updated Response:**
```json
{
  "orders": [
    {
      "orderId": "order-uuid",
      "table": "Main Hall - T5",
      "status": "SENT",
      "totalAmount": {
        "amount": 750.50,
        "currency": "INR",
        "symbol": "₹",
        "formatted": "₹750.50"
      },
      "itemCount": 3,
      "elapsedMinutes": 5,
      "items": [...]
    }
  ]
}
```

## Price Object Format

All price-related responses now include a standardized `price` or `totalAmount` object with the following structure:

```typescript
{
  amount: number,        // Numeric value (e.g., 24.99)
  currency: string,      // ISO currency code (e.g., "USD")
  symbol: string,        // Currency symbol (e.g., "$")
  formatted: string      // Ready-to-display format (e.g., "$24.99")
}
```

## Common Currency Codes

| Country | Currency Code | Symbol | Example |
|---------|--------------|--------|---------|
| India | INR | ₹ | ₹150.00 |
| USA | USD | $ | $24.99 |
| UK | GBP | £ | £18.50 |
| Eurozone | EUR | € | €22.00 |
| UAE | AED | د.إ | د.إ89.00 |
| Singapore | SGD | S$ | S$32.50 |
| Australia | AUD | A$ | A$35.00 |
| Japan | JPY | ¥ | ¥2500 |

## Implementation Details

### Files Modified

1. **Database Schema**
   - `db/schema.sql` - Added currency columns to branches table

2. **Restaurant Management**
   - `src/super-admin/createRestaurant.js` - Accept and save currency fields
   - `src/super-admin/login.js` - Created super admin login handler

3. **Menu APIs**
   - `src/public/menu/getCategories.js` - Include currency in menu items
   - `src/public/menu/getItems.js` - Include currency in items list
   - `src/admin/menu/createMenuItem.js` - Return currency in created items

4. **Order APIs**
   - `src/public/order/placeOrder.js` - Fetch and include currency in order response
   - `src/public/order/getOrder.js` - Include currency in order details
   - `src/kitchen/getOrders.js` - Include currency in kitchen display

5. **Configuration**
   - `serverless.yml` - Fixed super admin login handler path

### Query Pattern

To fetch currency information, join with the branches table:

```sql
SELECT 
  mi.*,
  b.currency_code,
  b.currency_symbol
FROM menu_items mi
JOIN menu_categories mc ON mc.id = mi.category_id
JOIN branches b ON b.id = mc.branch_id
WHERE ...
```

For orders:

```sql
SELECT 
  o.*,
  b.currency_code,
  b.currency_symbol
FROM orders o
JOIN table_sessions ts ON ts.id = o.session_id
JOIN tables t ON t.id = ts.table_id
JOIN areas a ON a.id = t.area_id
JOIN branches b ON b.id = a.branch_id
WHERE ...
```

## Migration for Existing Data

Existing branches will have default values:
- `country`: 'India'
- `currency_code`: 'INR'
- `currency_symbol`: '₹'

To update existing branches:

```sql
-- Update to USD
UPDATE branches 
SET country = 'USA', 
    currency_code = 'USD', 
    currency_symbol = '$'
WHERE id = 'branch-uuid';

-- Update to GBP
UPDATE branches 
SET country = 'UK', 
    currency_code = 'GBP', 
    currency_symbol = '£'
WHERE id = 'branch-uuid';
```

## Frontend Integration

### Displaying Prices

Use the `formatted` field directly:

```javascript
// Simple display
<span>{item.price.formatted}</span>

// Or build your own format
<span>{item.price.symbol}{item.price.amount.toFixed(2)}</span>

// With currency code
<span>{item.price.formatted} {item.price.currency}</span>
```

### Currency Filtering/Grouping

```javascript
// Group items by currency
const itemsByCurrency = items.reduce((acc, item) => {
  const currency = item.price.currency;
  if (!acc[currency]) acc[currency] = [];
  acc[currency].push(item);
  return acc;
}, {});
```

### Formatting on Client

If you need custom formatting:

```javascript
function formatCurrency(amount, currency, symbol) {
  // Locale-specific formatting
  const formatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency
  }).format(amount);
  
  return formatted;
}
```

## WebSocket Notifications

Kitchen notifications also include currency information:

```json
{
  "type": "NEW_ORDER",
  "orderId": "order-uuid",
  "totalAmount": {
    "amount": 49.98,
    "currency": "USD",
    "symbol": "$",
    "formatted": "$49.98"
  },
  "itemCount": 2,
  "status": "PLACED"
}
```

## Testing

Run the currency test:

```bash
node test-currency.mjs
```

This will:
1. Create a new restaurant with USD currency
2. Create menu items with USD pricing
3. Verify all APIs return proper currency formatting
4. Compare with existing INR restaurants

## Best Practices

1. **Always use the formatted field** for display to ensure consistency
2. **Store currency at branch level**, not per item (all items in a branch use the same currency)
3. **Validate currency codes** when onboarding to prevent typos
4. **Consider exchange rates** if implementing multi-currency payments (not yet implemented)
5. **Use decimal precision** appropriate for the currency (e.g., JPY doesn't use decimals)

## Future Enhancements

- [ ] Currency exchange rates for reporting
- [ ] Multi-currency payment processing
- [ ] Dynamic currency conversion for tourists
- [ ] Historical currency tracking
- [ ] Currency-specific decimal precision handling
- [ ] Localized number formatting based on country
