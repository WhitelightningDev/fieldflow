
-- Invoices table
CREATE TABLE public.invoices (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.companies(id),
  job_card_id uuid NOT NULL REFERENCES public.job_cards(id),
  customer_id uuid REFERENCES public.customers(id),
  invoice_number text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  labour_minutes integer NOT NULL DEFAULT 0,
  labour_rate_cents integer NOT NULL DEFAULT 0,
  labour_total_cents integer NOT NULL DEFAULT 0,
  parts_total_cents integer NOT NULL DEFAULT 0,
  subtotal_cents integer NOT NULL DEFAULT 0,
  vat_percent numeric NOT NULL DEFAULT 15,
  vat_cents integer NOT NULL DEFAULT 0,
  total_cents integer NOT NULL DEFAULT 0,
  amount_paid_cents integer NOT NULL DEFAULT 0,
  notes text,
  line_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  sent_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company users can view invoices"
  ON public.invoices FOR SELECT
  USING (company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Company users can create invoices"
  ON public.invoices FOR INSERT
  WITH CHECK (company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Company users can update invoices"
  ON public.invoices FOR UPDATE
  USING (company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Company users can delete invoices"
  ON public.invoices FOR DELETE
  USING (company_id = get_user_company_id(auth.uid()));

CREATE TRIGGER update_invoices_updated_at
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Invoice payments table
CREATE TABLE public.invoice_payments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id),
  amount_cents integer NOT NULL DEFAULT 0,
  payment_method text NOT NULL DEFAULT 'cash',
  reference text,
  proof_storage_path text,
  paid_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.invoice_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company users can view payments"
  ON public.invoice_payments FOR SELECT
  USING (company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Company users can create payments"
  ON public.invoice_payments FOR INSERT
  WITH CHECK (company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Company users can update payments"
  ON public.invoice_payments FOR UPDATE
  USING (company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Company users can delete payments"
  ON public.invoice_payments FOR DELETE
  USING (company_id = get_user_company_id(auth.uid()));

-- Storage bucket for payment proofs
INSERT INTO storage.buckets (id, name, public) VALUES ('payment-proofs', 'payment-proofs', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Company users can upload payment proofs"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'payment-proofs');

CREATE POLICY "Company users can view payment proofs"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'payment-proofs');

-- Sequence for invoice numbers per company
CREATE OR REPLACE FUNCTION public.generate_invoice_number(_company_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _count integer;
BEGIN
  SELECT COUNT(*) + 1 INTO _count FROM public.invoices WHERE company_id = _company_id;
  RETURN 'INV-' || LPAD(_count::text, 5, '0');
END;
$$;
