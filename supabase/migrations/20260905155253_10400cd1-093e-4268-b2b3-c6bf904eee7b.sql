GRANT SELECT ON public.spin_wins TO authenticated;
GRANT SELECT ON public.spin_redemptions TO authenticated;

CREATE POLICY "Admins can view spin wins" ON public.spin_wins
FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can view spin redemptions" ON public.spin_redemptions
FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));