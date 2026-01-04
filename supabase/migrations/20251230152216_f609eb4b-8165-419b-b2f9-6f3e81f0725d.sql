-- Backfill subdomains for existing companies that don't have a domain entry
INSERT INTO public.company_domains (company_id, subdomain, is_primary, is_verified, is_active)
SELECT 
  c.id,
  SPLIT_PART(c.slug, '-', 1),
  true,
  true,
  true
FROM public.companies c
WHERE NOT EXISTS (
  SELECT 1 FROM public.company_domains cd WHERE cd.company_id = c.id
);