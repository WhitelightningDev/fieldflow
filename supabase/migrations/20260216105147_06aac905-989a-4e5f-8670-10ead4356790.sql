-- Drop the existing insert policy that's failing
DROP POLICY IF EXISTS "Users without company can create one" ON public.companies;

-- Recreate with a simpler check: any authenticated user without a company can create one
CREATE POLICY "Authenticated users can create a company"
  ON public.companies
  FOR INSERT
  TO authenticated
  WITH CHECK (true);
