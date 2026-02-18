-- Best-effort repair: ensure a signed-in user has an app role when they are legitimately associated.
-- This helps recover from missing triggers/migrations and avoids "logged in but no seat" lockouts.

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
  _tech_id uuid;
  _meta_company_name text;
BEGIN
  _uid := auth.uid();
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT array_agg(role ORDER BY role) INTO _roles
  FROM public.user_roles
  WHERE user_id = _uid;

  IF COALESCE(array_length(_roles, 1), 0) > 0 THEN
    RETURN _roles;
  END IF;

  -- If the user is linked to a technician record, they are a technician.
  SELECT id INTO _tech_id
  FROM public.technicians
  WHERE user_id = _uid
  LIMIT 1;

  IF _tech_id IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (_uid, 'technician')
    ON CONFLICT (user_id, role) DO NOTHING;
  ELSE
    -- If the user already has a company_id (set by trusted server-side flows),
    -- treat them as an admin (and keep owner for legacy RLS checks).
    SELECT company_id INTO _company_id
    FROM public.profiles
    WHERE user_id = _uid
    LIMIT 1;

    _meta_company_name := NULLIF((auth.jwt() -> 'user_metadata' ->> 'company_name'), '');

    IF _company_id IS NOT NULL OR _meta_company_name IS NOT NULL THEN
      INSERT INTO public.user_roles (user_id, role)
      VALUES (_uid, 'admin')
      ON CONFLICT (user_id, role) DO NOTHING;

      INSERT INTO public.user_roles (user_id, role)
      VALUES (_uid, 'owner')
      ON CONFLICT (user_id, role) DO NOTHING;
    END IF;
  END IF;

  SELECT array_agg(role ORDER BY role) INTO _roles
  FROM public.user_roles
  WHERE user_id = _uid;

  RETURN COALESCE(_roles, ARRAY[]::public.app_role[]);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.ensure_user_role() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_user_role() TO authenticated;

