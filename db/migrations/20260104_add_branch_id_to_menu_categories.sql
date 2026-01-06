-- Add branch_id to menu_categories and drop restaurant_id
ALTER TABLE menu_categories ADD COLUMN branch_id UUID REFERENCES branches(id);

-- Backfill branch_id using existing restaurant_id -> pick an active branch if available
UPDATE menu_categories mc
SET branch_id = (
  SELECT b.id
  FROM branches b
  WHERE b.restaurant_id = mc.restaurant_id
  ORDER BY b.is_active DESC, b.created_at NULLS LAST, b.id
  LIMIT 1
)
WHERE mc.branch_id IS NULL;

-- Enforce not null once backfilled
ALTER TABLE menu_categories
  ALTER COLUMN branch_id SET NOT NULL;

-- Drop old restaurant_id column
ALTER TABLE menu_categories DROP COLUMN restaurant_id;

-- Helpful index
CREATE INDEX IF NOT EXISTS idx_menu_categories_branch_id ON menu_categories(branch_id);
