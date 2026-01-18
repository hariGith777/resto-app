# Menu Item Creation - Complete Field Guide

## Overview

This document describes all fields available when creating menu items in the restaurant management system, including AI-powered features for description generation and tag suggestions.

## Menu Item Fields

### 1. Item Name (Required)
**Type:** Text  
**Description:** The name of the menu item  
**Example:** "Paneer Tikka", "Chicken Biryani", "Margherita Pizza"  
**Validation:** Required, cannot be empty

### 2. Description
**Type:** Text (long)  
**Description:** Detailed description of the dish  
**Features:** 
- **"Generate with AI" button** - Automatically generates description based on item name, food type, and tags
- Can be manually edited after generation

**Example:**
```
"Succulent paneer cubes marinated in aromatic spices and grilled to perfection. 
A chef's special that showcases our culinary expertise. With a kick of heat for spice lovers."
```

**API Endpoint:** `POST /admin/menu/generate-description`
```json
{
  "itemName": "Paneer Tikka",
  "foodType": "VEG",
  "tags": ["Spicy", "Chef's Special"]
}
```

**Response:**
```json
{
  "description": "A delightful vegetarian dish featuring paneer tikka...",
  "generated": true,
  "note": "AI-generated description. Feel free to edit and customize."
}
```

### 3. Food Type (Required)
**Type:** Radio Selection  
**Options:**
- 🟢 **VEG** - Vegetarian (no meat, fish, or eggs)
- 🔴 **NON_VEG** - Non-Vegetarian (contains meat or fish)
- 🟡 **EGG** - Contains Egg (vegetarian but includes eggs)

**Database Field:** `food_type` (ENUM: 'VEG', 'NON_VEG', 'EGG')  
**Default:** VEG

**Usage:**
- Helps customers filter menu based on dietary preferences
- Determines kitchen assignment if kitchen_type is not specified

### 4. Image Upload
**Type:** File Upload  
**Supported Formats:** JPG, PNG, WebP  
**Max Size:** 5MB (recommended)  
**Recommended Dimensions:** 800x600px or 1200x900px  

**Database Field:** `image_url` (TEXT)  
**Storage:** Upload to cloud storage (AWS S3, Cloudinary, etc.)  
**Example:** `"https://cdn.example.com/menu-items/paneer-tikka.jpg"`

### 5. Tags
**Type:** Multi-select with suggestions  
**Description:** Labels to categorize and highlight special features  
**Features:**
- **"Suggest Tags with AI" button** - Automatically suggests relevant tags
- Manual selection and addition supported

**Common Tags:**
- **Spicy** - For dishes with heat
- **Halal** - Prepared according to Islamic dietary laws
- **Chef's Special** - Signature dish
- **Gluten-Free** - No gluten ingredients
- **Dairy-Free** - No dairy products
- **Bestseller** - Popular item
- **New** - Recently added
- **Grilled** - Grilled preparation
- **Fried** - Deep-fried or pan-fried
- **Healthy** - Low-calorie or nutritious
- **Contains Nuts** - Allergen warning
- **Organic** - Organic ingredients
- **Vegan** - No animal products

**Database Field:** `tags` (TEXT[] - PostgreSQL array)  
**Example:** `["Spicy", "Halal", "Chef's Special"]`

**API Endpoint:** `POST /admin/menu/suggest-tags`
```json
{
  "itemName": "Chicken Tikka Masala",
  "description": "Grilled chicken in creamy tomato sauce",
  "foodType": "NON_VEG"
}
```

**Response:**
```json
{
  "tags": ["Spicy", "Grilled", "Creamy", "Indian", "Halal"],
  "generated": true,
  "note": "AI-suggested tags. Select the ones that apply."
}
```

### 6. Preparation Time (Optional)
**Type:** Number (Minutes)  
**Description:** Estimated time to prepare the dish  
**Range:** 0-120 minutes  
**Database Field:** `preparation_time` (INT)  
**Example:** 15, 25, 45  

**Usage:**
- Informs customers of wait time
- Helps kitchen plan workflow
- Can be displayed on menu or order confirmation

### 7. Kitchen Selection (Optional)
**Type:** Radio Selection  
**Options:**
- **VEG_KITCHEN** - Prepared in vegetarian kitchen
- **NON_VEG_KITCHEN** - Prepared in non-vegetarian kitchen

**Database Field:** `kitchen_type` (VARCHAR(20))  
**Default:** Determined by food_type if not specified  

**Business Logic:**
- If `food_type = 'VEG'` and `kitchen_type` not set → defaults to VEG_KITCHEN
- If `food_type = 'NON_VEG'` → should use NON_VEG_KITCHEN
- If `food_type = 'EGG'` → restaurant can choose based on policy

**Usage:**
- Separates kitchen operations for hygiene/religious reasons
- Orders routed to appropriate kitchen display

## Variations/Portions

Each menu item can have multiple variations (sizes/portions) with different prices for different order types.

### Variation Fields

#### 1. Variation Name (Required)
**Type:** Text  
**Examples:** "Small", "Medium", "Large", "Half", "Full", "Regular", "Family Pack"  
**Database Field:** `menu_portions.label`

#### 2. Base Price (Required)
**Type:** Decimal (10,2)  
**Description:** Price for dine-in orders  
**Database Field:** `menu_portions.base_price`  
**Example:** 180.00

#### 3. Delivery Price (Optional)
**Type:** Decimal (10,2)  
**Description:** Price for delivery orders (may include packaging)  
**Database Field:** `menu_portions.delivery_price`  
**Default:** Same as base_price  
**Example:** 200.00 (₹20 more for packaging)

#### 4. Takeaway Price (Optional)
**Type:** Decimal (10,2)  
**Description:** Price for takeaway orders  
**Database Field:** `menu_portions.takeaway_price`  
**Default:** Same as base_price  
**Example:** 190.00 (₹10 more for packaging)

### Example Variations

**Pizza - Multiple Sizes:**
```json
[
  {
    "label": "Small (8 inch)",
    "basePrice": 299.00,
    "deliveryPrice": 319.00,
    "takeawayPrice": 309.00
  },
  {
    "label": "Medium (10 inch)",
    "basePrice": 449.00,
    "deliveryPrice": 469.00,
    "takeawayPrice": 459.00
  },
  {
    "label": "Large (12 inch)",
    "basePrice": 599.00,
    "deliveryPrice": 619.00,
    "takeawayPrice": 609.00
  }
]
```

**Biryani - Half/Full:**
```json
[
  {
    "label": "Half",
    "basePrice": 180.00,
    "deliveryPrice": 200.00,
    "takeawayPrice": 190.00
  },
  {
    "label": "Full",
    "basePrice": 320.00,
    "deliveryPrice": 340.00,
    "takeawayPrice": 330.00
  }
]
```

## API Specification

### Create Menu Item

**Endpoint:** `POST /admin/menu/items`  
**Authentication:** Required (RESTAURANT_ADMIN)  
**Headers:**
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "categoryId": "uuid",
  "name": "Paneer Tikka",
  "description": "Grilled cottage cheese with aromatic spices",
  "basePrice": 180.00,
  "foodType": "VEG",
  "imageUrl": "https://cdn.example.com/paneer-tikka.jpg",
  "tags": ["Spicy", "Chef's Special", "Halal"],
  "preparationTime": 15,
  "kitchenType": "VEG_KITCHEN",
  "spiceLevel": "MEDIUM",
  "allergens": ["DAIRY", "NUTS"],
  "isAvailable": true,
  "portions": [
    {
      "label": "Half",
      "basePrice": 180.00,
      "deliveryPrice": 200.00,
      "takeawayPrice": 190.00
    },
    {
      "label": "Full",
      "basePrice": 320.00,
      "deliveryPrice": 340.00,
      "takeawayPrice": 330.00
    }
  ]
}
```

**Response:** (201 Created)
```json
{
  "message": "Menu item created successfully",
  "menuItem": {
    "id": "uuid",
    "category_id": "uuid",
    "name": "Paneer Tikka",
    "description": "Grilled cottage cheese with aromatic spices",
    "base_price": 180.00,
    "food_type": "VEG",
    "image_url": "https://cdn.example.com/paneer-tikka.jpg",
    "tags": ["Spicy", "Chef's Special", "Halal"],
    "preparation_time": 15,
    "kitchen_type": "VEG_KITCHEN",
    "is_available": true,
    "created_at": "2026-01-16T14:30:00.000Z",
    "price": {
      "amount": 180.00,
      "currency": "INR",
      "symbol": "₹",
      "formatted": "₹180.00"
    }
  }
}
```

## Database Schema

### menu_items Table

```sql
CREATE TYPE food_type_enum AS ENUM ('VEG', 'NON_VEG', 'EGG');

CREATE TABLE menu_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category_id UUID NOT NULL REFERENCES menu_categories(id),
  name TEXT NOT NULL,
  description TEXT,
  base_price NUMERIC(10,2) NOT NULL,
  food_type food_type_enum,
  image_url TEXT,
  tags TEXT[],
  preparation_time INT,
  kitchen_type VARCHAR(20) CHECK (kitchen_type IN ('VEG_KITCHEN', 'NON_VEG_KITCHEN')),
  is_veg BOOLEAN,  -- Deprecated
  spice_level VARCHAR(20),
  allergens JSONB,
  is_available BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT now()
);
```

### menu_portions Table

```sql
CREATE TABLE menu_portions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  menu_item_id UUID NOT NULL REFERENCES menu_items(id),
  label VARCHAR(50),
  base_price NUMERIC(10,2) NOT NULL,
  delivery_price NUMERIC(10,2),
  takeaway_price NUMERIC(10,2),
  price NUMERIC(10,2)  -- Deprecated
);
```

## UI Components

### Food Type Radio Buttons
```jsx
<RadioGroup value={foodType} onChange={setFoodType}>
  <Radio value="VEG">🟢 Veg</Radio>
  <Radio value="NON_VEG">🔴 Non-Veg</Radio>
  <Radio value="EGG">🟡 Contains Egg</Radio>
</RadioGroup>
```

### AI Description Generator
```jsx
<TextArea 
  value={description} 
  onChange={setDescription}
  placeholder="Enter description..."
/>
<Button onClick={generateDescription}>
  ✨ Generate with AI
</Button>
```

### Tag Selector with AI
```jsx
<TagInput 
  selectedTags={tags}
  onChange={setTags}
  suggestions={commonTags}
/>
<Button onClick={suggestTags}>
  🤖 Suggest Tags with AI
</Button>
```

### Portion/Variation Builder
```jsx
{portions.map((portion, index) => (
  <PortionRow key={index}>
    <Input 
      placeholder="Variation Name (e.g., Small, Medium, Large)"
      value={portion.label}
      onChange={(e) => updatePortion(index, 'label', e.target.value)}
    />
    <Input 
      type="number"
      placeholder="Base Price"
      value={portion.basePrice}
      onChange={(e) => updatePortion(index, 'basePrice', e.target.value)}
    />
    <Input 
      type="number"
      placeholder="Delivery Price"
      value={portion.deliveryPrice}
      onChange={(e) => updatePortion(index, 'deliveryPrice', e.target.value)}
    />
    <Input 
      type="number"
      placeholder="Takeaway Price"
      value={portion.takeawayPrice}
      onChange={(e) => updatePortion(index, 'takeawayPrice', e.target.value)}
    />
  </PortionRow>
))}
<Button onClick={addPortion}>+ Add Variation</Button>
```

## Migration Applied

**File:** `db/migrations/add_menu_item_fields.sql`  
**Status:** ✅ Applied  
**Date:** 2026-01-16

**Changes:**
- Added `food_type` enum (VEG, NON_VEG, EGG)
- Added `image_url` for uploaded images
- Added `tags` array for categorization
- Added `preparation_time` in minutes
- Added `kitchen_type` for kitchen selection
- Updated `menu_portions` with `base_price`, `delivery_price`, `takeaway_price`
- Migrated existing data from `is_veg` to `food_type`

## Testing

### Create Item with All Fields
```bash
curl -X POST https://your-api.com/admin/menu/items \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "categoryId": "category-uuid",
    "name": "Paneer Tikka",
    "description": "Grilled paneer with spices",
    "basePrice": 180.00,
    "foodType": "VEG",
    "imageUrl": "https://example.com/image.jpg",
    "tags": ["Spicy", "Chef'\''s Special"],
    "preparationTime": 15,
    "kitchenType": "VEG_KITCHEN",
    "portions": [
      {"label": "Half", "basePrice": 180, "deliveryPrice": 200, "takeawayPrice": 190},
      {"label": "Full", "basePrice": 320, "deliveryPrice": 340, "takeawayPrice": 330}
    ]
  }'
```

### Generate Description
```bash
curl -X POST https://your-api.com/admin/menu/generate-description \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "itemName": "Paneer Tikka",
    "foodType": "VEG",
    "tags": ["Spicy", "Chef'\''s Special"]
  }'
```

### Suggest Tags
```bash
curl -X POST https://your-api.com/admin/menu/suggest-tags \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "itemName": "Chicken Biryani",
    "description": "Aromatic rice with spiced chicken",
    "foodType": "NON_VEG"
  }'
```

## Future Enhancements

- [ ] Integrate OpenAI/Anthropic for better AI description generation
- [ ] Image optimization and CDN integration
- [ ] Multi-language descriptions
- [ ] Nutritional information fields
- [ ] Allergen database with icons
- [ ] Dietary restriction filters (Jain, Kosher, etc.)
- [ ] Seasonal availability scheduling
- [ ] Dynamic pricing based on time/demand
