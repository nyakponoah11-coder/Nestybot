-- Add missing columns to public.orders so payment metadata updates never fail
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS paid_at timestamptz;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS channel text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS ip_address text;
