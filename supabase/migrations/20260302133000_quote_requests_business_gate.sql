-- Gate quote requests behind Business tier + valid subscription status.
-- Enforced in:
-- - RLS policies for quote-related tables
-- - Token/RPC helpers for QR links
-- - Public resolver for QR form branding

CREATE OR REPLACE FUNCTION public.can_use_quote_requests()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.companies c
    WHERE c.id = public.get_user_company_id(auth.uid())
      AND c.subscription_tier = 'business'
      AND (
        c.subscription_status IN ('active', 'paid')
        OR (
          c.subscription_status = 'trialing'
          AND c.trial_ends_at::timestamptz > now()
        )
      )
  );
$$;

REVOKE EXECUTE ON FUNCTION public.can_use_quote_requests() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_use_quote_requests() TO authenticated;

-- Tighten widget_installations policies
DROP POLICY IF EXISTS "Company users can view widget installations" ON public.widget_installations;
DROP POLICY IF EXISTS "Company users can create widget installations" ON public.widget_installations;
DROP POLICY IF EXISTS "Company users can update widget installations" ON public.widget_installations;
DROP POLICY IF EXISTS "Company users can delete widget installations" ON public.widget_installations;

CREATE POLICY "Company users can view widget installations"
  ON public.widget_installations FOR SELECT
  USING (company_id = get_user_company_id(auth.uid()) AND public.can_use_quote_requests());

CREATE POLICY "Company users can create widget installations"
  ON public.widget_installations FOR INSERT
  WITH CHECK (company_id = get_user_company_id(auth.uid()) AND public.can_use_quote_requests());

CREATE POLICY "Company users can update widget installations"
  ON public.widget_installations FOR UPDATE
  USING (company_id = get_user_company_id(auth.uid()) AND public.can_use_quote_requests());

CREATE POLICY "Company users can delete widget installations"
  ON public.widget_installations FOR DELETE
  USING (company_id = get_user_company_id(auth.uid()) AND public.can_use_quote_requests());

-- Tighten quote_requests policies (dashboard access)
DROP POLICY IF EXISTS "Company users can view quote requests" ON public.quote_requests;
DROP POLICY IF EXISTS "Company users can update quote requests" ON public.quote_requests;
DROP POLICY IF EXISTS "Company users can delete quote requests" ON public.quote_requests;

CREATE POLICY "Company users can view quote requests"
  ON public.quote_requests FOR SELECT
  USING (company_id = get_user_company_id(auth.uid()) AND public.can_use_quote_requests());

CREATE POLICY "Company users can update quote requests"
  ON public.quote_requests FOR UPDATE
  USING (company_id = get_user_company_id(auth.uid()) AND public.can_use_quote_requests());

CREATE POLICY "Company users can delete quote requests"
  ON public.quote_requests FOR DELETE
  USING (company_id = get_user_company_id(auth.uid()) AND public.can_use_quote_requests());

-- Tighten quote_links policies (token management)
DROP POLICY IF EXISTS "Company users can view quote links" ON public.quote_links;
DROP POLICY IF EXISTS "Company users can create quote links" ON public.quote_links;
DROP POLICY IF EXISTS "Company users can update quote links" ON public.quote_links;
DROP POLICY IF EXISTS "Company users can delete quote links" ON public.quote_links;

CREATE POLICY "Company users can view quote links"
  ON public.quote_links FOR SELECT
  USING (company_id = get_user_company_id(auth.uid()) AND public.can_use_quote_requests());

CREATE POLICY "Company users can create quote links"
  ON public.quote_links FOR INSERT
  WITH CHECK (company_id = get_user_company_id(auth.uid()) AND public.can_use_quote_requests());

CREATE POLICY "Company users can update quote links"
  ON public.quote_links FOR UPDATE
  USING (company_id = get_user_company_id(auth.uid()) AND public.can_use_quote_requests());

CREATE POLICY "Company users can delete quote links"
  ON public.quote_links FOR DELETE
  USING (company_id = get_user_company_id(auth.uid()) AND public.can_use_quote_requests());

-- Guard QR token RPCs
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

  IF NOT public.can_use_quote_requests() THEN
    RAISE EXCEPTION 'business plan required';
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

  IF NOT public.can_use_quote_requests() THEN
    RAISE EXCEPTION 'business plan required';
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
-- Must also enforce that the company is currently eligible to receive quote requests.
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
  WHERE ql.token = _token
    AND ql.is_active = true
    AND c.subscription_tier = 'business'
    AND (
      c.subscription_status IN ('active', 'paid')
      OR (
        c.subscription_status = 'trialing'
        AND c.trial_ends_at::timestamptz > now()
      )
    )
  LIMIT 1;
$$;

REVOKE EXECUTE ON FUNCTION public.resolve_quote_link(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_quote_link(text) TO anon;
GRANT EXECUTE ON FUNCTION public.resolve_quote_link(text) TO authenticated;

