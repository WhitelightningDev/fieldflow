-- Create a secure, atomic RPC for company creation.
-- This avoids partial state (company created but profile not linked) and is resilient to RLS.

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

