-- Create a secure function to get company branding for a given hostname
-- This allows anonymous users to get minimal branding info for login pages
CREATE OR REPLACE FUNCTION public.get_company_branding_for_domain(hostname text)
RETURNS TABLE (
    id uuid,
    name text,
    slug text,
    logo_url text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT 
        c.id,
        c.name,
        c.slug,
        c.logo_url
    FROM public.company_domains cd
    JOIN public.companies c ON c.id = cd.company_id
    WHERE 
        cd.is_active = true
        AND c.is_active = true
        AND (
            -- Match subdomain (e.g., 'saif' from 'saif.thefruitbazaar.com')
            cd.subdomain = hostname
            -- Or match full custom domain
            OR (cd.custom_domain = hostname AND cd.is_verified = true)
        )
    LIMIT 1;
$$;

-- Grant execute permission to anonymous and authenticated users
GRANT EXECUTE ON FUNCTION public.get_company_branding_for_domain(text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_company_branding_for_domain(text) TO authenticated;