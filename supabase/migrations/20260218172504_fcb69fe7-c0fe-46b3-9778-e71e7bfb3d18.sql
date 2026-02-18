
-- Drop any partial policies first
DROP POLICY IF EXISTS "Company users can view technician locations" ON public.technician_locations;
DROP POLICY IF EXISTS "Technicians can insert own location" ON public.technician_locations;
DROP POLICY IF EXISTS "Technicians can update own location" ON public.technician_locations;

ALTER TABLE public.technician_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company users can view technician locations"
ON public.technician_locations FOR SELECT
USING (company_id::text = get_user_company_id(auth.uid())::text);

CREATE POLICY "Technicians can insert own location"
ON public.technician_locations FOR INSERT
WITH CHECK (user_id::text = auth.uid()::text);

CREATE POLICY "Technicians can update own location"
ON public.technician_locations FOR UPDATE
USING (user_id::text = auth.uid()::text);
