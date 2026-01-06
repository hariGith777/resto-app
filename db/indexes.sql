-- =========================
-- RESTAURANTS & STRUCTURE
-- =========================

CREATE INDEX idx_branches_restaurant
  ON branches (restaurant_id);

CREATE INDEX idx_areas_branch
  ON areas (branch_id);

CREATE INDEX idx_tables_area
  ON tables (area_id);

CREATE INDEX idx_tables_active
  ON tables (is_active);

-- =========================
-- STAFF & ROLES
-- =========================

CREATE INDEX idx_staff_branch
  ON staff (branch_id);

CREATE INDEX idx_staff_role
  ON staff (role);

CREATE INDEX idx_staff_phone
  ON staff (phone);

-- Optional index for lookups by username
CREATE INDEX IF NOT EXISTS idx_staff_username
  ON staff (username);

-- =========================
-- SESSION & CUSTOMER AUTH
-- =========================

CREATE INDEX idx_table_sessions_table
  ON table_sessions (table_id);

CREATE INDEX idx_table_sessions_status
  ON table_sessions (status);

CREATE INDEX idx_customer_profiles_phone
  ON customer_profiles (phone);

CREATE INDEX idx_customers_session
  ON customers (session_id);

CREATE INDEX idx_customers_profile
  ON customers (customer_profile_id);

CREATE INDEX idx_otp_session_phone
  ON otp_requests (session_id, customer_phone);

CREATE INDEX idx_otp_expires
  ON otp_requests (expires_at);

-- =========================
-- MENU
-- =========================

CREATE INDEX idx_menu_categories_restaurant
  ON menu_categories (restaurant_id);

CREATE INDEX idx_menu_items_category
  ON menu_items (category_id);

CREATE INDEX idx_menu_items_available
  ON menu_items (is_available);

CREATE INDEX idx_menu_items_veg
  ON menu_items (is_veg);

-- =========================
-- ORDERS & KOT
-- =========================

CREATE INDEX idx_orders_session
  ON orders (session_id);

CREATE INDEX idx_orders_status
  ON orders (status);

CREATE INDEX idx_orders_created
  ON orders (created_at);

CREATE INDEX idx_order_items_order
  ON order_items (order_id);

CREATE INDEX idx_kots_order
  ON kots (order_id);

CREATE INDEX idx_kots_status
  ON kots (status);

-- =========================
-- WEBSOCKETS
-- =========================

CREATE INDEX idx_ws_branch
  ON ws_connections (branch_id);

-- =========================
-- BILLING & PAYMENTS
-- =========================

CREATE INDEX idx_bills_order
  ON bills (order_id);

CREATE INDEX idx_payments_bill
  ON payments (bill_id);

CREATE INDEX idx_payments_status
  ON payments (status);

CREATE INDEX idx_payments_paid_at
  ON payments (paid_at);

-- =========================
-- AI & PERSONALIZATION
-- =========================

CREATE INDEX idx_ai_kb_restaurant
  ON ai_knowledge_base (restaurant_id);

CREATE INDEX idx_ai_interactions_session
  ON ai_interactions (session_id);

CREATE INDEX idx_ai_interactions_item
  ON ai_interactions (menu_item_id);

CREATE INDEX idx_customer_preferences_customer
  ON customer_preferences (customer_profile_id);

CREATE INDEX idx_ai_context_restaurant
  ON ai_recommendation_context (restaurant_id);

-- =========================
-- SUBSCRIPTIONS (CRITICAL)
-- =========================

CREATE INDEX idx_restaurant_sub_plan
  ON restaurant_subscriptions (plan_id);

CREATE INDEX idx_subscription_status
  ON restaurant_subscriptions (status);

CREATE INDEX idx_subscription_usage_restaurant
  ON subscription_usage (restaurant_id);

CREATE INDEX idx_subscription_usage_month
  ON subscription_usage (month);
