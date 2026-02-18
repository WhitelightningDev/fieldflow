-- Ensure the auth.users signup trigger is present and the function reliably:
-- - creates/updates a profile
-- - creates & links a company for company-account signups (metadata company_name)
-- - assigns roles for company creators (admin + owner for legacy RLS)
-- - links invited technicians by email and assigns technician role

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
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

