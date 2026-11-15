
CREATE TABLE public.service_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  service TEXT NOT NULL CHECK (service IN ('netflix','afa')),
  customer_email TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_name TEXT,
  amount NUMERIC NOT NULL,
  reference TEXT NOT NULL UNIQUE,
  payment_status TEXT NOT NULL DEFAULT 'pending',
  delivery_status TEXT NOT NULL DEFAULT 'pending',
  netflix_login_expires_at TIMESTAMPTZ,
  netflix_last_code TEXT,
  netflix_last_code_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_orders TO authenticated;
GRANT ALL ON public.service_orders TO service_role;

ALTER TABLE public.service_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage service orders"
  ON public.service_orders FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER touch_service_orders_updated_at
  BEFORE UPDATE ON public.service_orders
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX service_orders_created_at_idx ON public.service_orders (created_at DESC);
CREATE INDEX service_orders_service_idx ON public.service_orders (service);

INSERT INTO public.settings (key, value) VALUES ('promo_enabled','true')
ON CONFLICT (key) DO NOTHING;
