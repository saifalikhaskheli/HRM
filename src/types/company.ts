export type SubscriptionStatus = 
  | 'active' 
  | 'past_due' 
  | 'canceled' 
  | 'trialing' 
  | 'trial_expired'
  | 'paused';

export interface CompanySubscription {
  id: string;
  plan_id: string;
  plan_name: string;
  status: SubscriptionStatus;
  billing_interval: 'monthly' | 'yearly';
  current_period_end: string;
  trial_ends_at: string | null;
  features: {
    modules: string[] | 'all';
    max_employees: number | null;
    max_storage_gb: number;
    support: string;
    sso?: boolean;
    api?: boolean;
    audit?: boolean;
  };
}

export interface Company {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  is_active: boolean;
  timezone: string;
  settings: Record<string, unknown>;
  email?: string | null;
  phone?: string | null;
  industry?: string | null;
  size_range?: string | null;
  address?: Record<string, string> | null;
  fiscal_year_start?: number | null;
}

export interface CompanyWithSubscription extends Company {
  subscription: CompanySubscription | null;
}

export const isCompanyFrozen = (company: Company | null): boolean => {
  return company ? !company.is_active : true;
};

export const isSubscriptionActive = (subscription: CompanySubscription | null): boolean => {
  if (!subscription) return false;
  return ['active', 'trialing'].includes(subscription.status);
};

export const getTrialDaysRemaining = (subscription: CompanySubscription | null): number | null => {
  if (!subscription?.trial_ends_at) return null;
  const trialEnd = new Date(subscription.trial_ends_at);
  const now = new Date();
  const diffTime = trialEnd.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays > 0 ? diffDays : 0;
};
