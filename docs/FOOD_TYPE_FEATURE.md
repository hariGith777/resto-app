# Food Type Categorization Feature

## Overview
Enhanced menu item creation to support three distinct food type options instead of a simple boolean `isVeg` field.

## Food Type Options

| Type | Value | Description | Icon |
|------|-------|-------------|------|
| Vegetarian | `VEG` | Purely vegetarian items (no meat, eggs, or animal products) | 🥬 |
| Non-Vegetarian | `NON_VEG` | Items containing meat, poultry, or seafood | 🍖 |
| Contains Egg | `EGG` | Items that contain eggs but no other animal products | 🥚 |

## Database Schema

Added `food_type` column to `menu_items` table:
```sql
ALTER TABLE menu_items 
ADD COLUMN food_type VARCHAR(20) 
CHECK (food_type IN ('VEG', 'NON_VEG', 'EGG')) 
DEFAULT 'VEG';
```

**Note:** The `is_veg` boolean field is kept for backward compatibility:
- `VEG` → `is_veg = true`
- `EGG` → `is_veg = true` (eggs are considered vegetarian in some contexts)
- `NON_VEG` → `is_veg = false`

## API Usage

### Create Menu Item with Food Type

**Endpoint:** `POST /admin/menu/items`

**Headers:**
```
Authorization: Bearer <admin_token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "categoryId": "uuid",
  "name": "Item Name",
  "description": "Item description",
  "basePrice": 150,
  "foodType": "VEG|NON_VEG|EGG",
  "spiceLevel": "MILD|MEDIUM|HOT",
  "allergens": ["gluten", "dairy"],
  "isAvailable": true
}
```

**Validation:**
- `foodType` must be one of: `VEG`, `NON_VEG`, `EGG`
- Invalid values will return 400 error

### Examples

#### Vegetarian Item
```json
{
  "categoryId": "category-uuid",
  "name": "Samosa",
  "description": "Crispy fried pastry with spiced potato filling",
  "basePrice": 50,
  "foodType": "VEG",
  "spiceLevel": "MEDIUM",
  "allergens": ["gluten"]
}
```

#### Non-Vegetarian Item
```json
{
  "categoryId": "category-uuid",
  "name": "Chicken Tikka",
  "description": "Grilled chicken marinated in yogurt and spices",
  "basePrice": 180,
  "foodType": "NON_VEG",
  "spiceLevel": "HOT",
  "allergens": ["dairy"]
}
```

#### Egg-Containing Item
```json
{
  "categoryId": "category-uuid",
  "name": "Egg Fried Rice",
  "description": "Fried rice with scrambled eggs and vegetables",
  "basePrice": 120,
  "foodType": "EGG",
  "spiceLevel": "MILD",
  "allergens": ["egg", "soy"]
}
```

## Response Format

All menu item responses now include the `food_type` field:

```json
{
  "message": "Menu item created successfully",
  "menuItem": {
    "id": "item-uuid",
    "category_id": "category-uuid",
    "name": "Samosa",
    "description": "Crispy fried pastry with spiced potato filling",
    "base_price": "50.00",
    "food_type": "VEG",
    "is_veg": true,
    "spice_level": "MEDIUM",
    "allergens": ["gluten"],
    "is_available": true,
    "created_at": "2026-01-07T16:45:42.438Z"
  }
}
```

## Public Menu Endpoints

Both public menu endpoints now return the `food_type` field:

- `GET /public/menu/categories?sessionId=<session-id>`
- `GET /public/menu/items?categoryId=<category-id>`

Customers can now:
- See clear food type indicators for each item
- Filter menu by dietary preferences
- Make informed ordering decisions

## Use Cases

### Indian Restaurant Context
In Indian restaurants, food categorization is important:
- **VEG** - Strict vegetarians (no eggs)
- **EGG** - Lacto-ovo vegetarians (consume eggs but no meat)
- **NON_VEG** - Meat/seafood consumers

### Customer Filtering
Future enhancement: Add query parameters to filter by food type:
```
GET /public/menu/categories?sessionId=xxx&foodType=VEG
GET /public/menu/items?categoryId=xxx&foodType=NON_VEG
```

## Testing

Run the test script:
```bash
node test-admin-menu.mjs
```

This will create:
- 1 category (Appetizers)
- 3 items with different food types:
  - Samosa (VEG) - ₹50
  - Chicken Tikka (NON_VEG) - ₹180
  - Egg Fried Rice (EGG) - ₹120

## Migration Notes

### Existing Items
For existing menu items without `food_type`:
- Default value is `VEG`
- Update existing items manually if needed:
```sql
UPDATE menu_items 
SET food_type = 'NON_VEG' 
WHERE name LIKE '%Chicken%' OR name LIKE '%Mutton%';

UPDATE menu_items 
SET food_type = 'EGG' 
WHERE name LIKE '%Egg%';
```

### Frontend Integration

Display food type with icons:
```javascript
const getFoodTypeIcon = (foodType) => {
  switch(foodType) {
    case 'VEG': return '🥬 Veg';
    case 'NON_VEG': return '🍖 Non-Veg';
    case 'EGG': return '🥚 Contains Egg';
    default: return '🥬 Veg';
  }
};
```

## Files Modified

1. `src/admin/menu/createMenuItem.js` - Added foodType parameter and validation
2. `src/public/menu/getCategories.js` - Added food_type to SELECT query
3. `test-admin-menu.mjs` - Updated to test all three food types
4. Database: Added `food_type` column to `menu_items` table

## Deployment

All changes deployed successfully:
```bash
serverless deploy
```

Functions updated:
- `createMenuItem`
- `getMenuCategories`
- `getMenuItems`
