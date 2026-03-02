
-- Add public_key to companies
ALTER TABLE public.companies
ADD COLUMN IF NOT EXISTS public_key text UNIQUE;

-- Generate public keys for existing companies
UPDATE public.companies
SET public_key = 'cmp_' || replace(id::text, '-', '')
WHERE public_key IS NULL;

-- Make it NOT NULL after backfill
ALTER TABLE public.companies ALTER COLUMN public_key SET NOT NULL;
ALTER TABLE public.companies ALTER COLUMN public_key SET DEFAULT 'cmp_' || replace(gen_random_uuid()::text, '-', '');

-- Widget installations table
CREATE TABLE public.widget_installations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  allowed_domains text[] NOT NULL DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT true,
  config jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.widget_installations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company users can view widget installations"
  ON public.widget_installations FOR SELECT
  USING (company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Company users can create widget installations"
  ON public.widget_installations FOR INSERT
  WITH CHECK (company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Company users can update widget installations"
  ON public.widget_installations FOR UPDATE
  USING (company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Company users can delete widget installations"
  ON public.widget_installations FOR DELETE
  USING (company_id = get_user_company_id(auth.uid()));

-- Quote requests table
CREATE TABLE public.quote_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  widget_installation_id uuid REFERENCES public.widget_installations(id) ON DELETE SET NULL,
  name text NOT NULL,
  email text NOT NULL,
  phone text,
  trade text,
  address text,
  message text,
  status text NOT NULL DEFAULT 'new',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.quote_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company users can view quote requests"
  ON public.quote_requests FOR SELECT
  USING (company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Company users can update quote requests"
  ON public.quote_requests FOR UPDATE
  USING (company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Company users can delete quote requests"
  ON public.quote_requests FOR DELETE
  USING (company_id = get_user_company_id(auth.uid()));

-- Triggers for updated_at
CREATE TRIGGER set_widget_installations_updated_at
  BEFORE UPDATE ON public.widget_installations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_quote_requests_updated_at
  BEFORE UPDATE ON public.quote_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
