-- Migration: Add comprehensive menu item fields
-- Date: 2026-01-16
-- Description: Add image, tags, preparation time, kitchen type, and multiple pricing for variations

-- 1. Add food_type enum to replace is_veg boolean
DO $$ BEGIN
    CREATE TYPE food_type_enum AS ENUM ('VEG', 'NON_VEG', 'EGG');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Add new columns to menu_items
ALTER TABLE menu_items 
ADD COLUMN IF NOT EXISTS food_type food_type_enum,
ADD COLUMN IF NOT EXISTS image_url TEXT,
ADD COLUMN IF NOT EXISTS tags TEXT[],
ADD COLUMN IF NOT EXISTS preparation_time INT, -- minutes
ADD COLUMN IF NOT EXISTS kitchen_type VARCHAR(20) CHECK (kitchen_type IN ('VEG_KITCHEN', 'NON_VEG_KITCHEN'));

-- 3. Migrate existing is_veg data to food_type
UPDATE menu_items 
SET food_type = CASE 
    WHEN is_veg = true THEN 'VEG'::food_type_enum
    WHEN is_veg = false THEN 'NON_VEG'::food_type_enum
    ELSE NULL
END
WHERE food_type IS NULL;

-- 4. Add new pricing columns to menu_portions for different order types
ALTER TABLE menu_portions
ADD COLUMN IF NOT EXISTS base_price NUMERIC(10,2),
ADD COLUMN IF NOT EXISTS delivery_price NUMERIC(10,2),
ADD COLUMN IF NOT EXISTS takeaway_price NUMERIC(10,2);

-- 5. Migrate existing portion prices to base_price
UPDATE menu_portions
SET base_price = price
WHERE base_price IS NULL AND price IS NOT NULL;

-- 6. Set delivery and takeaway prices equal to base price initially
UPDATE menu_portions
SET delivery_price = base_price,
    takeaway_price = base_price
WHERE delivery_price IS NULL OR takeaway_price IS NULL;

-- 7. Make base_price required after migration
ALTER TABLE menu_portions 
ALTER COLUMN base_price SET NOT NULL;

-- 8. Add comments for clarity
COMMENT ON COLUMN menu_items.food_type IS 'Type of food: VEG, NON_VEG, or EGG';
COMMENT ON COLUMN menu_items.image_url IS 'URL of uploaded menu item image';
COMMENT ON COLUMN menu_items.tags IS 'Tags like Spicy, Halal, Chef''s Special (can be AI-suggested)';
COMMENT ON COLUMN menu_items.preparation_time IS 'Estimated preparation time in minutes';
COMMENT ON COLUMN menu_items.kitchen_type IS 'Which kitchen prepares this: VEG_KITCHEN or NON_VEG_KITCHEN';
COMMENT ON COLUMN menu_portions.base_price IS 'Base price for dine-in orders';
COMMENT ON COLUMN menu_portions.delivery_price IS 'Price for delivery orders';
COMMENT ON COLUMN menu_portions.takeaway_price IS 'Price for takeaway orders';

-- Note: is_veg column can be dropped in a future migration once all code is updated
-- For now, we'll keep it for backward compatibility
