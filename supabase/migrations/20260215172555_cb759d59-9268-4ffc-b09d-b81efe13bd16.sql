
-- Link technicians to auth users
ALTER TABLE public.technicians
ADD COLUMN user_id uuid UNIQUE DEFAULT NULL;

-- Add invite status tracking
ALTER TABLE public.technicians
ADD COLUMN invite_status text NOT NULL DEFAULT 'pending'
CHECK (invite_status IN ('pending', 'invited', 'accepted'));
