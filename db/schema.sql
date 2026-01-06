-- =========================
-- EXTENSIONS
-- =========================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =========================
-- RESTAURANTS & STRUCTURE
-- =========================

CREATE TABLE restaurants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  logo_url TEXT,
  primary_color VARCHAR(10),
  secondary_color VARCHAR(10),
  status VARCHAR(20) DEFAULT 'ACTIVE',
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

CREATE TABLE branches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id),
  name TEXT NOT NULL,
  address TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE areas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id UUID NOT NULL REFERENCES branches(id),
  name TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE tables (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  area_id UUID NOT NULL REFERENCES areas(id),
  table_number VARCHAR(10) NOT NULL,
  capacity INT,
  qr_code TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT now()
);

-- =========================
-- STAFF & ROLES
-- -------------------------
-- Staff represents both platform-level users (SUPER_ADMIN) and
-- branch-level users (RESTAURANT_ADMIN, CAPTAIN, KITCHEN). `username`
-- is optional for legacy seed data but preferred for login mapping.
-- `branch_id` is NULL for SUPER_ADMIN users.
-- =========================

CREATE TABLE IF NOT EXISTS staff (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id UUID REFERENCES branches(id),
  name TEXT NOT NULL,
  username VARCHAR(100),
  role VARCHAR(30) NOT NULL CHECK (
    role IN ('SUPER_ADMIN','RESTAURANT_ADMIN','CAPTAIN','KITCHEN')
  ),
  phone VARCHAR(15),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT now()
);

-- =========================
-- SESSION & CUSTOMER AUTH
-- =========================

CREATE TABLE table_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  table_id UUID NOT NULL REFERENCES tables(id),
  status VARCHAR(20) DEFAULT 'OPEN',
  started_at TIMESTAMP DEFAULT now(),
  ended_at TIMESTAMP
);

CREATE TABLE customer_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  phone VARCHAR(15) UNIQUE NOT NULL,
  name TEXT,
  consent_given BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT now(),
  last_active_at TIMESTAMP
);

CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES table_sessions(id),
  customer_profile_id UUID REFERENCES customer_profiles(id),
  name TEXT,
  phone VARCHAR(15),
  verified BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE otp_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES table_sessions(id),
  customer_phone VARCHAR(15) NOT NULL,
  otp_code VARCHAR(10) NOT NULL,
  generated_by UUID NOT NULL REFERENCES staff(id),
  expires_at TIMESTAMP NOT NULL,
  verified_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT now()
);

-- =========================
-- MENU CONFIGURATION
-- =========================

CREATE TABLE menu_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id UUID NOT NULL REFERENCES branches(id),
  name TEXT NOT NULL,
  display_order INT,
  is_active BOOLEAN DEFAULT true
);

CREATE TABLE menu_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category_id UUID NOT NULL REFERENCES menu_categories(id),
  name TEXT NOT NULL,
  description TEXT,
  base_price NUMERIC(10,2) NOT NULL,
  is_veg BOOLEAN,
  spice_level VARCHAR(20),
  allergens JSONB,
  is_available BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE menu_portions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  menu_item_id UUID NOT NULL REFERENCES menu_items(id),
  label VARCHAR(50),
  price NUMERIC(10,2)
);

CREATE TABLE menu_modifiers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  menu_item_id UUID NOT NULL REFERENCES menu_items(id),
  name TEXT,
  price_delta NUMERIC(10,2)
);

-- =========================
-- ORDERS & KOT
-- =========================

-- Orders: `customer_id` is nullable because some flows may create
-- an order tied to a session before a customer profile is attached.
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES table_sessions(id),
  customer_id UUID REFERENCES customers(id),
  status VARCHAR(30) NOT NULL,
  total_amount NUMERIC(10,2),
  created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders(id),
  menu_item_id UUID NOT NULL REFERENCES menu_items(id),
  portion_id UUID REFERENCES menu_portions(id),
  qty INT NOT NULL,
  price NUMERIC(10,2) NOT NULL
);

CREATE TABLE kots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders(id),
  status VARCHAR(20) DEFAULT 'SENT',
  created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE ws_connections (
  connection_id TEXT PRIMARY KEY,
  branch_id UUID NOT NULL REFERENCES branches(id),
  connected_at TIMESTAMP DEFAULT now()
);

-- =========================
-- BILLING & PAYMENTS
-- =========================

CREATE TABLE bills (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders(id),
  subtotal NUMERIC(10,2),
  tax NUMERIC(10,2),
  service_charge NUMERIC(10,2),
  total NUMERIC(10,2),
  created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bill_id UUID NOT NULL REFERENCES bills(id),
  method VARCHAR(20),
  status VARCHAR(20),
  gateway_ref TEXT,
  paid_at TIMESTAMP
);

-- =========================
-- AI & PERSONALIZATION
-- =========================

-- AI Knowledge Base: restaurant-scoped knowledge used by chat/voice
CREATE TABLE IF NOT EXISTS ai_knowledge_base (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id),
  topic TEXT NOT NULL,
  content TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE ai_interactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID REFERENCES table_sessions(id),
  menu_item_id UUID REFERENCES menu_items(id),
  question TEXT,
  intent VARCHAR(50),
  answer_source VARCHAR(20),
  ai_model VARCHAR(50),
  created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE customer_preferences (
  customer_profile_id UUID NOT NULL REFERENCES customer_profiles(id),
  preference_type VARCHAR(50),
  value VARCHAR(50),
  confidence_score FLOAT,
  updated_at TIMESTAMP DEFAULT now(),
  PRIMARY KEY (customer_profile_id, preference_type, value)
);

CREATE TABLE ai_recommendation_context (
  customer_profile_id UUID NOT NULL REFERENCES customer_profiles(id),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id),
  summary JSONB,
  updated_at TIMESTAMP DEFAULT now(),
  PRIMARY KEY (customer_profile_id, restaurant_id)
);

-- =========================
-- SUBSCRIPTIONS (SAAS)
-- =========================

CREATE TABLE subscription_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  price NUMERIC(10,2),
  max_orders INT,
  max_ai_calls INT,
  is_active BOOLEAN DEFAULT true
);

CREATE TABLE plan_features (
  plan_id UUID NOT NULL REFERENCES subscription_plans(id),
  feature_code VARCHAR(50),
  enabled BOOLEAN,
  PRIMARY KEY (plan_id, feature_code)
);

CREATE TABLE restaurant_subscriptions (
  restaurant_id UUID PRIMARY KEY REFERENCES restaurants(id),
  plan_id UUID NOT NULL REFERENCES subscription_plans(id),
  status VARCHAR(20),
  start_date DATE,
  end_date DATE,
  grace_until DATE
);

CREATE TABLE subscription_usage (
  restaurant_id UUID NOT NULL REFERENCES restaurants(id),
  month VARCHAR(7),
  orders_count INT DEFAULT 0,
  ai_calls INT DEFAULT 0,
  PRIMARY KEY (restaurant_id, month)
);
