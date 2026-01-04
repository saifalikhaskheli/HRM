-- Drop the existing RESTRICTIVE INSERT policies
DROP POLICY IF EXISTS "company_domains_insert_admin" ON public.company_domains;
DROP POLICY IF EXISTS "company_domains_insert_platform" ON public.company_domains;

-- Recreate as PERMISSIVE policies (either company admin OR platform admin can insert)
CREATE POLICY "company_domains_insert_admin" 
ON public.company_domains 
FOR INSERT 
TO authenticated
WITH CHECK (is_active_company_admin(auth.uid(), company_id));

CREATE POLICY "company_domains_insert_platform" 
ON public.company_domains 
FOR INSERT 
TO authenticated
WITH CHECK (is_platform_admin(auth.uid()));