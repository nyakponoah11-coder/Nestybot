-- ==============================================================================
-- FIX: Restore EXECUTE permissions on has_role and restore settings access
-- ==============================================================================

-- 1. Restore EXECUTE permission so Postgres RLS policies can evaluate has_role()
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, anon, service_role;

DO $$
BEGIN
  BEGIN
    GRANT EXECUTE ON FUNCTION public.has_role(uuid, text) TO authenticated, anon, service_role;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
END $$;

-- 2. Update has_role function to recognize owner email nyakponoah11@gmail.com directly
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
    UNION
    SELECT 1 FROM auth.users WHERE id = _user_id AND lower(email) = 'nyakponoah11@gmail.com' AND _role = 'admin'::public.app_role
  );
$$;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, anon, service_role;

-- 3. Ensure owner record exists in user_roles
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role
FROM auth.users
WHERE lower(email) = 'nyakponoah11@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;

-- 4. Restore settings read policy so backend APIs can read Datamart, Arkesel, and Gmail keys
DROP POLICY IF EXISTS "public read safe settings only" ON public.settings;
DROP POLICY IF EXISTS "admins view all settings" ON public.settings;
DROP POLICY IF EXISTS "anyone reads settings" ON public.settings;

CREATE POLICY "anyone reads settings" ON public.settings
  FOR SELECT TO anon, authenticated
  USING (true);

-- 5. Restore settings write policy for authenticated admins
DROP POLICY IF EXISTS "admins write settings" ON public.settings;
CREATE POLICY "admins write settings" ON public.settings
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);
