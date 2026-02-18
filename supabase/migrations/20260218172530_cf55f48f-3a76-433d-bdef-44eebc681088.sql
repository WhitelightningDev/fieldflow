
-- Drop any partial policies
DROP POLICY IF EXISTS "Company users can view coc certificates" ON public.coc_certificates;
DROP POLICY IF EXISTS "Company users can insert coc certificates" ON public.coc_certificates;
DROP POLICY IF EXISTS "Company users can update coc certificates" ON public.coc_certificates;
DROP POLICY IF EXISTS "Company users can delete coc certificates" ON public.coc_certificates;

ALTER TABLE public.coc_certificates ENABLE ROW LEVEL SECURITY;

-- company_id on coc_certificates is character varying; get_user_company_id returns uuid
CREATE POLICY "Company users can view coc certificates"
ON public.coc_certificates FOR SELECT
USING (company_id::text = get_user_company_id(auth.uid())::text);

CREATE POLICY "Company users can insert coc certificates"
ON public.coc_certificates FOR INSERT
WITH CHECK (company_id::text = get_user_company_id(auth.uid())::text);

CREATE POLICY "Company users can update coc certificates"
ON public.coc_certificates FOR UPDATE
USING (company_id::text = get_user_company_id(auth.uid())::text);

CREATE POLICY "Company users can delete coc certificates"
ON public.coc_certificates FOR DELETE
USING (company_id::text = get_user_company_id(auth.uid())::text);
