-- =====================================================
-- SUPER ADMINS (10)
-- =====================================================
INSERT INTO staff (id, name, username, role, phone)
SELECT uuid_generate_v4(),
       'Super Admin ' || i,
       'super' || i,
       'SUPER_ADMIN',
       '90000000' || i
FROM generate_series(1,10) i;
-- Minimal deterministic seed: ~5 records per table

-- SUPER ADMINS (5)
INSERT INTO staff (id, name, username, role, phone)
SELECT uuid_generate_v4(), 'Super Admin ' || i, 'super' || i, 'SUPER_ADMIN', '9000000' || i
FROM generate_series(1,5) i;

-- RESTAURANTS (5)
INSERT INTO restaurants (id, name, primary_color, secondary_color, status)
SELECT uuid_generate_v4(),
       'Restaurant ' || i,
       '#FF5722',
       '#4CAF50',
       'ACTIVE'
FROM generate_series(1,5) i;

-- BRANCHES (5)
INSERT INTO branches (id, restaurant_id, name, address, is_active)
SELECT uuid_generate_v4(), r.id, r.name || ' - Branch 1', 'Address ' || row_number() OVER (), true
FROM restaurants r
ORDER BY r.name
LIMIT 5;

-- AREAS (5)
INSERT INTO areas (id, branch_id, name)
SELECT uuid_generate_v4(), b.id, 'Main Hall'
FROM branches b
ORDER BY b.created_at
LIMIT 5;

-- TABLES (5)
INSERT INTO tables (id, area_id, table_number, capacity, qr_code, is_active)
SELECT uuid_generate_v4(), a.id, 'T' || row_number() OVER (), 4, 'QR' || row_number() OVER (), true
FROM areas a
ORDER BY a.created_at
LIMIT 5;

-- RESTAURANT ADMINS (5)
INSERT INTO staff (id, branch_id, name, username, role, phone)
SELECT uuid_generate_v4(), b.id, b.name || ' Manager', 'manager' || row_number() OVER (), 'RESTAURANT_ADMIN', '91111000' || row_number() OVER ()
FROM branches b
ORDER BY b.created_at
LIMIT 5;

-- CAPTAINS (5)
INSERT INTO staff (id, branch_id, name, username, role, phone)
SELECT uuid_generate_v4(), b.id, b.name || ' Captain', 'captain' || row_number() OVER (), 'CAPTAIN', '92222000' || row_number() OVER ()
FROM branches b
ORDER BY b.created_at
LIMIT 5;

-- KITCHEN (5)
INSERT INTO staff (id, branch_id, name, username, role)
SELECT uuid_generate_v4(), b.id, b.name || ' Kitchen', 'kitchen' || row_number() OVER (), 'KITCHEN'
FROM branches b
ORDER BY b.created_at
LIMIT 5;

-- MENU CATEGORIES (5)
INSERT INTO menu_categories (id, branch_id, name, display_order, is_active)
SELECT uuid_generate_v4(), b.id, 'Main', 1, true
FROM branches b
ORDER BY b.created_at
LIMIT 5;

-- MENU ITEMS (5)
WITH cats AS (
  SELECT id, row_number() OVER () rn FROM menu_categories ORDER BY name LIMIT 5
)
INSERT INTO menu_items (id, category_id, name, description, base_price, is_veg, spice_level, is_available)
SELECT uuid_generate_v4(), c.id, 'Item ' || c.rn, 'Sample item', 150 + (c.rn*10), true, 'MEDIUM', true
FROM cats c;

-- MENU PORTIONS (5)
WITH mi AS (
  SELECT id, base_price, row_number() OVER () rn FROM menu_items ORDER BY id LIMIT 5
)
INSERT INTO menu_portions (id, menu_item_id, label, price)
SELECT uuid_generate_v4(), mi.id, 'Full', mi.base_price
FROM mi;

-- MENU MODIFIERS (5)
WITH mi AS (
  SELECT id, row_number() OVER () rn FROM menu_items ORDER BY id LIMIT 5
)
INSERT INTO menu_modifiers (id, menu_item_id, name, price_delta)
SELECT uuid_generate_v4(), mi.id, 'Extra Spice ' || mi.rn, 10
FROM mi;

-- CUSTOMER PROFILES (5)
INSERT INTO customer_profiles (id, phone, name, consent_given)
SELECT uuid_generate_v4(), '9876500' || i, 'Customer ' || i, true
FROM generate_series(1,5) i;

-- TABLE SESSIONS (5)
WITH t AS (
  SELECT id, row_number() OVER () rn FROM tables ORDER BY id LIMIT 5
)
INSERT INTO table_sessions (id, table_id, status, started_at, ended_at)
SELECT uuid_generate_v4(), t.id, 'OPEN', now() - interval '10 minutes', NULL
FROM t;

-- CUSTOMERS (5)
WITH ts AS (
  SELECT id, row_number() OVER () rn FROM table_sessions ORDER BY started_at
), cp AS (
  SELECT id, phone, name, row_number() OVER () rn FROM customer_profiles ORDER BY id
)
INSERT INTO customers (id, session_id, customer_profile_id, name, phone, verified)
SELECT uuid_generate_v4(), ts.id, cp.id, cp.name, cp.phone, true
FROM ts JOIN cp ON ts.rn = cp.rn;

-- OTP REQUESTS (5)
WITH c AS (
  SELECT session_id, phone, row_number() OVER () rn FROM customers ORDER BY id
), s AS (
  SELECT id, row_number() OVER () rn FROM staff WHERE role = 'CAPTAIN' ORDER BY id
)
INSERT INTO otp_requests (id, session_id, customer_phone, otp_code, generated_by, expires_at, verified_at)
SELECT uuid_generate_v4(), c.session_id, c.phone, '123456', s.id, now() + interval '5 minutes', now()
FROM c JOIN s ON c.rn = s.rn;

-- ORDERS (5)
WITH c AS (
  SELECT id, session_id, row_number() OVER () rn FROM customers ORDER BY id
)
INSERT INTO orders (id, session_id, customer_id, status, total_amount)
SELECT uuid_generate_v4(), c.session_id, c.id, 'PLACED', 500 + (c.rn*50)
FROM c;

-- ORDER ITEMS (5)
WITH o AS (
  SELECT id, row_number() OVER () rn FROM orders ORDER BY id
), mi AS (
  SELECT id, base_price, row_number() OVER () rn FROM menu_items ORDER BY id
)
INSERT INTO order_items (id, order_id, menu_item_id, qty, price)
SELECT uuid_generate_v4(), o.id, mi.id, 1, mi.base_price
FROM o JOIN mi ON o.rn = mi.rn;

-- KOTS (5)
INSERT INTO kots (id, order_id, status)
SELECT uuid_generate_v4(), id, 'PLACED' FROM orders ORDER BY created_at LIMIT 5;

-- BILLS (5)
INSERT INTO bills (id, order_id, subtotal, tax, service_charge, total)
SELECT uuid_generate_v4(), id, total_amount, total_amount*0.05, total_amount*0.1, total_amount*1.15
FROM orders ORDER BY created_at LIMIT 5;

-- PAYMENTS (5)
INSERT INTO payments (id, bill_id, method, status, paid_at)
SELECT uuid_generate_v4(), b.id, 'CARD', 'PAID', now()
FROM bills b ORDER BY created_at LIMIT 5;

-- AI KNOWLEDGE BASE (5)
INSERT INTO ai_knowledge_base (id, restaurant_id, topic, content, is_active)
SELECT uuid_generate_v4(), r.id, 'General', 'Sample content', true
FROM restaurants r ORDER BY name LIMIT 5;

-- CUSTOMER PREFERENCES (5)
INSERT INTO customer_preferences (customer_profile_id, preference_type, value, confidence_score)
SELECT id, 'SPICE', 'MEDIUM', 0.75 FROM customer_profiles ORDER BY id LIMIT 5;

-- SUBSCRIPTION PLANS (5)
INSERT INTO subscription_plans (id, name, price, max_orders, max_ai_calls)
SELECT uuid_generate_v4(), 'Plan ' || i, 100*i, 100*i, 200*i
FROM generate_series(1,5) i;

-- RESTAURANT SUBSCRIPTIONS (5)
WITH p AS (
  SELECT id FROM subscription_plans ORDER BY name LIMIT 1
)
INSERT INTO restaurant_subscriptions (restaurant_id, plan_id, status, start_date, end_date)
SELECT r.id, p.id, 'ACTIVE', CURRENT_DATE - INTERVAL '5 days', CURRENT_DATE + INTERVAL '25 days'
FROM restaurants r, p
ORDER BY r.created_at
LIMIT 5;

-- SUBSCRIPTION USAGE (5)
INSERT INTO subscription_usage (restaurant_id, month, orders_count, ai_calls)
SELECT r.id, to_char(current_date, 'YYYY-MM'), 10, 5
FROM restaurants r ORDER BY name LIMIT 5;

-- WS CONNECTIONS (5)
INSERT INTO ws_connections (connection_id, branch_id, connected_at)
SELECT 'conn-' || row_number() OVER (), b.id, now()
FROM branches b ORDER BY b.name LIMIT 5;

-- AI INTERACTIONS (5)
WITH ts AS (
  SELECT id, row_number() OVER () rn FROM table_sessions ORDER BY started_at LIMIT 5
), mi AS (
  SELECT id, row_number() OVER () rn FROM menu_items ORDER BY id LIMIT 5
)
INSERT INTO ai_interactions (id, session_id, menu_item_id, question, intent, answer_source, ai_model)
SELECT uuid_generate_v4(), ts.id, mi.id, 'What is this?', 'info', 'kb', 'gpt-mini'
FROM ts JOIN mi ON ts.rn = mi.rn;

-- AI RECOMMENDATION CONTEXT (5)
INSERT INTO ai_recommendation_context (customer_profile_id, restaurant_id, summary)
SELECT cp.id, r.id, '{"notes":"sample"}'::jsonb
FROM customer_profiles cp
JOIN restaurants r ON true
ORDER BY cp.id, r.name
LIMIT 5;
