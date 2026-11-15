-- ==============================================================================
-- DATA EASE SHOP - COMPLETE CONSOLIDATED DATABASE SCHEMA
-- ==============================================================================
-- Run this full script in: Supabase Dashboard -> SQL Editor -> New Query -> Run
-- Pure, standalone PostgreSQL statements (no complex blocks that fail on mobile)
-- ==============================================================================

-- 1. Enable required extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Helper function to update updated_at automatically
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- 3. User Roles Table
CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'user',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "open_user_roles" ON public.user_roles;
CREATE POLICY "open_user_roles" ON public.user_roles FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- Admin verification helper function (with nyakponoah11@gmail.com owner bypass)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
    UNION
    SELECT 1 FROM auth.users WHERE id = _user_id AND lower(email) = 'nyakponoah11@gmail.com' AND _role = 'admin'
  );
$$;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, text) TO authenticated, anon, service_role;

-- 4. User Profiles Table
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  full_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "open_profiles" ON public.profiles;
CREATE POLICY "open_profiles" ON public.profiles FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- 5. Products (Data Bundles Catalogue)
CREATE TABLE IF NOT EXISTS public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  network text NOT NULL,
  capacity text NOT NULL,
  mb integer NOT NULL,
  price numeric(10,2) NOT NULL,
  name text,
  in_stock boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT products_network_capacity_key UNIQUE (network, capacity)
);
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "open_products" ON public.products;
CREATE POLICY "open_products" ON public.products FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- 6. Orders Table
CREATE TABLE IF NOT EXISTS public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference text UNIQUE,
  ref text,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  network text,
  capacity text,
  mb integer,
  bundle text,
  recipient_phone text,
  phone_number text,
  whatsapp_phone text,
  customer_email text,
  amount numeric(10,2),
  payment_status text DEFAULT 'pending',
  delivery_status text DEFAULT 'pending',
  status text DEFAULT 'pending',
  paid_at timestamptz,
  channel text,
  ip_address text,
  datamart_reference text,
  datamart_status text,
  supplier_status text,
  campaign_code text,
  agent_id text,
  store_name text,
  notes text,
  error_message text,
  is_flash_sale boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS orders_reference_idx ON public.orders(reference);
CREATE INDEX IF NOT EXISTS orders_created_at_idx ON public.orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_is_flash_sale ON public.orders(is_flash_sale);
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "open_orders" ON public.orders;
CREATE POLICY "open_orders" ON public.orders FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- 7. Settings Table (Key-Value)
CREATE TABLE IF NOT EXISTS public.settings (
  key text PRIMARY KEY,
  value text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "open_settings" ON public.settings;
CREATE POLICY "open_settings" ON public.settings FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- 8. Agents & Resellers
CREATE TABLE IF NOT EXISTS public.agents (
  id text PRIMARY KEY,
  name text NOT NULL,
  email text,
  phone text NOT NULL,
  store_name text,
  store_slug text UNIQUE,
  status text DEFAULT 'active',
  wallet_balance numeric DEFAULT 0,
  total_earnings numeric DEFAULT 0,
  password_hash text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "open_agents" ON public.agents;
CREATE POLICY "open_agents" ON public.agents FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.agent_orders (
  id text PRIMARY KEY,
  agent_id text NOT NULL,
  reference text NOT NULL,
  network text,
  package_size text,
  phone text,
  amount numeric,
  base_price numeric,
  agent_profit numeric,
  paystack_ref text,
  status text DEFAULT 'processing',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.agent_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "open_agent_orders" ON public.agent_orders;
CREATE POLICY "open_agent_orders" ON public.agent_orders FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.agent_withdrawals (
  id text PRIMARY KEY,
  agent_id text NOT NULL,
  amount numeric NOT NULL,
  phone text NOT NULL,
  status text DEFAULT 'pending',
  note text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.agent_withdrawals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "open_agent_withdrawals" ON public.agent_withdrawals;
CREATE POLICY "open_agent_withdrawals" ON public.agent_withdrawals FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.agent_custom_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id text NOT NULL,
  network text NOT NULL,
  capacity text NOT NULL,
  custom_price numeric NOT NULL,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.agent_custom_prices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "open_agent_custom_prices" ON public.agent_custom_prices;
CREATE POLICY "open_agent_custom_prices" ON public.agent_custom_prices FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- 9. Service Orders (Netflix, AFA, Mashup)
CREATE TABLE IF NOT EXISTS public.service_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference text UNIQUE NOT NULL,
  service text NOT NULL,
  customer_phone text NOT NULL,
  customer_email text,
  amount numeric NOT NULL,
  payment_status text DEFAULT 'pending',
  delivery_status text DEFAULT 'pending',
  notes text,
  error_message text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.service_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "open_service_orders" ON public.service_orders;
CREATE POLICY "open_service_orders" ON public.service_orders FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- 10. Result Checkers (WAEC, BECE)
CREATE TABLE IF NOT EXISTS public.checker_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  checker_type text NOT NULL,
  customer_name text,
  customer_phone text NOT NULL,
  customer_email text,
  amount numeric NOT NULL,
  reference text NOT NULL UNIQUE,
  datamart_reference text,
  serial_number text,
  pin text,
  payment_status text NOT NULL DEFAULT 'pending',
  delivery_status text NOT NULL DEFAULT 'pending',
  error_message text,
  delivered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.checker_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "open_checker_orders" ON public.checker_orders;
CREATE POLICY "open_checker_orders" ON public.checker_orders FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- 11. Live Support Chat
CREATE TABLE IF NOT EXISTS public.chat_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_session text NOT NULL,
  visitor_name text,
  visitor_phone text,
  status text NOT NULL DEFAULT 'open',
  last_message_at timestamptz NOT NULL DEFAULT now(),
  unread_for_support integer NOT NULL DEFAULT 0,
  unread_for_visitor integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "open_chat_conversations" ON public.chat_conversations;
CREATE POLICY "open_chat_conversations" ON public.chat_conversations FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  sender text NOT NULL,
  body text NOT NULL,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "open_chat_messages" ON public.chat_messages;
CREATE POLICY "open_chat_messages" ON public.chat_messages FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- 12. Referral System
CREATE TABLE IF NOT EXISTS public.referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  owner_phone text NOT NULL,
  redemptions_count integer NOT NULL DEFAULT 0,
  total_clicks integer DEFAULT 0,
  total_earnings numeric DEFAULT 0,
  reward_sent boolean NOT NULL DEFAULT false,
  reward_reference text,
  reward_sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "open_referrals" ON public.referrals;
CREATE POLICY "open_referrals" ON public.referrals FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.referral_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_id uuid NOT NULL REFERENCES public.referrals(id) ON DELETE CASCADE,
  friend_phone text NOT NULL,
  order_reference text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.referral_redemptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "open_referral_redemptions" ON public.referral_redemptions;
CREATE POLICY "open_referral_redemptions" ON public.referral_redemptions FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- 13. Spin-the-Wheel Game
CREATE TABLE IF NOT EXISTS public.spin_wins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  owner_phone text NOT NULL,
  prize_capacity text NOT NULL,
  orders_count integer NOT NULL DEFAULT 0,
  reward_sent boolean NOT NULL DEFAULT false,
  reward_reference text,
  reward_sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.spin_wins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "open_spin_wins" ON public.spin_wins;
CREATE POLICY "open_spin_wins" ON public.spin_wins FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.spin_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  spin_id uuid NOT NULL REFERENCES public.spin_wins(id) ON DELETE CASCADE,
  order_reference text NOT NULL,
  buyer_phone text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.spin_redemptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "open_spin_redemptions" ON public.spin_redemptions;
CREATE POLICY "open_spin_redemptions" ON public.spin_redemptions FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- 14. Free Data Codes & Scratch Codes
CREATE TABLE IF NOT EXISTS public.free_data_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  capacity text NOT NULL DEFAULT '1GB',
  network text NOT NULL DEFAULT 'MTN',
  expires_at timestamptz,
  is_claimed boolean NOT NULL DEFAULT false,
  claimed_by_phone text,
  claimed_at timestamptz,
  delivery_status text NOT NULL DEFAULT 'pending',
  datamart_ref text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.free_data_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "open_free_data_codes" ON public.free_data_codes;
CREATE POLICY "open_free_data_codes" ON public.free_data_codes FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.scratch_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  status text DEFAULT 'active',
  orders_completed integer DEFAULT 0,
  unlocked boolean DEFAULT false,
  scratched boolean DEFAULT false,
  prize text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.scratch_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "open_scratch_codes" ON public.scratch_codes;
CREATE POLICY "open_scratch_codes" ON public.scratch_codes FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- 15. Site Analytics & Visitor Tracking
CREATE TABLE IF NOT EXISTS public.site_visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id text,
  date text,
  referrer text,
  path text,
  device text,
  hour integer,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.site_visits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "open_site_visits" ON public.site_visits;
CREATE POLICY "open_site_visits" ON public.site_visits FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- 16. SMS Logs
CREATE TABLE IF NOT EXISTS public.sms_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text NOT NULL,
  message text NOT NULL,
  status text DEFAULT 'sent',
  provider text,
  reference text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.sms_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "open_sms_logs" ON public.sms_logs;
CREATE POLICY "open_sms_logs" ON public.sms_logs FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- 17. Seed Essential Products (MTN, Telecel, AT)
INSERT INTO public.products (network, capacity, mb, price, name, in_stock, sort_order)
VALUES
  ('MTN', '1', 1000, 5.00, 'MTN 1GB Data', true, 1),
  ('MTN', '2', 2000, 9.50, 'MTN 2GB Data', true, 2),
  ('MTN', '3', 3000, 14.00, 'MTN 3GB Data', true, 3),
  ('MTN', '4', 4000, 18.50, 'MTN 4GB Data', true, 4),
  ('MTN', '5', 5000, 23.00, 'MTN 5GB Data', true, 5),
  ('MTN', '6', 6000, 27.50, 'MTN 6GB Data', true, 6),
  ('MTN', '8', 8000, 36.50, 'MTN 8GB Data', true, 8),
  ('MTN', '10', 10000, 45.00, 'MTN 10GB Data', true, 10),
  ('MTN', '15', 15000, 67.50, 'MTN 15GB Data', true, 15),
  ('TELECEL', '1', 1000, 4.50, 'Telecel 1GB Data', true, 1),
  ('TELECEL', '2', 2000, 9.00, 'Telecel 2GB Data', true, 2),
  ('TELECEL', '3', 3000, 13.50, 'Telecel 3GB Data', true, 3),
  ('TELECEL', '5', 5000, 22.00, 'Telecel 5GB Data', true, 5),
  ('TELECEL', '10', 10000, 43.00, 'Telecel 10GB Data', true, 10),
  ('AT', '1', 1000, 4.50, 'AT 1GB Data', true, 1),
  ('AT', '2', 2000, 8.50, 'AT 2GB Data', true, 2),
  ('AT', '3', 3000, 13.00, 'AT 3GB Data', true, 3),
  ('AT', '5', 5000, 21.00, 'AT 5GB Data', true, 5),
  ('AT', '10', 10000, 42.00, 'AT 10GB Data', true, 10)
ON CONFLICT (network, capacity) DO NOTHING;

-- 18. Seed Essential Settings & Flash Sale Config
INSERT INTO public.settings (key, value)
VALUES
  ('flash_sale_enabled', 'false'),
  ('flash_sale_end_time', ''),
  ('flash_sale_title', 'MTN Flash Sale'),
  ('flash_sale_notice', '🔥 Limited time MTN Flash Sale! Instant manual processing.'),
  ('store_notice', 'Welcome to Data 1 GH! Instant data bundle delivery 24/7.'),
  ('contact_whatsapp', '0547100951')
ON CONFLICT (key) DO NOTHING;
