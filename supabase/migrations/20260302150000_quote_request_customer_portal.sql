-- Customer quote-tracking portal: consented requester accounts + portal listing.

-- 1) Add new role to app_role enum
DO $$
BEGIN
  ALTER TYPE public.app_role ADD VALUE 'customer';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 2) Extend quote_requests with requester linkage + consent + invite audit
ALTER TABLE public.quote_requests
  ADD COLUMN IF NOT EXISTS profile_consent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS profile_consent_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS requester_user_id uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS portal_invited_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS portal_invited_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS quote_requests_requester_user_id_idx
  ON public.quote_requests (requester_user_id);

CREATE INDEX IF NOT EXISTS quote_requests_email_lower_idx
  ON public.quote_requests (lower(email));

-- 3) RLS: allow requesters to view their own quote requests
DROP POLICY IF EXISTS "Requesters can view own quote requests" ON public.quote_requests;
CREATE POLICY "Requesters can view own quote requests"
  ON public.quote_requests FOR SELECT
  TO authenticated
  USING (requester_user_id = auth.uid());

-- 4) Portal RPC: list quote requests for the authenticated requester
CREATE OR REPLACE FUNCTION public.get_my_quote_requests()
RETURNS TABLE (
  id uuid,
  company_name text,
  company_logo_url text,
  trade text,
  message text,
  status text,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    qr.id,
    c.name AS company_name,
    c.logo_url AS company_logo_url,
    qr.trade,
    qr.message,
    qr.status,
    qr.created_at
  FROM public.quote_requests qr
  JOIN public.companies c ON c.id = qr.company_id
  WHERE qr.requester_user_id = auth.uid()
  ORDER BY qr.created_at DESC;
$$;

REVOKE EXECUTE ON FUNCTION public.get_my_quote_requests() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_quote_requests() TO authenticated;

