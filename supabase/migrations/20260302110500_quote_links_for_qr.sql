-- Public quote-request links for QR codes.
-- These are intended to be shared publicly (e.g. printed on invoices/vehicles).
-- The token is opaque and can be rotated/disabled by the company.

CREATE TABLE IF NOT EXISTS public.quote_links (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE DEFAULT ('ql_' || replace(gen_random_uuid()::text, '-', '')),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id)
);

ALTER TABLE public.quote_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company users can view quote links"
  ON public.quote_links FOR SELECT
  USING (company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Company users can create quote links"
  ON public.quote_links FOR INSERT
  WITH CHECK (company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Company users can update quote links"
  ON public.quote_links FOR UPDATE
  USING (company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Company users can delete quote links"
  ON public.quote_links FOR DELETE
  USING (company_id = get_user_company_id(auth.uid()));

DROP TRIGGER IF EXISTS set_quote_links_updated_at ON public.quote_links;
CREATE TRIGGER set_quote_links_updated_at
  BEFORE UPDATE ON public.quote_links
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Authenticated helper: return a token for the current user's company, creating one if needed.
CREATE OR REPLACE FUNCTION public.get_or_create_quote_link_token()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid;
  _company_id uuid;
  _token text;
BEGIN
  _uid := auth.uid();
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  _company_id := public.get_user_company_id(_uid);
  IF _company_id IS NULL THEN
    RAISE EXCEPTION 'no company';
  END IF;

  SELECT token INTO _token
  FROM public.quote_links
  WHERE company_id = _company_id AND is_active = true
  LIMIT 1;

  IF _token IS NOT NULL THEN
    RETURN _token;
  END IF;

  INSERT INTO public.quote_links (company_id, is_active)
  VALUES (_company_id, true)
  ON CONFLICT (company_id) DO UPDATE SET
    is_active = true
  RETURNING token INTO _token;

  RETURN _token;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_or_create_quote_link_token() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_or_create_quote_link_token() TO authenticated;

-- Authenticated helper: rotate (regenerate) the token for the current user's company.
CREATE OR REPLACE FUNCTION public.rotate_quote_link_token()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid;
  _company_id uuid;
  _token text;
BEGIN
  _uid := auth.uid();
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  _company_id := public.get_user_company_id(_uid);
  IF _company_id IS NULL THEN
    RAISE EXCEPTION 'no company';
  END IF;

  UPDATE public.quote_links
  SET token = ('ql_' || replace(gen_random_uuid()::text, '-', '')),
      is_active = true
  WHERE company_id = _company_id
  RETURNING token INTO _token;

  IF _token IS NOT NULL THEN
    RETURN _token;
  END IF;

  INSERT INTO public.quote_links (company_id, is_active)
  VALUES (_company_id, true)
  RETURNING token INTO _token;

  RETURN _token;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.rotate_quote_link_token() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rotate_quote_link_token() TO authenticated;

-- Public resolver for the QR page: return display-only company info for a token.
CREATE OR REPLACE FUNCTION public.resolve_quote_link(_token text)
RETURNS TABLE (
  company_name text,
  company_logo_url text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.name, c.logo_url
  FROM public.quote_links ql
  JOIN public.companies c ON c.id = ql.company_id
  WHERE ql.token = _token AND ql.is_active = true
  LIMIT 1;
$$;

REVOKE EXECUTE ON FUNCTION public.resolve_quote_link(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_quote_link(text) TO anon;
GRANT EXECUTE ON FUNCTION public.resolve_quote_link(text) TO authenticated;

