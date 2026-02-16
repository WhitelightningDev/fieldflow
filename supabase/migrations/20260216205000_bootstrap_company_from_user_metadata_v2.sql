-- Improve bootstrap to also link an existing company_id from user_metadata.
-- This prevents "create company again" loops when company exists but profile.company_id is missing.

CREATE OR REPLACE FUNCTION public.bootstrap_company_from_user_metadata()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid UUID;
  _company_id UUID;
  _company_name TEXT;
  _industry TEXT;
  _team_size TEXT;
  _full_name TEXT;
  _email TEXT;
  _meta JSONB;
  _meta_company_id_text TEXT;
  _meta_company_id UUID;
  _meta_role TEXT;
BEGIN
  _uid := auth.uid();
  IF _uid IS NULL THEN
    RETURN NULL;
  END IF;

  _meta := auth.jwt() -> 'user_metadata';
  _company_name := NULLIF(_meta ->> 'company_name', '');
  _industry := NULLIF(_meta ->> 'industry', '');
  _team_size := NULLIF(_meta ->> 'team_size', '');
  _full_name := NULLIF(_meta ->> 'full_name', '');
  _email := NULLIF(auth.jwt() ->> 'email', '');
  _meta_role := NULLIF(_meta ->> 'role', '');

  _meta_company_id_text := NULLIF(_meta ->> 'company_id', '');
  _meta_company_id := NULL;
  IF _meta_company_id_text IS NOT NULL
     AND _meta_company_id_text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    _meta_company_id := _meta_company_id_text::uuid;
  END IF;

  -- Ensure profile exists
  INSERT INTO public.profiles (user_id, full_name, email)
  VALUES (_uid, COALESCE(_full_name, ''), _email)
  ON CONFLICT (user_id) DO UPDATE
    SET full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
        email = COALESCE(EXCLUDED.email, public.profiles.email);

  -- If already linked, return existing company
  SELECT company_id INTO _company_id
  FROM public.profiles
  WHERE user_id = _uid
  LIMIT 1;

  IF _company_id IS NOT NULL THEN
    RETURN _company_id;
  END IF;

  -- If metadata includes a company_id, link to it (if it exists)
  IF _meta_company_id IS NOT NULL THEN
    SELECT id INTO _company_id FROM public.companies WHERE id = _meta_company_id LIMIT 1;
    IF _company_id IS NOT NULL THEN
      UPDATE public.profiles SET company_id = _company_id WHERE user_id = _uid;

      IF _meta_role IS NOT NULL THEN
        INSERT INTO public.user_roles (user_id, role)
        VALUES (_uid, _meta_role::app_role)
        ON CONFLICT (user_id, role) DO NOTHING;
      END IF;

      RETURN _company_id;
    END IF;
  END IF;

  -- If no company metadata, nothing to bootstrap
  IF _company_name IS NULL THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.companies (name, industry, team_size)
  VALUES (_company_name, COALESCE(_industry, 'general'), _team_size)
  RETURNING id INTO _company_id;

  UPDATE public.profiles
  SET company_id = _company_id
  WHERE user_id = _uid;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (_uid, 'owner')
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN _company_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.bootstrap_company_from_user_metadata() TO authenticated;

