import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { useSubscription } from '@/hooks/useSubscription';
import { toast } from 'sonner';

export interface RoleTemplate {
  id: string;
  name: string;
  display_name: string;
  description: string | null;
  base_role: string;
  is_system: boolean;
  plan_tier: string;
  permissions_config: Record<string, unknown>;
  sort_order: number;
  created_at: string;
}

export interface CompanyRole {
  id: string;
  company_id: string;
  template_id: string | null;
  custom_name: string | null;
  description: string | null;
  permission_overrides: Record<string, unknown>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  template?: RoleTemplate;
}

// Plan tier mapping
const PLAN_TIERS = {
  free: 0,
  basic: 1,
  pro: 2,
  enterprise: 3,
};

export function useRoleTemplates() {
  const { companyId } = useTenant();
  const { data: subscription } = useSubscription();

  // Get plan tier from subscription
  const planTier = subscription?.plan_id ? 'pro' : 'basic'; // Simplified - adjust based on actual plan data
  const tierLevel = PLAN_TIERS[planTier as keyof typeof PLAN_TIERS] || 1;

  // Fetch all role templates
  const { data: templates, isLoading: templatesLoading } = useQuery({
    queryKey: ['role-templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('role_templates')
        .select('*')
        .order('sort_order');

      if (error) throw error;
      return data as RoleTemplate[];
    },
  });

  // Fetch company's adopted roles
  const { data: companyRoles, isLoading: rolesLoading } = useQuery({
    queryKey: ['company-roles', companyId],
    queryFn: async () => {
      if (!companyId) return [];

      const { data, error } = await supabase
        .from('company_roles')
        .select(`
          *,
          template:role_templates(*)
        `)
        .eq('company_id', companyId)
        .eq('is_active', true);

      if (error) throw error;
      return data as CompanyRole[];
    },
    enabled: !!companyId,
  });

  // Filter templates by plan tier
  const availableTemplates = templates?.filter((t) => {
    const templateTier = PLAN_TIERS[t.plan_tier as keyof typeof PLAN_TIERS] || 0;
    return templateTier <= tierLevel;
  });

  // Templates not yet adopted by company
  const unadoptedTemplates = availableTemplates?.filter(
    (t) => !companyRoles?.some((cr) => cr.template_id === t.id)
  );

  return {
    templates: availableTemplates || [],
    companyRoles: companyRoles || [],
    unadoptedTemplates: unadoptedTemplates || [],
    isLoading: templatesLoading || rolesLoading,
    planTier,
  };
}

export function useAdoptRoleTemplate() {
  const { companyId } = useTenant();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ templateId, customName }: { templateId: string; customName?: string }) => {
      if (!companyId) throw new Error('No company selected');

      const { data, error } = await supabase
        .from('company_roles')
        .insert({
          company_id: companyId,
          template_id: templateId,
          custom_name: customName || null,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-roles', companyId] });
      toast.success('Role added successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to add role');
    },
  });
}

export function useUpdateCompanyRole() {
  const { companyId } = useTenant();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      roleId,
      customName,
      description,
      permissionOverrides,
    }: {
      roleId: string;
      customName?: string;
      description?: string;
      permissionOverrides?: Record<string, unknown>;
    }) => {
      const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (customName !== undefined) updates.custom_name = customName;
      if (description !== undefined) updates.description = description;
      if (permissionOverrides !== undefined) updates.permission_overrides = permissionOverrides;

      const { error } = await supabase
        .from('company_roles')
        .update(updates)
        .eq('id', roleId)
        .eq('company_id', companyId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-roles', companyId] });
      toast.success('Role updated');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update role');
    },
  });
}

export function useRemoveCompanyRole() {
  const { companyId } = useTenant();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (roleId: string) => {
      const { error } = await supabase
        .from('company_roles')
        .update({ is_active: false })
        .eq('id', roleId)
        .eq('company_id', companyId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-roles', companyId] });
      toast.success('Role removed');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to remove role');
    },
  });
}
