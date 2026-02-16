
-- Fix the overly permissive INSERT policy - restrict to service role / triggers only
DROP POLICY "Service role can insert notifications" ON public.notifications;

-- Only allow inserts where user_id matches the authenticated user OR via SECURITY DEFINER triggers
CREATE POLICY "System can insert notifications"
  ON public.notifications FOR INSERT
  WITH CHECK (user_id = auth.uid());
