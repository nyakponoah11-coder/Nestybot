-- Chat conversations
CREATE TABLE public.chat_conversations (
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
CREATE INDEX idx_chat_conv_session ON public.chat_conversations(visitor_session);
CREATE INDEX idx_chat_conv_last ON public.chat_conversations(last_message_at DESC);

CREATE TABLE public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  sender text NOT NULL CHECK (sender IN ('visitor','support')),
  body text NOT NULL,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_chat_msg_conv ON public.chat_messages(conversation_id, created_at);

ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "support read conversations" ON public.chat_conversations
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'support'));

CREATE POLICY "support read messages" ON public.chat_messages
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'support'));

ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
ALTER TABLE public.chat_conversations REPLICA IDENTITY FULL;
ALTER TABLE public.chat_messages REPLICA IDENTITY FULL;

CREATE TRIGGER trg_chat_conv_touch BEFORE UPDATE ON public.chat_conversations
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Security fixes
DROP POLICY IF EXISTS "anyone view orders" ON public.orders;
CREATE POLICY "staff view orders" ON public.orders
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'support'));

CREATE POLICY "only admins insert roles" ON public.user_roles
  AS RESTRICTIVE FOR INSERT TO authenticated, anon
  WITH CHECK (public.has_role(auth.uid(),'admin'));