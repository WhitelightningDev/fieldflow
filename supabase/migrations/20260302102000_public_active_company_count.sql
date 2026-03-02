-- Public-facing metric for the marketing hero: active company count.
-- Exposes only an aggregate number (no row data).

CREATE OR REPLACE FUNCTION public.get_active_company_count()
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::bigint
  FROM public.companies c
  WHERE
    c.subscription_status IN ('active', 'paid')
    OR (
      c.subscription_status = 'trialing'
      AND c.trial_ends_at::timestamptz > NOW()
    );
$$;

REVOKE EXECUTE ON FUNCTION public.get_active_company_count() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_active_company_count() TO anon;
GRANT EXECUTE ON FUNCTION public.get_active_company_count() TO authenticated;

