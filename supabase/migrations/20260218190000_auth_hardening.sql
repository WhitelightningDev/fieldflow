-- Harden auth association so users cannot self-associate as staff/admin/tech.
-- Goal: an authenticated user must already have an assigned role (technician/admin/office_staff/owner)
-- to reach app routes, and must not be able to grant themselves roles or attach themselves to a company.

-- 1) Lock down user_roles so end users cannot insert/update/delete roles.
DROP POLICY IF EXISTS "Users can insert own roles" ON public.user_roles;

REVOKE INSERT, UPDATE, DELETE ON TABLE public.user_roles FROM authenticated;
GRANT SELECT ON TABLE public.user_roles TO authenticated;

-- 2) Prevent end users from changing their company association.
-- (Company linking must happen via SECURITY DEFINER functions/triggers or service-role tooling.)
REVOKE UPDATE (company_id) ON TABLE public.profiles FROM authenticated;
REVOKE UPDATE (user_id) ON TABLE public.profiles FROM authenticated;

-- Prevent end users from (re)inserting a profile with an arbitrary company_id.
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
REVOKE INSERT ON TABLE public.profiles FROM authenticated;

-- 3) Disable the client-callable bootstrap RPC. This was intended as a recovery helper, but it
-- can be abused for privilege/company creation when combined with user-managed metadata.
REVOKE EXECUTE ON FUNCTION public.bootstrap_company_from_user_metadata() FROM authenticated;

-- 4) Require an existing privileged role to create a company via RPC (prevents "sign up → call RPC → become owner").
CREATE OR REPLACE FUNCTION public.create_company_for_current_user(
  _name TEXT,
  _industry TEXT,
  _team_size TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid UUID;
  _company_id UUID;
BEGIN
  _uid := auth.uid();
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  -- Only existing owners/admins can create a company via this RPC.
  IF NOT (public.has_role(_uid, 'owner') OR public.has_role(_uid, 'admin')) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  -- Ensure profile exists
  INSERT INTO public.profiles (user_id, full_name, email)
  VALUES (_uid, '', NULLIF(auth.jwt() ->> 'email', ''))
  ON CONFLICT (user_id) DO NOTHING;

  -- If already linked, return existing company
  SELECT company_id INTO _company_id
  FROM public.profiles
  WHERE user_id = _uid
  LIMIT 1;

  IF _company_id IS NOT NULL THEN
    RETURN _company_id;
  END IF;

  -- Create company
  INSERT INTO public.companies (name, industry, team_size)
  VALUES (
    NULLIF(TRIM(_name), ''),
    COALESCE(NULLIF(TRIM(_industry), ''), 'general'),
    NULLIF(TRIM(_team_size), '')
  )
  RETURNING id INTO _company_id;

  IF _company_id IS NULL THEN
    RAISE EXCEPTION 'failed to create company';
  END IF;

  -- Link profile
  UPDATE public.profiles
  SET company_id = _company_id
  WHERE user_id = _uid;

  -- Ensure owner role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (_uid, 'owner')
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN _company_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_company_for_current_user(TEXT, TEXT, TEXT) TO authenticated;

-- 5) Stop trusting user-provided metadata for role/company assignment on signup.
-- Only:
-- - creates a profile
-- - links a technician record by matching email (and assigns technician role)
-- - optionally creates a company for owner signups (role is always 'owner')
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  _company_id uuid;
BEGIN
  -- Create profile (or update if already present).
  INSERT INTO public.profiles (user_id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.email
  )
  ON CONFLICT (user_id) DO UPDATE SET
    full_name = COALESCE(EXCLUDED.full_name, profiles.full_name),
    email = COALESCE(EXCLUDED.email, profiles.email);

  -- Link any unlinked technician record by email and assign technician role.
  UPDATE public.technicians
  SET user_id = NEW.id, invite_status = 'accepted'
  WHERE email = NEW.email AND user_id IS NULL;

  SELECT company_id INTO _company_id
  FROM public.technicians
  WHERE user_id = NEW.id
  LIMIT 1;

  IF _company_id IS NOT NULL THEN
    UPDATE public.profiles
    SET company_id = _company_id
    WHERE user_id = NEW.id;

    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'technician')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  -- Optional owner signup flow (always assigns 'owner').
  IF NEW.raw_user_meta_data->>'company_name' IS NOT NULL THEN
    INSERT INTO public.companies (name, industry, team_size)
    VALUES (
      NEW.raw_user_meta_data->>'company_name',
      NEW.raw_user_meta_data->>'industry',
      NEW.raw_user_meta_data->>'team_size'
    )
    RETURNING id INTO _company_id;

    UPDATE public.profiles
    SET company_id = _company_id
    WHERE user_id = NEW.id;

    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;

    -- Keep owner for legacy RLS checks, but treat company creators as admins.
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'owner')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Ensure the auth.users trigger exists (some environments may be missing it).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger t
    WHERE t.tgname = 'on_auth_user_created'
  ) THEN
    EXECUTE 'CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user()';
  END IF;
END $$;
