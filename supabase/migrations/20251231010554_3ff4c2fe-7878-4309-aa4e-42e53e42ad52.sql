-- Create function to get company's primary domain URL
-- Used for redirecting users after login from base domain
CREATE OR REPLACE FUNCTION public.get_company_primary_domain(_company_id uuid)
RETURNS TABLE(domain_url text, domain_type text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
    SELECT 
        CASE 
            WHEN cd.custom_domain IS NOT NULL THEN 
                'https://' || cd.custom_domain
            WHEN cd.subdomain IS NOT NULL THEN 
                'https://' || cd.subdomain || '.thefruitbazaar.com'
            ELSE NULL
        END as domain_url,
        CASE 
            WHEN cd.custom_domain IS NOT NULL THEN 'custom'
            WHEN cd.subdomain IS NOT NULL THEN 'subdomain'
            ELSE NULL
        END as domain_type
    FROM public.company_domains cd
    WHERE cd.company_id = _company_id
      AND cd.is_primary = true
      AND cd.is_active = true
      AND (
          -- For subdomains, they're always "verified"
          cd.subdomain IS NOT NULL
          -- For custom domains, must be verified
          OR (cd.custom_domain IS NOT NULL AND cd.is_verified = true)
      )
    LIMIT 1;
$$;