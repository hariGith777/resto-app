TRUNCATE TABLE
  payments,
  bills,
  order_items,
  kots,
  orders,
  customers,
  otp_requests,
  table_sessions,
  customer_preferences,
  ai_knowledge_base,
  menu_portions,
  menu_items,
  menu_categories,
  staff,
  areas,
  tables,
  branches,
  restaurants,
  subscription_usage,
  restaurant_subscriptions,
  plan_features,
  subscription_plans,
  customer_profiles
RESTART IDENTITY CASCADE;

-- Note:
-- `reset.sql` truncates application data for local testing. It preserves
-- schema and extensions. Use with caution as this removes ALL seeded data.
