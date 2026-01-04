-- Add SELECT policy so platform admins can read ALL plans (including inactive)
CREATE POLICY plans_select_platform_admin ON public.plans
FOR SELECT TO authenticated
USING (public.is_platform_admin(auth.uid()));