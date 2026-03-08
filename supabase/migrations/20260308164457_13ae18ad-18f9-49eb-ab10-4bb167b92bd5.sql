
-- 1. Technician credentials table for ECSA/EWSETA verification
CREATE TABLE public.technician_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  technician_id uuid NOT NULL REFERENCES public.technicians(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  credential_type text NOT NULL DEFAULT 'ecsa',
  registration_number text NOT NULL,
  holder_name text,
  issued_date date,
  expiry_date date,
  status text NOT NULL DEFAULT 'pending',
  verified_at timestamptz,
  certificate_storage_path text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.technician_credentials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company users can view technician credentials"
  ON public.technician_credentials FOR SELECT TO authenticated
  USING (company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Company users can create technician credentials"
  ON public.technician_credentials FOR INSERT TO authenticated
  WITH CHECK (company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Company users can update technician credentials"
  ON public.technician_credentials FOR UPDATE TO authenticated
  USING (company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Company users can delete technician credentials"
  ON public.technician_credentials FOR DELETE TO authenticated
  USING (company_id = get_user_company_id(auth.uid()));

CREATE TRIGGER set_updated_at_technician_credentials
  BEFORE UPDATE ON public.technician_credentials
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2. POPIA consent records
CREATE TABLE public.popia_consent_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  consent_type text NOT NULL DEFAULT 'data_processing',
  consent_given boolean NOT NULL DEFAULT true,
  consented_at timestamptz NOT NULL DEFAULT now(),
  withdrawn_at timestamptz,
  ip_address text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.popia_consent_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company users can view consent records"
  ON public.popia_consent_records FOR SELECT TO authenticated
  USING (company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Company users can create consent records"
  ON public.popia_consent_records FOR INSERT TO authenticated
  WITH CHECK (company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Company users can update consent records"
  ON public.popia_consent_records FOR UPDATE TO authenticated
  USING (company_id = get_user_company_id(auth.uid()));

-- 3. POPIA deletion requests
CREATE TABLE public.popia_deletion_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  requester_name text NOT NULL,
  requester_email text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  status text NOT NULL DEFAULT 'pending',
  requested_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  completed_by uuid,
  denial_reason text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.popia_deletion_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company users can view deletion requests"
  ON public.popia_deletion_requests FOR SELECT TO authenticated
  USING (company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Company users can create deletion requests"
  ON public.popia_deletion_requests FOR INSERT TO authenticated
  WITH CHECK (company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Company users can update deletion requests"
  ON public.popia_deletion_requests FOR UPDATE TO authenticated
  USING (company_id = get_user_company_id(auth.uid()));

CREATE TRIGGER set_updated_at_popia_deletion_requests
  BEFORE UPDATE ON public.popia_deletion_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
