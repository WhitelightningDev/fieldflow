
-- Add trial tracking columns to companies
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS trial_started_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  ADD COLUMN IF NOT EXISTS subscription_status text NOT NULL DEFAULT 'trialing';

-- Backfill existing companies: start their trial from now
UPDATE public.companies
SET trial_started_at = now(),
    trial_ends_at = now() + interval '14 days',
    subscription_status = 'trialing'
WHERE subscription_status = 'trialing';
