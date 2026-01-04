-- Fix the plans table UPDATE policy to include WITH CHECK
-- The current policy only has USING, missing the WITH CHECK clause

DROP POLICY IF EXISTS plans_update_platform_admin ON public.plans;

CREATE POLICY plans_update_platform_admin ON public.plans
FOR UPDATE
USING (is_platform_admin(auth.uid()))
WITH CHECK (is_platform_admin(auth.uid()));