-- Create a reliable security definer function for the company creation check
CREATE OR REPLACE FUNCTION public.can_create_company(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = _user_id AND company_id IS NOT NULL
  )
$$;

-- Replace the current insert policy
DROP POLICY IF EXISTS "Users can create a company" ON public.companies;

CREATE POLICY "Users can create a company"
  ON public.companies
  FOR INSERT
  TO authenticated
  WITH CHECK (public.can_create_company(auth.uid()));
