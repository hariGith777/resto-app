# UPDATE API Changes - isActive Toggle & Timestamps

## Overview
All UPDATE APIs now support:
1. **`updated_at` timestamp** - Automatically set to NOW() on every update
2. **`isActive` boolean toggle** - Enable/disable entities via API

## Database Changes

### New Columns Added
All tables now have standardized `updated_at` and `is_active` columns:

```sql
-- Tables updated with is_active + updated_at:
- restaurants (added is_active)
- branches (added updated_at)
- areas (added is_active + updated_at)
- tables (added updated_at)
- staff (added updated_at)
- menu_categories (added updated_at)
- menu_items (added updated_at)
- orders (added is_active + updated_at)
- order_items (added updated_at)
- kots (added updated_at)
```

### Migration Applied
File: `/db/migrations/add_missing_is_active_columns.sql`
Status: ✅ Successfully applied

## API Updates

### 1. Update Restaurant
**Endpoint:** `PUT /super-admin/restaurants/{id}`

**New Fields:**
- `isActive` (boolean) - Enable/disable restaurant

**Example:**
```json
{
  "name": "My Restaurant",
  "isActive": false
}
```

### 2. Update Branch
**Endpoint:** `PUT /super-admin/branches/{id}`

**Existing:** Already had `isActive` support
**Enhanced:** Now sets `updated_at` timestamp

### 3. Update Area
**Endpoint:** `PUT /admin/areas/{id}`

**Existing:** API already supported `isActive` 
**Fixed:** Database column was missing - now added
**Enhanced:** Now sets `updated_at` timestamp

### 4. Update Table
**Endpoint:** `PUT /admin/tables/{id}`

**Existing:** Already had `isActive` support
**Enhanced:** Now sets `updated_at` timestamp

### 5. Update Menu Category
**Endpoint:** `PUT /admin/menu/categories/{id}`

**Existing:** Already had `isActive` support
**Enhanced:** Now sets `updated_at` timestamp

### 6. Update Menu Item
**Endpoint:** `PUT /admin/menu/items/{id}`

**Existing:** Already had `isAvailable` support
**Enhanced:** Now sets `updated_at` timestamp

**Note:** Menu items use `isAvailable` instead of `isActive` (same concept)

### 7. Update Staff
**Endpoint:** `PUT /admin/staff/{id}`

**New Fields:**
- `isActive` (boolean) - Enable/disable staff member

**Example:**
```json
{
  "name": "John Doe",
  "isActive": false
}
```

**Enhanced:** Now sets `updated_at` timestamp

### 8. Update Order Status
**Endpoint:** `PATCH /kitchen/order/{orderId}/status`

**Enhanced:** 
- Sets `updated_at` on orders table
- Sets `updated_at` on kots table

**Note:** Orders use `status` field for state management, `isActive` for soft delete

### 9. Update Cart Item
**Endpoint:** `PUT /public/cart/item` (or similar)

**Enhanced:** Now sets `updated_at` timestamp on order_items

## Usage Examples

### Toggle Active Status
```bash
# Disable a staff member
curl -X PUT https://api.example.com/admin/staff/abc-123 \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"isActive": false}'

# Enable a restaurant
curl -X PUT https://api.example.com/super-admin/restaurants/xyz-456 \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"isActive": true}'
```

### Partial Updates
All UPDATE APIs support partial updates - only send fields you want to change:

```json
// Only update name
{"name": "New Name"}

// Only toggle active status
{"isActive": false}

// Update multiple fields
{
  "name": "New Name",
  "isActive": true
}
```

## Benefits

### 1. Audit Trail
- Every update now tracked with timestamp
- Can monitor when entities were last modified
- Useful for debugging and compliance

### 2. Soft Delete Pattern
- Use `isActive=false` instead of DELETE
- Maintains referential integrity
- Allows data recovery
- Historical data preserved

### 3. Feature Toggles
- Disable features without deleting data
- Temporarily hide menu items
- Deactivate staff without removing access
- Branch-level on/off switches

### 4. Consistency
- All tables follow same pattern
- Predictable API behavior
- Easier to maintain

## Postman Collection

Updated requests:
- ✅ Update Restaurant - Added `isActive` example
- ✅ Update Staff - Added `isActive` example
- ✅ All other UPDATE requests already had proper examples

## Testing

### Verify Timestamp Updates
```sql
-- Before update
SELECT name, updated_at FROM staff WHERE id = 'abc-123';

-- After update (updated_at should change)
UPDATE staff SET name = 'New Name', updated_at = NOW() WHERE id = 'abc-123';

-- Verify
SELECT name, updated_at FROM staff WHERE id = 'abc-123';
```

### Verify isActive Toggle
```sql
-- Disable entity
UPDATE staff SET is_active = false WHERE id = 'abc-123';

-- Verify
SELECT name, is_active FROM staff WHERE id = 'abc-123';
-- Should return: | New Name | false |
```

## Schema Reference

### Standard Pattern
```sql
CREATE TABLE example_table (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  -- ... other fields ...
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);
```

### Query Pattern
```sql
UPDATE table_name 
SET field1 = $1, 
    field2 = $2, 
    updated_at = NOW()
WHERE id = $3
RETURNING *;
```

## Notes

- `updated_at` is **always** set by database, not by API input
- `isActive` defaults to `true` for new records
- All APIs use dynamic query building for partial updates
- Timestamps use PostgreSQL `NOW()` function
- All changes backward compatible

## Deployment Status

- ✅ Database migration applied
- ✅ Schema updated
- ✅ All UPDATE handlers updated
- ✅ Postman collection updated
- ⏳ Pending serverless deploy
