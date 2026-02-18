-- v2: make ensure_user_role also ensure the company linkage for company-account signups.
-- This fixes cases where the signup trigger/migrations were missing at the time of signup,
-- causing users to log in but see "create company" again.

CREATE OR REPLACE FUNCTION public.ensure_user_role()
RETURNS public.app_role[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid;
  _roles public.app_role[];
  _company_id uuid;
  _tech_company_id uuid;
  _tech_id uuid;
  _meta jsonb;
  _company_name text;
  _industry text;
  _team_size text;
BEGIN
  _uid := auth.uid();
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  -- Ensure profile exists (some older DBs didn't have a reliable trigger).
  INSERT INTO public.profiles (user_id, full_name, email)
  VALUES (_uid, '', NULLIF(auth.jwt() ->> 'email', ''))
  ON CONFLICT (user_id) DO NOTHING;

  -- If roles already exist, return them.
  SELECT array_agg(role ORDER BY role) INTO _roles
  FROM public.user_roles
  WHERE user_id = _uid;

  IF COALESCE(array_length(_roles, 1), 0) > 0 THEN
    RETURN _roles;
  END IF;

  -- 1) Technician association (trusted via technicians table).
  SELECT id, company_id INTO _tech_id, _tech_company_id
  FROM public.technicians
  WHERE user_id = _uid
  LIMIT 1;

  IF _tech_id IS NOT NULL THEN
    IF _tech_company_id IS NOT NULL THEN
      UPDATE public.profiles
      SET company_id = _tech_company_id
      WHERE user_id = _uid;
    END IF;

    INSERT INTO public.user_roles (user_id, role)
    VALUES (_uid, 'technician')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  -- 2) Company-account signup recovery:
  -- If the user has company_name metadata but isn't linked yet, create/link the company now.
  SELECT company_id INTO _company_id
  FROM public.profiles
  WHERE user_id = _uid
  LIMIT 1;

  IF _company_id IS NULL THEN
    _meta := auth.jwt() -> 'user_metadata';
    _company_name := NULLIF(_meta ->> 'company_name', '');
    _industry := NULLIF(_meta ->> 'industry', '');
    _team_size := NULLIF(_meta ->> 'team_size', '');

    IF _company_name IS NOT NULL THEN
      INSERT INTO public.companies (name, industry, team_size)
      VALUES (_company_name, COALESCE(_industry, 'general'), _team_size)
      RETURNING id INTO _company_id;

      UPDATE public.profiles
      SET company_id = _company_id
      WHERE user_id = _uid;
    END IF;
  END IF;

  -- If a company is now linked, treat user as admin (and keep owner for legacy RLS checks).
  IF _company_id IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (_uid, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;

    INSERT INTO public.user_roles (user_id, role)
    VALUES (_uid, 'owner')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  SELECT array_agg(role ORDER BY role) INTO _roles
  FROM public.user_roles
  WHERE user_id = _uid;

  RETURN COALESCE(_roles, ARRAY[]::public.app_role[]);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.ensure_user_role() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_user_role() TO authenticated;

