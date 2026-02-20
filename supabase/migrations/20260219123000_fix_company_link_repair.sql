-- Fix: users with valid roles but missing profile.company_id were being sent back to "Create company".
--
-- Root cause:
-- - Some environments/backfills can leave users with roles (owner/admin) but no profiles.company_id.
-- - Our ghost-company fix returned early when roles existed, preventing any association repair.
--
-- Approach:
-- - Persist a trusted `company_id` into auth.users.raw_user_meta_data when a company is created.
-- - When roles exist but profiles.company_id is NULL (or profile is missing), ensure_user_role() repairs
--   the profile linkage from auth metadata (company_id) or technician table, without using stale company_name.

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
  _jwt_meta jsonb;
  _company_name text;
  _industry text;
  _team_size text;
  _meta_company_id uuid;
  _raw_meta jsonb;
BEGIN
  _uid := auth.uid();
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  -- Ensure profile exists (some older DBs didn't have a reliable trigger).
  INSERT INTO public.profiles (user_id, full_name, email)
  VALUES (_uid, '', NULLIF(auth.jwt() ->> 'email', ''))
  ON CONFLICT (user_id) DO NOTHING;

  -- Load profile company_id and clear orphaned references (company deleted externally).
  SELECT company_id INTO _company_id
  FROM public.profiles
  WHERE user_id = _uid
  LIMIT 1;

  IF _company_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.companies WHERE id = _company_id) THEN
    UPDATE public.profiles SET company_id = NULL WHERE user_id = _uid;
    _company_id := NULL;
  END IF;

  -- Load roles
  SELECT array_agg(role ORDER BY role) INTO _roles
  FROM public.user_roles
  WHERE user_id = _uid;

  -- If roles exist, we still may need to repair the company linkage (but must not create ghost companies).
  IF COALESCE(array_length(_roles, 1), 0) > 0 THEN
    -- 1) Technician association is trusted via technicians table.
    SELECT id, company_id INTO _tech_id, _tech_company_id
    FROM public.technicians
    WHERE user_id = _uid
    LIMIT 1;

    IF _tech_id IS NOT NULL AND _tech_company_id IS NOT NULL THEN
      UPDATE public.profiles
      SET company_id = _tech_company_id
      WHERE user_id = _uid;
      _company_id := _tech_company_id;
    END IF;

    -- 2) Repair company link from trusted auth metadata `company_id` (set at company creation time).
    IF _company_id IS NULL THEN
      BEGIN
        SELECT raw_user_meta_data INTO _raw_meta
        FROM auth.users
        WHERE id = _uid;

        _meta_company_id := NULLIF((_raw_meta ->> 'company_id'), '')::uuid;

        IF _meta_company_id IS NOT NULL THEN
          IF EXISTS (SELECT 1 FROM public.companies WHERE id = _meta_company_id) THEN
            UPDATE public.profiles
            SET company_id = _meta_company_id
            WHERE user_id = _uid;
            _company_id := _meta_company_id;
          ELSE
            -- Stale/invalid company id in auth metadata; clear it.
            UPDATE auth.users
            SET raw_user_meta_data = (COALESCE(raw_user_meta_data, '{}'::jsonb) - 'company_id')
            WHERE id = _uid;
          END IF;
        END IF;
      EXCEPTION WHEN others THEN
        -- ignore
      END;
    END IF;

    -- Best-effort: always clear stale company-name metadata (prevents resurrection).
    BEGIN
      UPDATE auth.users
      SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) - 'company_name' - 'industry' - 'team_size'
      WHERE id = _uid;
    EXCEPTION WHEN others THEN
      -- ignore
    END;

    RETURN COALESCE(_roles, ARRAY[]::public.app_role[]);
  END IF;

  -- ── No roles yet: perform safe best-effort association creation/repair ──

  -- Technician association (trusted via technicians table)
  SELECT id, company_id INTO _tech_id, _tech_company_id
  FROM public.technicians
  WHERE user_id = _uid
  LIMIT 1;

  IF _tech_id IS NOT NULL THEN
    IF _tech_company_id IS NOT NULL THEN
      UPDATE public.profiles
      SET company_id = _tech_company_id
      WHERE user_id = _uid;
      _company_id := _tech_company_id;
    END IF;

    INSERT INTO public.user_roles (user_id, role)
    VALUES (_uid, 'technician')
    ON CONFLICT (user_id, role) DO NOTHING;

    SELECT array_agg(role ORDER BY role) INTO _roles
    FROM public.user_roles
    WHERE user_id = _uid;

    RETURN COALESCE(_roles, ARRAY[]::public.app_role[]);
  END IF;

  -- Company-account signup recovery:
  -- Only create from JWT metadata when the user has no roles and no company linked.
  IF _company_id IS NULL THEN
    _jwt_meta := auth.jwt() -> 'user_metadata';
    _company_name := NULLIF(_jwt_meta ->> 'company_name', '');
    _industry := NULLIF(_jwt_meta ->> 'industry', '');
    _team_size := NULLIF(_jwt_meta ->> 'team_size', '');

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

      -- Persist the linked company_id and clear the signup metadata.
      BEGIN
        UPDATE auth.users
        SET raw_user_meta_data =
          (COALESCE(raw_user_meta_data, '{}'::jsonb) - 'company_name' - 'industry' - 'team_size')
          || jsonb_build_object('company_id', _company_id::text)
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

-- Ensure company creation persists the trusted company_id into auth metadata.
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

  -- Persist company_id and clear stale company-name metadata so future logins can repair linkage.
  BEGIN
    UPDATE auth.users
    SET raw_user_meta_data =
      (COALESCE(raw_user_meta_data, '{}'::jsonb) - 'company_name' - 'industry' - 'team_size')
      || jsonb_build_object('company_id', _company_id::text)
    WHERE id = _uid;
  EXCEPTION WHEN others THEN
    -- ignore
  END;

  RETURN _company_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_company_for_current_user(TEXT, TEXT, TEXT) TO authenticated;

-- Ensure signup-trigger company creation also persists company_id into auth metadata.
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

    -- Persist company_id and clear the signup metadata so future JWTs can't resurrect deleted companies by name.
    UPDATE auth.users
    SET raw_user_meta_data =
      (COALESCE(raw_user_meta_data, '{}'::jsonb) - 'company_name' - 'industry' - 'team_size')
      || jsonb_build_object('company_id', _company_id::text)
    WHERE id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
