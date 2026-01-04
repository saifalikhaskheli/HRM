import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { CompanyWithSubscription, SubscriptionStatus } from '@/types/company';
import { useAuth } from '@/contexts/AuthContext';

interface CompanyData {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  is_active: boolean;
  timezone: string;
  settings: Record<string, unknown>;
  email: string | null;
  phone: string | null;
  industry: string | null;
  size_range: string | null;
  address: Record<string, string> | null;
  fiscal_year_start: number | null;
}

interface SubscriptionData {
  id: string;
  plan_id: string;
  status: SubscriptionStatus;
  billing_interval: 'monthly' | 'yearly';
  current_period_end: string;
  trial_ends_at: string | null;
  plans: {
    name: string;
    features: {
      modules: string[] | 'all';
      max_employees?: number;
      max_storage_gb?: number;
      support?: string;
      sso?: boolean;
      api?: boolean;
      audit?: boolean;
    };
    max_employees: number | null;
    max_storage_gb: number;
  };
}

export function useCompany(companyId: string | null) {
  return useQuery({
    queryKey: ['company', companyId],
    queryFn: async (): Promise<CompanyWithSubscription | null> => {
      if (!companyId) return null;

      const { data: company, error: companyError } = await supabase
        .from('companies')
        .select('id, name, slug, logo_url, is_active, timezone, settings, email, phone, industry, size_range, address, fiscal_year_start')
        .eq('id', companyId)
        .maybeSingle();

      if (companyError) {
        console.error('Error fetching company:', companyError);
        throw companyError;
      }

      if (!company) return null;

      const { data: subscription, error: subError } = await supabase
        .from('company_subscriptions')
        .select(`
          id,
          plan_id,
          status,
          billing_interval,
          current_period_end,
          trial_ends_at,
          plans (
            name,
            features,
            max_employees,
            max_storage_gb
          )
        `)
        .eq('company_id', companyId)
        .maybeSingle();

      if (subError) {
        console.error('Error fetching subscription:', subError);
      }

      const typedCompany = company as CompanyData;
      const typedSubscription = subscription as SubscriptionData | null;

      return {
        ...typedCompany,
        subscription: typedSubscription ? {
          id: typedSubscription.id,
          plan_id: typedSubscription.plan_id,
          plan_name: typedSubscription.plans?.name || 'Unknown',
          status: typedSubscription.status,
          billing_interval: typedSubscription.billing_interval,
          current_period_end: typedSubscription.current_period_end,
          trial_ends_at: typedSubscription.trial_ends_at,
          features: {
            modules: typedSubscription.plans?.features?.modules || [],
            max_employees: typedSubscription.plans?.max_employees || null,
            max_storage_gb: typedSubscription.plans?.max_storage_gb || 5,
            support: typedSubscription.plans?.features?.support || 'community',
            sso: typedSubscription.plans?.features?.sso || false,
            api: typedSubscription.plans?.features?.api || false,
            audit: typedSubscription.plans?.features?.audit || false,
          },
        } : null,
      };
    },
    enabled: !!companyId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

export function useCurrentCompany() {
  const { currentCompanyId } = useAuth();
  return useCompany(currentCompanyId);
}

// Hook that respects impersonation - use this for viewing company data as admin
export function useEffectiveCompany(effectiveCompanyId: string | null) {
  return useCompany(effectiveCompanyId);
}
