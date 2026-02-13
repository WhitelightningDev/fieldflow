
-- Replace overly permissive companies INSERT policy
-- Only allow users without an existing company to create one
DROP POLICY "Authenticated users can create companies" ON public.companies;

CREATE POLICY "Users without company can create one"
  ON public.companies FOR INSERT
  TO authenticated
  WITH CHECK (public.get_user_company_id(auth.uid()) IS NULL);
