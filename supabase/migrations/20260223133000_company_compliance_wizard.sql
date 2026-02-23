-- Company compliance wizard support
-- Tracks compliance status on companies and stores uploaded compliance documents per industry.

ALTER TABLE public.companies
ADD COLUMN IF NOT EXISTS compliance_status text NOT NULL DEFAULT 'unverified',
ADD COLUMN IF NOT EXISTS compliance_progress integer NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS compliance_updated_at timestamptz NOT NULL DEFAULT now();

CREATE TABLE IF NOT EXISTS public.company_compliance_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  industry text,
  kind text NOT NULL,
  label text NOT NULL,
  storage_path text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, kind)
);

ALTER TABLE public.company_compliance_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company users can view compliance documents"
  ON public.company_compliance_documents FOR SELECT
  TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Company users can create compliance documents"
  ON public.company_compliance_documents FOR INSERT
  TO authenticated
  WITH CHECK (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Company users can update compliance documents"
  ON public.company_compliance_documents FOR UPDATE
  TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Company users can delete compliance documents"
  ON public.company_compliance_documents FOR DELETE
  TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()));

CREATE TRIGGER update_company_compliance_documents_updated_at
  BEFORE UPDATE ON public.company_compliance_documents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Private bucket for compliance documentation
INSERT INTO storage.buckets (id, name, public)
VALUES ('compliance-docs', 'compliance-docs', false)
ON CONFLICT (id) DO NOTHING;

