-- Add missing is_active columns and updated_at timestamps

-- Add is_active to areas table
ALTER TABLE areas ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE areas ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT now();

-- Add updated_at to tables that are missing it
ALTER TABLE branches ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT now();
ALTER TABLE tables ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT now();
ALTER TABLE staff ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT now();
ALTER TABLE menu_categories ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT now();
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT now();
ALTER TABLE orders ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT now();
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT now();
ALTER TABLE kots ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT now();

-- Add is_active to restaurants (convert from status)
-- ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
-- If you want to keep both status and is_active, uncomment above
-- Or we can add it when status is 'ACTIVE'

-- Add is_active to orders if needed for cancellation/archive
ALTER TABLE orders ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
