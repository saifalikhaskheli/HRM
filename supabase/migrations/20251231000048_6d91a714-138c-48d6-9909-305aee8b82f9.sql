-- Fix SELECT RLS on company_domains to allow company members to see their own domains (including inactive/unverified)
-- This fixes the INSERT...RETURNING failure when adding new domains with is_active=false

-- Drop the problematic public policy that only shows active domains
DROP POLICY IF EXISTS "company_domains_select_public" ON public.company_domains;

-- Create a new SELECT policy for company members to see their own company's domains
CREATE POLICY "company_domains_select_company_member"
ON public.company_domains
FOR SELECT
TO public
USING (
  public.is_company_member(auth.uid(), company_id)
  OR public.has_valid_support_access(auth.uid(), company_id)
);