CREATE TABLE public.spin_wins (
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

CREATE TABLE public.spin_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  spin_id uuid NOT NULL REFERENCES public.spin_wins(id) ON DELETE CASCADE,
  order_reference text NOT NULL UNIQUE,
  buyer_phone text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.spin_wins TO service_role;
GRANT ALL ON public.spin_redemptions TO service_role;

ALTER TABLE public.spin_wins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spin_redemptions ENABLE ROW LEVEL SECURITY;