-- ====================================================================
-- RESTORE SETTINGS ACCESS FOR SERVERLESS BACKEND APIS & CREATE SMS_LOGS
-- ====================================================================

-- 1. Restore settings read policy so backend APIs (Paystack, Webhook, Notifications)
-- can read provider configuration keys without being blocked by RLS.
DROP POLICY IF EXISTS "public read safe settings only" ON public.settings;
DROP POLICY IF EXISTS "anyone reads settings" ON public.settings;

CREATE POLICY "anyone reads settings" ON public.settings
  FOR SELECT TO anon, authenticated
  USING (true);

-- 2. Create SMS Notifications Logs table (24-Hour retention)
CREATE TABLE IF NOT EXISTS public.sms_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient text NOT NULL,
  message text NOT NULL,
  sender_id text DEFAULT 'D_1Gh',
  reference text,
  status text NOT NULL DEFAULT 'sent', -- 'sent', 'failed'
  error text,
  type text DEFAULT 'payment_issue', -- 'payment_issue', 'payment_received', 'order_status', 'bulk_sms', 'test'
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sms_logs_created_at ON public.sms_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sms_logs_reference ON public.sms_logs (reference);
CREATE INDEX IF NOT EXISTS idx_sms_logs_recipient ON public.sms_logs (recipient);

-- Enable RLS
ALTER TABLE public.sms_logs ENABLE ROW LEVEL SECURITY;

-- Allow reading and inserting
DROP POLICY IF EXISTS "anyone read sms_logs" ON public.sms_logs;
CREATE POLICY "anyone read sms_logs" ON public.sms_logs
  FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "anyone insert sms_logs" ON public.sms_logs;
CREATE POLICY "anyone insert sms_logs" ON public.sms_logs
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "admins manage sms_logs" ON public.sms_logs;
CREATE POLICY "admins manage sms_logs" ON public.sms_logs
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);
