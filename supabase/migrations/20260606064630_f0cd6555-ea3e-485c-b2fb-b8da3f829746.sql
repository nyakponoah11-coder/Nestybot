
CREATE TABLE public.referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  owner_phone text NOT NULL,
  redemptions_count integer NOT NULL DEFAULT 0,
  reward_sent boolean NOT NULL DEFAULT false,
  reward_reference text,
  reward_sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX referrals_owner_phone_idx ON public.referrals(owner_phone);

CREATE TABLE public.referral_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_id uuid NOT NULL REFERENCES public.referrals(id) ON DELETE CASCADE,
  friend_phone text NOT NULL UNIQUE,
  order_reference text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX referral_redemptions_referral_idx ON public.referral_redemptions(referral_id);

GRANT ALL ON public.referrals TO service_role;
GRANT ALL ON public.referral_redemptions TO service_role;

ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_redemptions ENABLE ROW LEVEL SECURITY;
