CREATE TABLE public.checker_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  checker_type text NOT NULL CHECK (checker_type IN ('WAEC','BECE')),
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
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.checker_orders TO service_role;

ALTER TABLE public.checker_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view checker orders"
ON public.checker_orders FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_checker_orders_updated_at
BEFORE UPDATE ON public.checker_orders
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();