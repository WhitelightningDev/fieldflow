-- Ensure company-account creators receive the admin role.
-- Also backfill admin/owner roles for any existing users who signed up with company metadata.

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

  -- Company account signup: treat creator as admin (and keep owner for legacy policies).
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

    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'owner')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Ensure the auth.users trigger exists.
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

-- Backfill: users who signed up with company metadata should be admins.
INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'admin'::public.app_role
FROM auth.users u
WHERE NULLIF(u.raw_user_meta_data->>'company_name', '') IS NOT NULL
ON CONFLICT (user_id, role) DO NOTHING;

INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'owner'::public.app_role
FROM auth.users u
WHERE NULLIF(u.raw_user_meta_data->>'company_name', '') IS NOT NULL
ON CONFLICT (user_id, role) DO NOTHING;

