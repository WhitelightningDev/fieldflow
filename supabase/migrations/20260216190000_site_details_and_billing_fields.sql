-- Add richer site details for site-level control + invoicing workflows
-- (safe to run multiple times)

ALTER TABLE public.sites
ADD COLUMN IF NOT EXISTS code TEXT,
ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS scope_of_work TEXT,
ADD COLUMN IF NOT EXISTS billing_reference TEXT,
ADD COLUMN IF NOT EXISTS contact_name TEXT,
ADD COLUMN IF NOT EXISTS contact_phone TEXT,
ADD COLUMN IF NOT EXISTS contact_email TEXT,
ADD COLUMN IF NOT EXISTS gps_lat DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS gps_lng DOUBLE PRECISION;

