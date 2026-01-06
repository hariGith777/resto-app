-- Migration: add manager_id to branches (references staff.id) and index
-- This allows linking a branch to its manager (RESTAURANT_ADMIN)

ALTER TABLE IF EXISTS branches
  ADD COLUMN IF NOT EXISTS manager_id UUID REFERENCES staff(id);

CREATE INDEX IF NOT EXISTS idx_branches_manager
  ON branches (manager_id);
