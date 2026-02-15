-- Ensures a company created via metadata during signup exists and is linked
-- to the signed-in user's profile (useful if the signup trigger was missing
-- or the user completes auth via a callback).
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

