import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface PrimaryDomainResult {
  domainUrl: string | null;
  domainType: 'subdomain' | 'custom' | null;
  isLoading: boolean;
}

export function useCompanyPrimaryDomain(companyId: string | null): PrimaryDomainResult {
  const [domainUrl, setDomainUrl] = useState<string | null>(null);
  const [domainType, setDomainType] = useState<'subdomain' | 'custom' | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!companyId) {
      setDomainUrl(null);
      setDomainType(null);
      return;
    }

    async function fetchPrimaryDomain() {
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .rpc('get_company_primary_domain', { _company_id: companyId });

        if (error) {
          console.error('Error fetching primary domain:', error);
          setDomainUrl(null);
          setDomainType(null);
          return;
        }

        if (data && data.length > 0 && data[0].domain_url) {
          setDomainUrl(data[0].domain_url);
          setDomainType(data[0].domain_type as 'subdomain' | 'custom');
        } else {
          setDomainUrl(null);
          setDomainType(null);
        }
      } catch (err) {
        console.error('Error fetching primary domain:', err);
        setDomainUrl(null);
        setDomainType(null);
      } finally {
        setIsLoading(false);
      }
    }

    fetchPrimaryDomain();
  }, [companyId]);

  return { domainUrl, domainType, isLoading };
}

// Utility function to get primary domain (for use after login)
export async function getCompanyPrimaryDomainUrl(companyId: string): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .rpc('get_company_primary_domain', { _company_id: companyId });

    if (error || !data || data.length === 0) {
      return null;
    }

    return data[0].domain_url || null;
  } catch {
    return null;
  }
}
