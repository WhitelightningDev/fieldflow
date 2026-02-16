-- Live technician tracking (admin dashboard + technician mobile dispatch)
-- Stores the latest known location and current assignment context.

CREATE TABLE IF NOT EXISTS public.technician_locations (
  technician_id uuid PRIMARY KEY REFERENCES public.technicians(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  job_card_id uuid REFERENCES public.job_cards(id) ON DELETE SET NULL,
  site_id uuid REFERENCES public.sites(id) ON DELETE SET NULL,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  accuracy real,
  heading real,
  speed real,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS technician_locations_company_id_idx ON public.technician_locations(company_id);
CREATE INDEX IF NOT EXISTS technician_locations_updated_at_idx ON public.technician_locations(updated_at DESC);

DROP TRIGGER IF EXISTS update_technician_locations_updated_at ON public.technician_locations;
CREATE TRIGGER update_technician_locations_updated_at
  BEFORE UPDATE ON public.technician_locations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.technician_locations ENABLE ROW LEVEL SECURITY;

-- Company users can see locations for their company.
DROP POLICY IF EXISTS "Company users can view technician locations" ON public.technician_locations;
CREATE POLICY "Company users can view technician locations"
  ON public.technician_locations FOR SELECT
  TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()));

-- Technicians can upsert their own location row.
DROP POLICY IF EXISTS "Technicians can insert own location" ON public.technician_locations;
CREATE POLICY "Technicians can insert own location"
  ON public.technician_locations FOR INSERT
  TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'technician')
    AND technician_id = get_user_technician_id(auth.uid())
    AND company_id = get_user_company_id(auth.uid())
    AND user_id = auth.uid()
  );

DROP POLICY IF EXISTS "Technicians can update own location" ON public.technician_locations;
CREATE POLICY "Technicians can update own location"
  ON public.technician_locations FOR UPDATE
  TO authenticated
  USING (
    has_role(auth.uid(), 'technician')
    AND technician_id = get_user_technician_id(auth.uid())
    AND company_id = get_user_company_id(auth.uid())
    AND user_id = auth.uid()
  )
  WITH CHECK (
    has_role(auth.uid(), 'technician')
    AND technician_id = get_user_technician_id(auth.uid())
    AND company_id = get_user_company_id(auth.uid())
    AND user_id = auth.uid()
  );

-- Realtime: allow admin UI to receive live updates.
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.job_cards;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.technician_locations;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;

