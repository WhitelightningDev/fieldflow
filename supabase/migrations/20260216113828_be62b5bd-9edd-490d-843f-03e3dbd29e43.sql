-- Create the missing create_company_for_current_user RPC function
-- This function creates a company, links it to the user's profile, and assigns the owner role
CREATE OR REPLACE FUNCTION public.create_company_for_current_user(
  _name text,
  _industry text,
  _team_size text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _company_id uuid;
  _user_id uuid := auth.uid();
BEGIN
  -- Guard: user must be authenticated
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Guard: user must not already have a company
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
$$;

-- Also fix the existing broken data: link the orphaned company to the user
-- First, check and fix the specific user whose profile has no company_id
UPDATE public.profiles
SET company_id = (SELECT id FROM public.companies WHERE name = 'Apex Electrical' LIMIT 1)
WHERE email = 'danielmommsen2@gmail.com' AND company_id IS NULL;

-- Add the owner role for the user
INSERT INTO public.user_roles (user_id, role)
SELECT '183bb575-35dc-4ade-818d-ff78a69885c7', 'owner'
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_roles 
  WHERE user_id = '183bb575-35dc-4ade-818d-ff78a69885c7' AND role = 'owner'
);