-- Electrical Certificates of Compliance (South Africa)
-- Stores Annexure 1 CoC details + accompanying Test Report data (JSONB).

CREATE TABLE IF NOT EXISTS public.coc_certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  site_id UUID REFERENCES public.sites(id) ON DELETE SET NULL,
  job_card_id UUID REFERENCES public.job_cards(id) ON DELETE SET NULL,
  certificate_no TEXT NOT NULL,
  certificate_type TEXT NOT NULL CHECK (certificate_type IN ('initial', 'supplementary')),
  issued_at DATE,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  test_report JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS coc_certificates_company_id_idx ON public.coc_certificates(company_id);
CREATE INDEX IF NOT EXISTS coc_certificates_site_id_idx ON public.coc_certificates(site_id);
CREATE INDEX IF NOT EXISTS coc_certificates_job_card_id_idx ON public.coc_certificates(job_card_id);
CREATE INDEX IF NOT EXISTS coc_certificates_certificate_no_idx ON public.coc_certificates(certificate_no);

ALTER TABLE public.coc_certificates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view company CoCs"
  ON public.coc_certificates FOR SELECT
  TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Users can create company CoCs"
  ON public.coc_certificates FOR INSERT
  TO authenticated
  WITH CHECK (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Users can update company CoCs"
  ON public.coc_certificates FOR UPDATE
  TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Users can delete company CoCs"
  ON public.coc_certificates FOR DELETE
  TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()));

DROP TRIGGER IF EXISTS update_coc_certificates_updated_at ON public.coc_certificates;
CREATE TRIGGER update_coc_certificates_updated_at
  BEFORE UPDATE ON public.coc_certificates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

