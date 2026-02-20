
-- 1. Fix can_create_company: also return TRUE if profile's company_id references a deleted company
CREATE OR REPLACE FUNCTION public.can_create_company(_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.profiles p
    JOIN public.companies c ON c.id = p.company_id
    WHERE p.user_id = _user_id AND p.company_id IS NOT NULL
  )
$function$;

-- 2. Fix ensure_user_role: handle orphaned company_ids and don't resurrect ghost companies from stale JWT metadata
CREATE OR REPLACE FUNCTION public.ensure_user_role()
 RETURNS app_role[]
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  _company_exists boolean;
BEGIN
  _uid := auth.uid();
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  -- Ensure profile exists
  INSERT INTO public.profiles (user_id, full_name, email)
  VALUES (_uid, '', NULLIF(auth.jwt() ->> 'email', ''))
  ON CONFLICT (user_id) DO NOTHING;

  -- Check for orphaned company_id (company was deleted but profile still references it)
  SELECT company_id INTO _company_id
  FROM public.profiles
  WHERE user_id = _uid
  LIMIT 1;

  IF _company_id IS NOT NULL THEN
    SELECT EXISTS (SELECT 1 FROM public.companies WHERE id = _company_id) INTO _company_exists;
    IF NOT _company_exists THEN
      -- Clear the orphaned reference
      UPDATE public.profiles SET company_id = NULL WHERE user_id = _uid;
      _company_id := NULL;
    END IF;
  END IF;

  -- If roles already exist AND user has a valid company, return them.
  SELECT array_agg(role ORDER BY role) INTO _roles
  FROM public.user_roles
  WHERE user_id = _uid;

  IF COALESCE(array_length(_roles, 1), 0) > 0 THEN
    -- Roles exist; just return them. Do NOT re-read JWT metadata to avoid ghost companies.
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
  -- Only create from metadata if user has NO company yet AND no roles yet.
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

  -- If a company is now linked, treat user as admin + owner
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
$function$;

-- 3. Fix create_company_for_current_user: detect and clear orphaned company_id before guard check
CREATE OR REPLACE FUNCTION public.create_company_for_current_user(_name text, _industry text, _team_size text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _company_id uuid;
  _user_id uuid := auth.uid();
  _existing_company_id uuid;
  _company_exists boolean;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Detect and clear orphaned company_id (company was deleted but profile still references it)
  SELECT company_id INTO _existing_company_id
  FROM public.profiles
  WHERE user_id = _user_id;

  IF _existing_company_id IS NOT NULL THEN
    SELECT EXISTS (SELECT 1 FROM public.companies WHERE id = _existing_company_id) INTO _company_exists;
    IF NOT _company_exists THEN
      UPDATE public.profiles SET company_id = NULL WHERE user_id = _user_id;
    END IF;
  END IF;

  -- Guard: user must not already have a (valid) company
  IF NOT public.can_create_company(_user_id) THEN
    RAISE EXCEPTION 'User already has a company';
  END IF;

  -- Create the company
  INSERT INTO public.companies (name, industry, team_size)
  VALUES (_name, _industry, _team_size)
  RETURNING id INTO _company_id;

  -- Link profile to company
  UPDATE public.profiles
  SET company_id = _company_id
  WHERE user_id = _user_id;

  -- Assign owner role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (_user_id, 'owner')
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN _company_id;
END;
$function$;
