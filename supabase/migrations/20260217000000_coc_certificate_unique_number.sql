-- Ensure each CoC certificate number is unique per company (traceable serial).

CREATE UNIQUE INDEX IF NOT EXISTS coc_certificates_company_certificate_no_uq
  ON public.coc_certificates(company_id, certificate_no);

