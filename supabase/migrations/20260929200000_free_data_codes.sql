-- Create Free Data Codes table for voucher giveaways and DataMart direct fulfillment
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

CREATE INDEX IF NOT EXISTS idx_free_data_codes_code ON public.free_data_codes(code);
CREATE INDEX IF NOT EXISTS idx_free_data_codes_status ON public.free_data_codes(is_claimed, delivery_status);

ALTER TABLE public.free_data_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can claim and view free data codes" ON public.free_data_codes;
CREATE POLICY "Public can claim and view free data codes" ON public.free_data_codes
  FOR ALL TO anon, authenticated
  USING (true)
  WITH CHECK (true);

INSERT INTO public.settings (key, value)
VALUES ('free_data_enabled', 'false')
ON CONFLICT (key) DO NOTHING;
