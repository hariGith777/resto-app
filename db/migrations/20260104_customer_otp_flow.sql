-- Migration: add tables for customer OTP-based session flow
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS table_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id text NOT NULL,
  branch_id uuid,
  started_at timestamptz DEFAULT now(),
  ended_at timestamptz,
  metadata jsonb
);

CREATE TABLE IF NOT EXISTS customer_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text UNIQUE NOT NULL,
  name text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid REFERENCES customer_profiles(id),
  session_id uuid REFERENCES table_sessions(id),
  name text,
  phone text,
  verified boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS otp_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES table_sessions(id),
  customer_phone text NOT NULL,
  otp_hash text NOT NULL,
  salt text NOT NULL,
  staff_id uuid,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz NOT NULL,
  verified_at timestamptz,
  attempts int DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_otp_requests_session_phone ON otp_requests(session_id, customer_phone);
