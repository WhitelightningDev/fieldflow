
-- Add cost/revenue columns to support profitability tracking

ALTER TABLE public.job_cards
ADD COLUMN revenue_cents integer DEFAULT 0;

ALTER TABLE public.inventory_items
ADD COLUMN unit_cost_cents integer DEFAULT 0;

ALTER TABLE public.technicians
ADD COLUMN hourly_cost_cents integer DEFAULT 0,
ADD COLUMN hourly_bill_rate_cents integer DEFAULT 0;

ALTER TABLE public.site_team_assignments
ADD COLUMN ends_at timestamp with time zone DEFAULT NULL;
