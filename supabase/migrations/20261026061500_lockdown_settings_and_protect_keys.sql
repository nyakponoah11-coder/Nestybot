-- ====================================================================
-- EMERGENCY SECURITY LOCKDOWN: PROTECT SENSITIVE API KEYS IN SETTINGS
-- Prevents public anonymous users from reading provider keys (DataMart, Paystack, Arkesel, Gmail)
-- ====================================================================

ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- 1. Drop dangerous open policies that leaked secret keys to public
DROP POLICY IF EXISTS "anyone reads settings" ON public.settings;
DROP POLICY IF EXISTS "public read safe settings only" ON public.settings;
DROP POLICY IF EXISTS "admins view all settings" ON public.settings;
DROP POLICY IF EXISTS "admins write settings" ON public.settings;

-- 2. Public / Anon users can ONLY read safe storefront UI settings
CREATE POLICY "public read safe settings only" ON public.settings
  FOR SELECT TO anon, authenticated
  USING (
    lower(key) IN (
      'shop_name',
      'store_name',
      'whatsapp_bot_url',
      'whatsapp_channel_url',
      'support_chat_url',
      'support_phone',
      'announcement_enabled',
      'announcement_title',
      'announcement_message',
      'promo_enabled',
      'spin_game_enabled',
      'free_data_enabled',
      'apk_download_url',
      'netflix_price',
      'afa_price',
      'mashup_price',
      'theme_primary_color',
      'theme_accent_color',
      'custom_domain',
      'maintenance_mode'
    )
  );

-- 3. Authenticated administrators can read all settings
CREATE POLICY "admins view all settings" ON public.settings
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 4. Only authenticated administrators can write or update settings
CREATE POLICY "admins write settings" ON public.settings
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
