-- Fix companies INSERT RLS so a user can create their first company from /dashboard/create-company.
-- The app links the company to the user via profiles.company_id immediately after insert.

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

-- Remove any legacy/duplicate insert policies (names changed over time).
DROP POLICY IF EXISTS "Authenticated users can create companies" ON public.companies;
DROP POLICY IF EXISTS "Users without company can create one" ON public.companies;
DROP POLICY IF EXISTS "Users can create company" ON public.companies;

-- Allow a user to create exactly one company (only when their profile has no company_id).
CREATE POLICY "Users without company can create one"
  ON public.companies
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND public.get_user_company_id(auth.uid()) IS NULL
    AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid())
  );

