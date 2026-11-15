DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='realtime' AND tablename='messages')
     AND NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='realtime' AND tablename='messages' AND policyname='deny_broadcast_presence_to_clients') THEN
    EXECUTE 'CREATE POLICY "deny_broadcast_presence_to_clients" ON realtime.messages FOR ALL TO authenticated, anon USING (false) WITH CHECK (false)';
  END IF;
END $$;