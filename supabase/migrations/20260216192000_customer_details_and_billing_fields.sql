-- Add richer customer details for billing + operational workflows
-- (safe to run multiple times)

ALTER TABLE public.customers
ADD COLUMN IF NOT EXISTS code TEXT,
ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS vat_number TEXT,
ADD COLUMN IF NOT EXISTS billing_reference TEXT,
ADD COLUMN IF NOT EXISTS billing_email TEXT,
ADD COLUMN IF NOT EXISTS billing_phone TEXT,
ADD COLUMN IF NOT EXISTS payment_terms TEXT;

