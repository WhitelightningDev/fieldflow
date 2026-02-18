-- Company finance settings for dispatch/invoicing workflow
-- - Callout fee included up to a radius
-- - Labour overhead percent for internal cost-to-company calculations

ALTER TABLE public.companies
ADD COLUMN IF NOT EXISTS callout_fee_cents integer NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS callout_radius_km integer NOT NULL DEFAULT 50,
ADD COLUMN IF NOT EXISTS labour_overhead_percent numeric NOT NULL DEFAULT 15;

CREATE INDEX IF NOT EXISTS companies_callout_fee_cents_idx ON public.companies(callout_fee_cents);

