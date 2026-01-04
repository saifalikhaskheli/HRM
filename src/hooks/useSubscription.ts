import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { SubscriptionStatus } from '@/types/company';

export interface PlanInfo {
  id: string;
  name: string;
  description: string | null;
  price_monthly: number;
  price_yearly: number;
  max_employees: number | null;
  max_storage_gb: number | null;
  features: {
    modules: string[] | 'all';
    support?: string;
    sso?: boolean;
    api?: boolean;
    audit?: boolean;
  } | null;
  sort_order: number | null;
}

export interface SubscriptionInfo {
  id: string;
  company_id: string;
  plan_id: string;
  plan_name: string;
  status: SubscriptionStatus;
  billing_interval: 'monthly' | 'yearly';
  current_period_start: string;
  current_period_end: string;
  trial_ends_at: string | null;
  canceled_at: string | null;
  is_past_due: boolean;
  days_until_due: number | null;
  can_upgrade: boolean;
  can_downgrade: boolean;
}

export function usePlans() {
  return useQuery({
    queryKey: ['plans'],
    queryFn: async (): Promise<PlanInfo[]> => {
      const { data, error } = await supabase
        .from('plans')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      if (error) throw error;

      return (data || []).map((plan) => ({
        ...plan,
        features: plan.features as PlanInfo['features'],
      }));
    },
    staleTime: 1000 * 60 * 30, // 30 minutes
  });
}

export function useSubscription() {
  const { currentCompanyId } = useAuth();

  return useQuery({
    queryKey: ['subscription', currentCompanyId],
    queryFn: async (): Promise<SubscriptionInfo | null> => {
      if (!currentCompanyId) return null;

      const { data, error } = await supabase
        .from('company_subscriptions')
        .select(`
          id,
          company_id,
          plan_id,
          status,
          billing_interval,
          current_period_start,
          current_period_end,
          trial_ends_at,
          canceled_at,
          plans (
            name,
            sort_order
          )
        `)
        .eq('company_id', currentCompanyId)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;

      const now = new Date();
      const periodEnd = new Date(data.current_period_end);
      const daysUntilDue = Math.ceil((periodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      
      // Get all plans to determine upgrade/downgrade ability
      const { data: plans } = await supabase
        .from('plans')
        .select('id, sort_order')
        .eq('is_active', true);

      const currentPlanOrder = (data.plans as { name: string; sort_order: number | null })?.sort_order || 0;
      const hasHigherPlan = plans?.some(p => (p.sort_order || 0) > currentPlanOrder);
      const hasLowerPlan = plans?.some(p => (p.sort_order || 0) < currentPlanOrder && (p.sort_order || 0) > 0);

      return {
        id: data.id,
        company_id: data.company_id,
        plan_id: data.plan_id,
        plan_name: (data.plans as { name: string; sort_order: number | null })?.name || 'Unknown',
        status: data.status,
        billing_interval: data.billing_interval,
        current_period_start: data.current_period_start,
        current_period_end: data.current_period_end,
        trial_ends_at: data.trial_ends_at,
        canceled_at: data.canceled_at,
        is_past_due: data.status === 'past_due',
        days_until_due: daysUntilDue > 0 ? daysUntilDue : null,
        can_upgrade: hasHigherPlan || false,
        can_downgrade: hasLowerPlan || false,
      };
    },
    enabled: !!currentCompanyId,
    staleTime: 1000 * 60 * 5,
  });
}

export function useChangePlan() {
  const queryClient = useQueryClient();
  const { currentCompanyId, user } = useAuth();

  return useMutation({
    mutationFn: async ({ planId, interval }: { planId: string; interval: 'monthly' | 'yearly' }) => {
      if (!currentCompanyId || !user) {
        throw new Error('No company or user context');
      }

      const response = await supabase.functions.invoke('assign-plan', {
        body: {
          company_id: currentCompanyId,
          plan_id: planId,
          billing_interval: interval,
        },
      });

      if (response.error) {
        throw new Error(response.error.message || 'Failed to change plan');
      }

      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription'] });
      queryClient.invalidateQueries({ queryKey: ['company'] });
      toast.success('Plan changed successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to change plan');
    },
  });
}

export function useFreezeCompany() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      companyId, 
      action, 
      reason 
    }: { 
      companyId: string; 
      action: 'freeze' | 'unfreeze'; 
      reason?: string;
    }) => {
      const response = await supabase.functions.invoke('freeze-company', {
        body: {
          company_id: companyId,
          action,
          reason,
        },
      });

      if (response.error) {
        throw new Error(response.error.message || `Failed to ${action} company`);
      }

      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['company'] });
      toast.success(`Company ${variables.action === 'freeze' ? 'frozen' : 'unfrozen'} successfully`);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

/**
 * Hook to check subscription health and detect issues
 */
export function useSubscriptionHealth() {
  const { data: subscription } = useSubscription();

  const health = {
    isHealthy: subscription?.status === 'active' || subscription?.status === 'trialing',
    isPastDue: subscription?.status === 'past_due',
    isCanceled: subscription?.status === 'canceled',
    isPaused: subscription?.status === 'paused',
    isTrialing: subscription?.status === 'trialing',
    trialEndsAt: subscription?.trial_ends_at ? new Date(subscription.trial_ends_at) : null,
    periodEndsAt: subscription?.current_period_end ? new Date(subscription.current_period_end) : null,
    needsAttention: subscription?.status === 'past_due' || subscription?.status === 'canceled',
    warningMessage: getWarningMessage(subscription),
  };

  return health;
}

function getWarningMessage(subscription: SubscriptionInfo | null | undefined): string | null {
  if (!subscription) return 'No active subscription';
  
  switch (subscription.status) {
    case 'past_due':
      return 'Your payment is past due. Please update your payment method to avoid service interruption.';
    case 'canceled':
      return 'Your subscription has been canceled. Subscribe to a plan to continue using the service.';
    case 'paused':
      return 'Your account is paused. Resume your subscription to regain access.';
    case 'trialing':
      if (subscription.trial_ends_at) {
        const daysLeft = Math.ceil(
          (new Date(subscription.trial_ends_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        );
        if (daysLeft <= 3) {
          return `Your trial ends in ${daysLeft} day${daysLeft === 1 ? '' : 's'}. Add a payment method to continue.`;
        }
      }
      return null;
    default:
      return null;
  }
}
