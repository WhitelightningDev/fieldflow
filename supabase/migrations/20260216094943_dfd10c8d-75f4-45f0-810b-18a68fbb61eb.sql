
-- Create notifications table
CREATE TABLE public.notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'info',
  title text NOT NULL,
  body text,
  metadata jsonb DEFAULT '{}'::jsonb,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Users can only see their own notifications
CREATE POLICY "Users can view own notifications"
  ON public.notifications FOR SELECT
  USING (user_id = auth.uid());

-- Users can update (mark read) own notifications
CREATE POLICY "Users can update own notifications"
  ON public.notifications FOR UPDATE
  USING (user_id = auth.uid());

-- System inserts only (via service role / triggers)
CREATE POLICY "Service role can insert notifications"
  ON public.notifications FOR INSERT
  WITH CHECK (true);

-- Users can delete own notifications
CREATE POLICY "Users can delete own notifications"
  ON public.notifications FOR DELETE
  USING (user_id = auth.uid());

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- Create a function to notify technician when assigned a job
CREATE OR REPLACE FUNCTION public.notify_technician_on_job_assign()
RETURNS TRIGGER AS $$
DECLARE
  _tech_user_id uuid;
  _company_id uuid;
  _job_title text;
BEGIN
  -- Only fire when technician_id changes from null/different to a new value
  IF NEW.technician_id IS NOT NULL AND (OLD.technician_id IS DISTINCT FROM NEW.technician_id) THEN
    -- Get technician's user_id
    SELECT user_id INTO _tech_user_id FROM public.technicians WHERE id = NEW.technician_id;
    
    IF _tech_user_id IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, company_id, type, title, body, metadata)
      VALUES (
        _tech_user_id,
        NEW.company_id,
        'job_assigned',
        'New job assigned: ' || NEW.title,
        COALESCE(NEW.description, 'You have been assigned a new job.'),
        jsonb_build_object('job_card_id', NEW.id, 'job_title', NEW.title, 'status', NEW.status)
      );
    END IF;
  END IF;
  
  -- Also notify on status changes
  IF OLD.status IS DISTINCT FROM NEW.status AND NEW.technician_id IS NOT NULL THEN
    SELECT user_id INTO _tech_user_id FROM public.technicians WHERE id = NEW.technician_id;
    
    -- Only send if not already sent a job_assigned notification above
    IF _tech_user_id IS NOT NULL AND NOT (OLD.technician_id IS DISTINCT FROM NEW.technician_id) THEN
      INSERT INTO public.notifications (user_id, company_id, type, title, body, metadata)
      VALUES (
        _tech_user_id,
        NEW.company_id,
        'job_status_changed',
        'Job status updated: ' || NEW.title,
        'Status changed to ' || NEW.status,
        jsonb_build_object('job_card_id', NEW.id, 'job_title', NEW.title, 'old_status', OLD.status, 'new_status', NEW.status)
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trg_notify_technician_on_job_assign
  AFTER UPDATE ON public.job_cards
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_technician_on_job_assign();

-- Also notify on INSERT when technician is assigned at creation
CREATE OR REPLACE FUNCTION public.notify_technician_on_job_create()
RETURNS TRIGGER AS $$
DECLARE
  _tech_user_id uuid;
BEGIN
  IF NEW.technician_id IS NOT NULL THEN
    SELECT user_id INTO _tech_user_id FROM public.technicians WHERE id = NEW.technician_id;
    
    IF _tech_user_id IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, company_id, type, title, body, metadata)
      VALUES (
        _tech_user_id,
        NEW.company_id,
        'job_assigned',
        'New job assigned: ' || NEW.title,
        COALESCE(NEW.description, 'You have been assigned a new job.'),
        jsonb_build_object('job_card_id', NEW.id, 'job_title', NEW.title, 'status', NEW.status)
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trg_notify_technician_on_job_create
  AFTER INSERT ON public.job_cards
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_technician_on_job_create();

-- Fix the handle_new_user trigger to also link technician records for invited users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  _company_id uuid;
  _role text;
BEGIN
  -- 1. Create profile (or update if upserted by edge function)
  INSERT INTO public.profiles (user_id, full_name, email, company_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.email,
    (NEW.raw_user_meta_data->>'company_id')::uuid
  )
  ON CONFLICT (user_id) DO UPDATE SET
    full_name = COALESCE(EXCLUDED.full_name, profiles.full_name),
    email = COALESCE(EXCLUDED.email, profiles.email),
    company_id = COALESCE(EXCLUDED.company_id, profiles.company_id);

  -- 2. If company metadata exists (owner signup), create the company
  IF NEW.raw_user_meta_data->>'company_name' IS NOT NULL THEN
    INSERT INTO public.companies (name, industry, team_size)
    VALUES (
      NEW.raw_user_meta_data->>'company_name',
      NEW.raw_user_meta_data->>'industry',
      NEW.raw_user_meta_data->>'team_size'
    )
    RETURNING id INTO _company_id;

    UPDATE public.profiles SET company_id = _company_id WHERE user_id = NEW.id;

    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'owner')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  -- 3. If role metadata exists (technician invite), assign role
  _role := NEW.raw_user_meta_data->>'role';
  IF _role IS NOT NULL AND _role != '' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, _role::app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  -- 4. Link any unlinked technician record by email
  UPDATE public.technicians
  SET user_id = NEW.id, invite_status = 'accepted'
  WHERE email = NEW.email AND user_id IS NULL;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Add unique constraint on profiles for user_id if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conrelid = 'public.profiles'::regclass AND conname = 'profiles_user_id_key'
  ) THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_user_id_key UNIQUE (user_id);
  END IF;
END $$;
