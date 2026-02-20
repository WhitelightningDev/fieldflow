-- Fix ghost company resurrection + orphaned company references.
--
-- Bug 1: ensure_user_role could recreate a deleted company from stale JWT user_metadata
--        (company_name/industry/team_size baked into tokens at signup and never cleared).
-- Bug 2: orphaned profiles.company_id (pointing to a deleted company) blocked creating a new company.
--
-- Fixes:
--  - ensure_user_role: do not create companies when roles already exist; clear orphaned company_id refs;
--    only create from metadata when truly unlinked; return early for technicians.
--  - create_company_for_current_user: clear orphaned company_id refs before deciding; clear auth metadata after creation.
--  - can_create_company: treat orphaned company_id as "can create".
--  - handle_new_user: clear company-related auth metadata after using it to create a company.

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

  -- Clear orphaned company reference (company deleted externally).
  SELECT company_id INTO _company_id
  FROM public.profiles
  WHERE user_id = _uid
  LIMIT 1;

  IF _company_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.companies WHERE id = _company_id) THEN
    UPDATE public.profiles SET company_id = NULL WHERE user_id = _uid;
    _company_id := NULL;
  END IF;

  -- If roles already exist, return them immediately — do NOT attempt any company creation.
  SELECT array_agg(role ORDER BY role) INTO _roles
  FROM public.user_roles
  WHERE user_id = _uid;

  IF COALESCE(array_length(_roles, 1), 0) > 0 THEN
    -- Best-effort: clear stale company metadata so it can't resurrect later.
    BEGIN
      UPDATE auth.users
      SET raw_user_meta_data = raw_user_meta_data - 'company_name' - 'industry' - 'team_size'
      WHERE id = _uid;
    EXCEPTION WHEN others THEN
      -- ignore
    END;

    RETURN _roles;
  END IF;

  -- ── Technician association (trusted via technicians table) ──────────────
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

    SELECT array_agg(role ORDER BY role) INTO _roles
    FROM public.user_roles
    WHERE user_id = _uid;

    RETURN COALESCE(_roles, ARRAY[]::public.app_role[]);
  END IF;

  -- ── Company-account signup recovery (ONLY when profile has no company) ──
  -- IMPORTANT: Only use JWT metadata to create a company when:
  --   1. The user has NO company linked in their profile (or the link was orphaned and cleared), AND
  --   2. The user has NO roles yet.
  -- This prevents "ghost" companies from stale signup metadata once roles exist.
  IF _company_id IS NULL THEN
    _meta := auth.jwt() -> 'user_metadata';
    _company_name := NULLIF(_meta ->> 'company_name', '');
    _industry := NULLIF(_meta ->> 'industry', '');
    _team_size := NULLIF(_meta ->> 'team_size', '');

    IF _company_name IS NOT NULL THEN
      -- Double-check a company wasn't just linked by a concurrent request.
      SELECT company_id INTO _company_id
      FROM public.profiles
      WHERE user_id = _uid
      LIMIT 1;

      IF _company_id IS NULL THEN
        INSERT INTO public.companies (name, industry, team_size)
        VALUES (_company_name, COALESCE(_industry, 'general'), _team_size)
        RETURNING id INTO _company_id;

        UPDATE public.profiles
        SET company_id = _company_id
        WHERE user_id = _uid;
      END IF;

      -- Best-effort: clear the metadata once it has been used.
      BEGIN
        UPDATE auth.users
        SET raw_user_meta_data = raw_user_meta_data - 'company_name' - 'industry' - 'team_size'
        WHERE id = _uid;
      EXCEPTION WHEN others THEN
        -- ignore
      END;
    END IF;
  END IF;

  -- If a company is now linked, grant owner + admin roles.
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

CREATE OR REPLACE FUNCTION public.create_company_for_current_user(
  _name TEXT,
  _industry TEXT,
  _team_size TEXT DEFAULT NULL
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

  -- If profile is linked, verify the company still exists; if not, clear the orphan.
  SELECT company_id INTO _company_id
  FROM public.profiles
  WHERE user_id = _uid
  LIMIT 1;

  IF _company_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.companies WHERE id = _company_id) THEN
    UPDATE public.profiles SET company_id = NULL WHERE user_id = _uid;
    _company_id := NULL;
  END IF;

  -- If already linked to a REAL company, return it (no second company).
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

  -- Best-effort: clear stale metadata so future JWTs can't resurrect old companies.
  BEGIN
    UPDATE auth.users
    SET raw_user_meta_data = raw_user_meta_data - 'company_name' - 'industry' - 'team_size'
    WHERE id = _uid;
  EXCEPTION WHEN others THEN
    -- ignore
  END;

  RETURN _company_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_company_for_current_user(TEXT, TEXT, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.can_create_company(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT EXISTS (
    SELECT 1
    FROM public.profiles p
    JOIN public.companies c ON c.id = p.company_id
    WHERE p.user_id = _user_id
  )
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  _company_id uuid;
BEGIN
  -- Create/refresh profile
  INSERT INTO public.profiles (user_id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.email
  )
  ON CONFLICT (user_id) DO UPDATE SET
    full_name = COALESCE(EXCLUDED.full_name, profiles.full_name),
    email = COALESCE(EXCLUDED.email, profiles.email);

  -- Link invited technician by email (if a technician row already exists)
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

  -- Company account signup: create company + link + assign admin/owner roles
  IF NULLIF(NEW.raw_user_meta_data->>'company_name', '') IS NOT NULL THEN
    INSERT INTO public.companies (name, industry, team_size)
    VALUES (
      NEW.raw_user_meta_data->>'company_name',
      COALESCE(NULLIF(NEW.raw_user_meta_data->>'industry', ''), 'general'),
      NULLIF(NEW.raw_user_meta_data->>'team_size', '')
    )
    RETURNING id INTO _company_id;

    UPDATE public.profiles
    SET company_id = _company_id
    WHERE user_id = NEW.id;

    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;

    -- Keep owner for existing RLS policies that still check owner.
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'owner')
    ON CONFLICT (user_id, role) DO NOTHING;

    -- Clear the signup metadata so future JWTs can't resurrect deleted companies.
    UPDATE auth.users
    SET raw_user_meta_data = raw_user_meta_data - 'company_name' - 'industry' - 'team_size'
    WHERE id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
