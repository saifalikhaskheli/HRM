-- Fix domain insertion RLS: make policy apply to all roles but still require auth via auth.uid()
DROP POLICY IF EXISTS "company_domains_insert_admin" ON public.company_domains;
DROP POLICY IF EXISTS "company_domains_insert_platform" ON public.company_domains;

CREATE POLICY "company_domains_insert_allowed"
ON public.company_domains
FOR INSERT
TO public
WITH CHECK (
  public.is_platform_admin(auth.uid())
  OR public.is_active_company_admin(auth.uid(), company_id)
);