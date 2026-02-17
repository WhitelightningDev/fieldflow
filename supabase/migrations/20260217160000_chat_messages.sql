-- Realtime chat between admin/office and technicians
-- Threads are per (company_id, technician_id) for simplicity.

CREATE TABLE IF NOT EXISTS public.chat_threads (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  technician_id uuid NOT NULL REFERENCES public.technicians(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS chat_threads_company_technician_uq
  ON public.chat_threads(company_id, technician_id);
CREATE INDEX IF NOT EXISTS chat_threads_company_id_idx
  ON public.chat_threads(company_id);
CREATE INDEX IF NOT EXISTS chat_threads_updated_at_idx
  ON public.chat_threads(updated_at DESC);

DROP TRIGGER IF EXISTS update_chat_threads_updated_at ON public.chat_threads;
CREATE TRIGGER update_chat_threads_updated_at
  BEFORE UPDATE ON public.chat_threads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.chat_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  thread_id uuid NOT NULL REFERENCES public.chat_threads(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  sender_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS chat_messages_thread_created_at_idx
  ON public.chat_messages(thread_id, created_at);
CREATE INDEX IF NOT EXISTS chat_messages_company_created_at_idx
  ON public.chat_messages(company_id, created_at);

CREATE TABLE IF NOT EXISTS public.chat_thread_reads (
  thread_id uuid NOT NULL REFERENCES public.chat_threads(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  last_read_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (thread_id, user_id)
);

DROP TRIGGER IF EXISTS update_chat_thread_reads_updated_at ON public.chat_thread_reads;
CREATE TRIGGER update_chat_thread_reads_updated_at
  BEFORE UPDATE ON public.chat_thread_reads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.chat_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_thread_reads ENABLE ROW LEVEL SECURITY;

-- Threads: admins can see all company threads; technicians only their own thread.
DROP POLICY IF EXISTS "Company users can view chat threads" ON public.chat_threads;
CREATE POLICY "Company users can view chat threads"
  ON public.chat_threads FOR SELECT
  TO authenticated
  USING (
    company_id = public.get_user_company_id(auth.uid())
    AND (
      public.has_role(auth.uid(), 'owner')
      OR public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'office_staff')
      OR (
        public.has_role(auth.uid(), 'technician')
        AND technician_id = public.get_user_technician_id(auth.uid())
      )
    )
  );

DROP POLICY IF EXISTS "Company users can create chat threads" ON public.chat_threads;
CREATE POLICY "Company users can create chat threads"
  ON public.chat_threads FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id = public.get_user_company_id(auth.uid())
    AND (
      public.has_role(auth.uid(), 'owner')
      OR public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'office_staff')
      OR (
        public.has_role(auth.uid(), 'technician')
        AND technician_id = public.get_user_technician_id(auth.uid())
      )
    )
  );

DROP POLICY IF EXISTS "Company users can update chat threads" ON public.chat_threads;
CREATE POLICY "Company users can update chat threads"
  ON public.chat_threads FOR UPDATE
  TO authenticated
  USING (
    company_id = public.get_user_company_id(auth.uid())
    AND (
      public.has_role(auth.uid(), 'owner')
      OR public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'office_staff')
      OR (
        public.has_role(auth.uid(), 'technician')
        AND technician_id = public.get_user_technician_id(auth.uid())
      )
    )
  )
  WITH CHECK (
    company_id = public.get_user_company_id(auth.uid())
    AND (
      public.has_role(auth.uid(), 'owner')
      OR public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'office_staff')
      OR (
        public.has_role(auth.uid(), 'technician')
        AND technician_id = public.get_user_technician_id(auth.uid())
      )
    )
  );

-- Messages: participants (admin roles or the assigned technician) can read.
DROP POLICY IF EXISTS "Participants can view chat messages" ON public.chat_messages;
CREATE POLICY "Participants can view chat messages"
  ON public.chat_messages FOR SELECT
  TO authenticated
  USING (
    company_id = public.get_user_company_id(auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.chat_threads t
      WHERE t.id = thread_id
        AND t.company_id = company_id
        AND (
          public.has_role(auth.uid(), 'owner')
          OR public.has_role(auth.uid(), 'admin')
          OR public.has_role(auth.uid(), 'office_staff')
          OR (
            public.has_role(auth.uid(), 'technician')
            AND t.technician_id = public.get_user_technician_id(auth.uid())
          )
        )
    )
  );

DROP POLICY IF EXISTS "Participants can send chat messages" ON public.chat_messages;
CREATE POLICY "Participants can send chat messages"
  ON public.chat_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_user_id = auth.uid()
    AND company_id = public.get_user_company_id(auth.uid())
    AND char_length(body) > 0
    AND EXISTS (
      SELECT 1
      FROM public.chat_threads t
      WHERE t.id = thread_id
        AND t.company_id = company_id
        AND (
          public.has_role(auth.uid(), 'owner')
          OR public.has_role(auth.uid(), 'admin')
          OR public.has_role(auth.uid(), 'office_staff')
          OR (
            public.has_role(auth.uid(), 'technician')
            AND t.technician_id = public.get_user_technician_id(auth.uid())
          )
        )
    )
  );

-- Read state: each user can manage their own read marker for allowed threads.
DROP POLICY IF EXISTS "Users can view own chat read state" ON public.chat_thread_reads;
CREATE POLICY "Users can view own chat read state"
  ON public.chat_thread_reads FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.chat_threads t
      WHERE t.id = thread_id
        AND t.company_id = public.get_user_company_id(auth.uid())
        AND (
          public.has_role(auth.uid(), 'owner')
          OR public.has_role(auth.uid(), 'admin')
          OR public.has_role(auth.uid(), 'office_staff')
          OR (
            public.has_role(auth.uid(), 'technician')
            AND t.technician_id = public.get_user_technician_id(auth.uid())
          )
        )
    )
  );

DROP POLICY IF EXISTS "Users can upsert own chat read state" ON public.chat_thread_reads;
CREATE POLICY "Users can upsert own chat read state"
  ON public.chat_thread_reads FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.chat_threads t
      WHERE t.id = thread_id
        AND t.company_id = public.get_user_company_id(auth.uid())
        AND (
          public.has_role(auth.uid(), 'owner')
          OR public.has_role(auth.uid(), 'admin')
          OR public.has_role(auth.uid(), 'office_staff')
          OR (
            public.has_role(auth.uid(), 'technician')
            AND t.technician_id = public.get_user_technician_id(auth.uid())
          )
        )
    )
  );

DROP POLICY IF EXISTS "Users can update own chat read state" ON public.chat_thread_reads;
CREATE POLICY "Users can update own chat read state"
  ON public.chat_thread_reads FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Touch thread updated_at when a message is sent.
CREATE OR REPLACE FUNCTION public.touch_chat_thread()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.chat_threads SET updated_at = now() WHERE id = NEW.thread_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_chat_thread ON public.chat_messages;
CREATE TRIGGER trg_touch_chat_thread
  AFTER INSERT ON public.chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_chat_thread();

-- Notifications for chat messages (best-effort, used by in-app + device notifications).
CREATE OR REPLACE FUNCTION public.notify_chat_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _tech_id uuid;
  _tech_user_id uuid;
BEGIN
  SELECT technician_id INTO _tech_id FROM public.chat_threads WHERE id = NEW.thread_id;
  IF _tech_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF public.has_role(NEW.sender_user_id, 'technician') THEN
    -- Notify all company staff (owner/admin/office_staff)
    INSERT INTO public.notifications (user_id, company_id, type, title, body, metadata)
    SELECT p.user_id,
           NEW.company_id,
           'chat_message',
           'New message from technician',
           left(NEW.body, 180),
           jsonb_build_object('chat_thread_id', NEW.thread_id, 'technician_id', _tech_id)
    FROM public.profiles p
    JOIN public.user_roles ur ON ur.user_id = p.user_id
    WHERE p.company_id = NEW.company_id
      AND ur.role IN ('owner', 'admin', 'office_staff');
  ELSE
    -- Notify the technician (if linked to a user account)
    SELECT user_id INTO _tech_user_id FROM public.technicians WHERE id = _tech_id;
    IF _tech_user_id IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, company_id, type, title, body, metadata)
      VALUES (
        _tech_user_id,
        NEW.company_id,
        'chat_message',
        'New message from admin',
        left(NEW.body, 180),
        jsonb_build_object('chat_thread_id', NEW.thread_id)
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_chat_message ON public.chat_messages;
CREATE TRIGGER trg_notify_chat_message
  AFTER INSERT ON public.chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_chat_message();

-- Realtime
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_threads;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_thread_reads;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;

