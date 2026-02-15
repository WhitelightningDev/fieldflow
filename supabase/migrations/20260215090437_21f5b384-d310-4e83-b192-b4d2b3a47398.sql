
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _company_id uuid;
BEGIN
  -- 1. Create profile
  INSERT INTO public.profiles (user_id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.email
  );

  -- 2. If company metadata exists, create the company
  IF NEW.raw_user_meta_data->>'company_name' IS NOT NULL THEN
    INSERT INTO public.companies (name, industry, team_size)
    VALUES (
      NEW.raw_user_meta_data->>'company_name',
      NEW.raw_user_meta_data->>'industry',
      NEW.raw_user_meta_data->>'team_size'
    )
    RETURNING id INTO _company_id;

    -- Link profile to company
    UPDATE public.profiles
    SET company_id = _company_id
    WHERE user_id = NEW.id;

    -- Assign owner role
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'owner');
  END IF;

  RETURN NEW;
END;
$$;
