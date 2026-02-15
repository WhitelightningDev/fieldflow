-- Technician invite linkage (optional, used by edge function).
ALTER TABLE public.technicians
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS invite_status TEXT,
ADD COLUMN IF NOT EXISTS invited_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS technicians_user_id_idx ON public.technicians(user_id);

