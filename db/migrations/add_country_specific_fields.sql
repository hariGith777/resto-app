-- Add country-specific and timezone fields to branches table

ALTER TABLE branches 
ADD COLUMN IF NOT EXISTS timezone VARCHAR(50) DEFAULT 'Asia/Kolkata',
ADD COLUMN IF NOT EXISTS date_format VARCHAR(20) DEFAULT 'DD/MM/YYYY',
ADD COLUMN IF NOT EXISTS time_format VARCHAR(10) DEFAULT '12h',
ADD COLUMN IF NOT EXISTS language VARCHAR(10) DEFAULT 'en',
ADD COLUMN IF NOT EXISTS phone_country_code VARCHAR(5) DEFAULT '+91',
ADD COLUMN IF NOT EXISTS tax_rate DECIMAL(5,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS service_charge_rate DECIMAL(5,2) DEFAULT 0.00;

-- Update existing branches with default values based on their country
UPDATE branches 
SET 
  timezone = CASE 
    WHEN country = 'India' THEN 'Asia/Kolkata'
    WHEN country = 'USA' THEN 'America/New_York'
    WHEN country = 'UK' THEN 'Europe/London'
    WHEN country = 'UAE' THEN 'Asia/Dubai'
    ELSE 'UTC'
  END,
  date_format = CASE
    WHEN country IN ('USA') THEN 'MM/DD/YYYY'
    ELSE 'DD/MM/YYYY'
  END,
  time_format = CASE
    WHEN country IN ('USA') THEN '12h'
    ELSE '24h'
  END,
  phone_country_code = CASE
    WHEN country = 'India' THEN '+91'
    WHEN country = 'USA' THEN '+1'
    WHEN country = 'UK' THEN '+44'
    WHEN country = 'UAE' THEN '+971'
    ELSE '+1'
  END
WHERE timezone IS NULL;
