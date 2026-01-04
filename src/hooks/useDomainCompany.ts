import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface DomainCompany {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
}

interface UseDomainCompanyResult {
  company: DomainCompany | null;
  isLoading: boolean;
  isDomainBased: boolean;
  subdomain: string | null;
  baseDomain: string | null;
}

// Known base domains for wildcard subdomain routing
// These are the domains where company subdomains are hosted
const KNOWN_BASE_DOMAINS = [
  'hr.nateshkumar.tech',    // Production wildcard domain
  'thefruitbazaar.com',     // Vercel production domain
  'lovable.app',            // Lovable hosting
  'vercel.app',             // Vercel hosting
];

/**
 * Extract subdomain from hostname for multi-level domain patterns
 * Examples:
 * - sala.hr.nateshkumar.tech → subdomain: "sala", baseDomain: "hr.nateshkumar.tech"
 * - mycompany.app.lovable.app → subdomain: "mycompany", baseDomain: "app.lovable.app"
 * - hr.nateshkumar.tech → subdomain: null (this is the root)
 */
function extractSubdomainInfo(hostname: string): { subdomain: string | null; baseDomain: string | null } {
  // Check against known base domains
  for (const baseDomain of KNOWN_BASE_DOMAINS) {
    if (hostname === baseDomain) {
      // This is the root domain, no subdomain
      return { subdomain: null, baseDomain };
    }
    
    if (hostname.endsWith(`.${baseDomain}`)) {
      // Extract subdomain (everything before the base domain)
      const subdomain = hostname.slice(0, hostname.length - baseDomain.length - 1);
      // Only take the first part if there are multiple levels
      const subdomainParts = subdomain.split('.');
      return { subdomain: subdomainParts[0], baseDomain };
    }
  }
  
  // Fallback: try to detect subdomain from generic patterns
  const parts = hostname.split('.');
  
  // For 4+ parts like "company.hr.domain.tld", first part is subdomain
  if (parts.length >= 4) {
    const subdomain = parts[0];
    const baseDomain = parts.slice(1).join('.');
    return { subdomain, baseDomain };
  }
  
  // For 3 parts like "company.domain.tld" or "hr.domain.tld"
  if (parts.length === 3) {
    // Check if first part could be a subdomain (not www, mail, etc.)
    const commonPrefixes = ['www', 'mail', 'ftp', 'api', 'admin'];
    if (!commonPrefixes.includes(parts[0].toLowerCase())) {
      return { subdomain: parts[0], baseDomain: parts.slice(1).join('.') };
    }
  }
  
  // For 2 parts (root domain), no subdomain
  return { subdomain: null, baseDomain: hostname };
}

export function useDomainCompany(): UseDomainCompanyResult {
  const [company, setCompany] = useState<DomainCompany | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [subdomain, setSubdomain] = useState<string | null>(null);
  const [baseDomain, setBaseDomain] = useState<string | null>(null);

  useEffect(() => {
    const detectCompany = async () => {
      const hostname = window.location.hostname;
      
      console.log('[useDomainCompany] Detecting company for hostname:', hostname);
      
      // Skip detection for localhost
      if (hostname === 'localhost' || hostname === '127.0.0.1') {
        console.log('[useDomainCompany] Localhost detected, skipping');
        setIsLoading(false);
        return;
      }

      // Extract subdomain and base domain
      const { subdomain: detectedSubdomain, baseDomain: detectedBaseDomain } = extractSubdomainInfo(hostname);
      
      console.log('[useDomainCompany] Extracted:', { subdomain: detectedSubdomain, baseDomain: detectedBaseDomain });
      
      setSubdomain(detectedSubdomain);
      setBaseDomain(detectedBaseDomain);

      // Use the secure RPC function that works for anonymous users
      // Try subdomain first, then full hostname for custom domains
      const lookupKey = detectedSubdomain || hostname;
      
      console.log('[useDomainCompany] Looking up company branding for:', lookupKey);
      
      const { data, error } = await supabase.rpc('get_company_branding_for_domain', {
        hostname: lookupKey
      });

      if (error) {
        console.error('[useDomainCompany] Error looking up company:', error);
        setIsLoading(false);
        return;
      }

      if (data && data.length > 0) {
        const companyData = data[0] as DomainCompany;
        console.log('[useDomainCompany] Found company:', companyData.name);
        setCompany(companyData);
      } else if (detectedSubdomain) {
        // If subdomain lookup failed, try full hostname for custom domains
        console.log('[useDomainCompany] Subdomain not found, trying full hostname:', hostname);
        
        const { data: customData, error: customError } = await supabase.rpc('get_company_branding_for_domain', {
          hostname: hostname
        });

        if (customError) {
          console.error('[useDomainCompany] Error looking up custom domain:', customError);
        } else if (customData && customData.length > 0) {
          const companyData = customData[0] as DomainCompany;
          console.log('[useDomainCompany] Found company by custom domain:', companyData.name);
          setCompany(companyData);
        } else {
          console.log('[useDomainCompany] No company found for hostname:', hostname);
        }
      } else {
        console.log('[useDomainCompany] No company found for:', lookupKey);
      }

      setIsLoading(false);
    };

    detectCompany();
  }, []);

  return {
    company,
    isLoading,
    isDomainBased: !!company,
    subdomain,
    baseDomain,
  };
}
