-- Fix: allow PostgREST/Supabase upsert on technician_id
-- Error seen in client: "there is no unique or exclusion constraint matching the ON CONFLICT specification"
-- Requires a UNIQUE index/constraint on the columns listed in `onConflict`.

CREATE UNIQUE INDEX IF NOT EXISTS technician_locations_technician_id_uq
  ON public.technician_locations(technician_id);

