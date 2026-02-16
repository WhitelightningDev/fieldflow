-- Replace overly permissive policy with a proper one
DROP POLICY IF EXISTS "Authenticated users can create a company" ON public.companies;

CREATE POLICY "Users can create a company"
  ON public.companies
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.get_user_company_id(auth.uid()) IS NULL
    OR public.get_user_company_id(auth.uid()) = id
  );
