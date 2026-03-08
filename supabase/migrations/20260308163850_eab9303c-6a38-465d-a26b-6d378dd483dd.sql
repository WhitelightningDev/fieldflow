
-- Add requires_power flag to job_cards with trade-based default
ALTER TABLE public.job_cards ADD COLUMN IF NOT EXISTS requires_power boolean NOT NULL DEFAULT false;

-- Create company load shedding configuration table
CREATE TABLE IF NOT EXISTS public.company_loadshedding_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  area_id text NOT NULL,
  area_name text NOT NULL,
  region text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id)
);

ALTER TABLE public.company_loadshedding_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company users can view loadshedding config"
  ON public.company_loadshedding_config FOR SELECT TO authenticated
  USING (company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Company users can insert loadshedding config"
  ON public.company_loadshedding_config FOR INSERT TO authenticated
  WITH CHECK (company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Company users can update loadshedding config"
  ON public.company_loadshedding_config FOR UPDATE TO authenticated
  USING (company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Company users can delete loadshedding config"
  ON public.company_loadshedding_config FOR DELETE TO authenticated
  USING (company_id = get_user_company_id(auth.uid()));
