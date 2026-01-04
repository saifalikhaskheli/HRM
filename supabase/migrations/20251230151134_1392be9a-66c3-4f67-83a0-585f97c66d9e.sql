-- Create company_domains table
CREATE TABLE public.company_domains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  
  -- Subdomain (auto-generated): rivex.hrplatform.com
  subdomain TEXT UNIQUE,
  
  -- Custom domain: hr.rivex.com
  custom_domain TEXT UNIQUE,
  
  -- Domain verification
  verification_token TEXT,
  is_verified BOOLEAN DEFAULT false,
  verified_at TIMESTAMPTZ,
  
  -- Status
  is_primary BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  CONSTRAINT check_has_domain CHECK (
    subdomain IS NOT NULL OR custom_domain IS NOT NULL
  )
);

-- Indexes for fast domain lookups
CREATE INDEX idx_company_domains_subdomain ON public.company_domains(subdomain) WHERE subdomain IS NOT NULL;
CREATE INDEX idx_company_domains_custom ON public.company_domains(custom_domain) WHERE custom_domain IS NOT NULL;
CREATE INDEX idx_company_domains_company ON public.company_domains(company_id);

-- Enable RLS
ALTER TABLE public.company_domains ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Anyone can look up domains (needed for auth page detection)
CREATE POLICY "company_domains_select_public" ON public.company_domains
  FOR SELECT USING (is_active = true);

-- Company admins can manage their domains
CREATE POLICY "company_domains_insert_admin" ON public.company_domains
  FOR INSERT WITH CHECK (is_active_company_admin(auth.uid(), company_id));

CREATE POLICY "company_domains_update_admin" ON public.company_domains
  FOR UPDATE USING (is_active_company_admin(auth.uid(), company_id))
  WITH CHECK (is_active_company_admin(auth.uid(), company_id));

CREATE POLICY "company_domains_delete_admin" ON public.company_domains
  FOR DELETE USING (is_active_company_admin(auth.uid(), company_id));

-- Platform admins can manage all domains
CREATE POLICY "company_domains_select_platform" ON public.company_domains
  FOR SELECT USING (is_platform_admin(auth.uid()));

CREATE POLICY "company_domains_insert_platform" ON public.company_domains
  FOR INSERT WITH CHECK (is_platform_admin(auth.uid()));

CREATE POLICY "company_domains_update_platform" ON public.company_domains
  FOR UPDATE USING (is_platform_admin(auth.uid()))
  WITH CHECK (is_platform_admin(auth.uid()));

CREATE POLICY "company_domains_delete_platform" ON public.company_domains
  FOR DELETE USING (is_platform_admin(auth.uid()));

-- Updated at trigger
CREATE TRIGGER update_company_domains_updated_at
  BEFORE UPDATE ON public.company_domains
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert platform base domain setting
INSERT INTO public.platform_settings (key, value, description)
VALUES ('base_domain', '"hrplatform.com"', 'Base domain for company subdomains')
ON CONFLICT (key) DO NOTHING;

-- Create subdomains for existing companies
INSERT INTO public.company_domains (company_id, subdomain, is_primary, is_verified)
SELECT id, slug, true, true
FROM public.companies
WHERE NOT EXISTS (
  SELECT 1 FROM public.company_domains WHERE company_id = companies.id
);