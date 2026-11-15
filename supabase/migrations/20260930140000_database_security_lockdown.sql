-- ==============================================================================
-- DATABASE SECURITY LOCKDOWN & ANTI-TAMPER RLS MIGRATION
-- DATA 1 GH Database Protection
-- ==============================================================================

-- 1. ORDERS TABLE LOCKDOWN
-- Prevent public access to customer order history, amounts, and phone numbers.
-- Prevent anonymous users from marking orders as paid or tampering with status.
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anyone can view orders" ON public.orders;
DROP POLICY IF EXISTS "anyone view orders" ON public.orders;
DROP POLICY IF EXISTS "anyone can update orders" ON public.orders;
DROP POLICY IF EXISTS "anyone can insert orders" ON public.orders;
DROP POLICY IF EXISTS "staff view orders" ON public.orders;
DROP POLICY IF EXISTS "admins and support view orders" ON public.orders;
DROP POLICY IF EXISTS "admins update orders" ON public.orders;
DROP POLICY IF EXISTS "admins insert orders" ON public.orders;
DROP POLICY IF EXISTS "admins delete orders" ON public.orders;

-- Only authenticated admins and support staff can view all orders
CREATE POLICY "admins and support view orders" ON public.orders
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'support'));

-- Only authenticated admins can modify orders
CREATE POLICY "admins update orders" ON public.orders
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Only authenticated admins can insert or delete orders directly
CREATE POLICY "admins insert orders" ON public.orders
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admins delete orders" ON public.orders
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));


-- 2. SETTINGS TABLE LOCKDOWN (PROTECT SECRET API KEYS)
-- Never allow anonymous callers to read Paystack Secret Keys, Arkesel SMS keys,
-- Gemini API keys, or admin phone numbers!
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anyone reads settings" ON public.settings;
DROP POLICY IF EXISTS "public read safe settings only" ON public.settings;
DROP POLICY IF EXISTS "admins view all settings" ON public.settings;
DROP POLICY IF EXISTS "admins write settings" ON public.settings;

-- Public users can ONLY read non-sensitive storefront display settings
CREATE POLICY "public read safe settings only" ON public.settings
  FOR SELECT TO anon
  USING (
    key IN (
      'shop_name',
      'whatsapp_channel_url',
      'whatsapp_bot_url',
      'support_phone',
      'support_chat_url',
      'promo_enabled',
      'announcement_enabled',
      'announcement_title',
      'announcement_message',
      'netflix_price',
      'afa_price',
      'mashup_price',
      'waec_price',
      'bece_price',
      'spin_game_enabled',
      'free_data_enabled'
    )
  );

-- Only authenticated admins can view all settings (including private keys)
CREATE POLICY "admins view all settings" ON public.settings
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Only authenticated admins can update or insert settings
CREATE POLICY "admins write settings" ON public.settings
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));


-- 3. CHECKER & SERVICE ORDERS LOCKDOWN
-- Ensure Result Checker PINs/Serials and Netflix accounts are not publicly dumpable
ALTER TABLE public.checker_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can view checker orders" ON public.checker_orders;
DROP POLICY IF EXISTS "anyone view checker orders" ON public.checker_orders;

CREATE POLICY "Admins can view checker orders" ON public.checker_orders
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

ALTER TABLE public.service_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can manage service orders" ON public.service_orders;
DROP POLICY IF EXISTS "anyone view service orders" ON public.service_orders;

CREATE POLICY "Admins can manage service orders" ON public.service_orders
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));


-- 4. USER ROLES PRIVILEGE ESCALATION PREVENTION
-- Ensure regular users or anonymous visitors cannot grant themselves the admin role
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "only admins insert roles" ON public.user_roles;
CREATE POLICY "only admins insert roles" ON public.user_roles
  AS RESTRICTIVE FOR INSERT TO authenticated, anon
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "only admins update roles" ON public.user_roles;
CREATE POLICY "only admins update roles" ON public.user_roles
  AS RESTRICTIVE FOR UPDATE TO authenticated, anon
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "only admins delete roles" ON public.user_roles;
CREATE POLICY "only admins delete roles" ON public.user_roles
  AS RESTRICTIVE FOR DELETE TO authenticated, anon
  USING (public.has_role(auth.uid(), 'admin'));


-- 5. LIVE CHAT PRIVACY LOCKDOWN
-- Customers only communicate through backend chat API which enforces visitor session token.
-- Direct table queries are restricted to staff.
ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "support read conversations" ON public.chat_conversations;
CREATE POLICY "support read conversations" ON public.chat_conversations
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'support'));

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "support read messages" ON public.chat_messages;
CREATE POLICY "support read messages" ON public.chat_messages
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'support'));
