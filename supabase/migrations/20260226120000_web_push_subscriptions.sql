-- Web Push subscriptions (for PWA background notifications on Android/iOS/desktop)
--
-- Stores the PushSubscription endpoint + keys per user so an Edge Function can
-- send encrypted Web Push messages using VAPID.

CREATE TABLE IF NOT EXISTS public.web_push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, endpoint)
);

CREATE INDEX IF NOT EXISTS web_push_subscriptions_user_id_idx ON public.web_push_subscriptions(user_id);

ALTER TABLE public.web_push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own web push subscriptions" ON public.web_push_subscriptions;
CREATE POLICY "Users can view own web push subscriptions"
  ON public.web_push_subscriptions
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can create own web push subscriptions" ON public.web_push_subscriptions;
CREATE POLICY "Users can create own web push subscriptions"
  ON public.web_push_subscriptions
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own web push subscriptions" ON public.web_push_subscriptions;
CREATE POLICY "Users can update own web push subscriptions"
  ON public.web_push_subscriptions
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete own web push subscriptions" ON public.web_push_subscriptions;
CREATE POLICY "Users can delete own web push subscriptions"
  ON public.web_push_subscriptions
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

DROP TRIGGER IF EXISTS update_web_push_subscriptions_updated_at ON public.web_push_subscriptions;
CREATE TRIGGER update_web_push_subscriptions_updated_at
  BEFORE UPDATE ON public.web_push_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

