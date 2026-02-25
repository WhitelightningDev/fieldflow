
-- Add subscription_tier column to companies
ALTER TABLE public.companies 
ADD COLUMN IF NOT EXISTS subscription_tier text NOT NULL DEFAULT 'starter';

-- Add per_tech_price_cents for tracking per-technician billing
ALTER TABLE public.companies 
ADD COLUMN IF NOT EXISTS per_tech_price_cents integer NOT NULL DEFAULT 14900;

-- Add included_techs for the plan's included technician count
ALTER TABLE public.companies 
ADD COLUMN IF NOT EXISTS included_techs integer NOT NULL DEFAULT 1;
