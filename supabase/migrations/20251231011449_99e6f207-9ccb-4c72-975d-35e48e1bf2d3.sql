-- The issue is that the UPDATE policy is RESTRICTIVE (not PERMISSIVE)
-- Drop and recreate as PERMISSIVE policy

DROP POLICY IF EXISTS plans_update_platform_admin ON public.plans;

CREATE POLICY plans_update_platform_admin ON public.plans
FOR UPDATE TO authenticated
USING (is_platform_admin(auth.uid()))
WITH CHECK (is_platform_admin(auth.uid()));