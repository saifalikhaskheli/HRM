import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { useCallback, useMemo } from 'react';
import { 
  Permission, 
  UserPermission, 
  RolePermission, 
  PermissionModule, 
  PermissionAction 
} from '@/types/permissions';
import { AppRole } from '@/types/auth';
import { toast } from 'sonner';

// =====================================================
// FETCH ALL PERMISSIONS (REFERENCE DATA)
// =====================================================
export function useAllPermissions() {
  return useQuery({
    queryKey: ['permissions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('permissions')
        .select('*')
        .order('module')
        .order('action');
      
      if (error) throw error;
      return data as Permission[];
    },
    staleTime: 1000 * 60 * 60, // 1 hour - permissions rarely change
  });
}

// =====================================================
// FETCH CURRENT USER'S PERMISSIONS
// =====================================================
export function useMyPermissions() {
  const { companyId, role, isImpersonating } = useTenant();

  const { data: permissions, isLoading } = useQuery({
    queryKey: ['my-permissions', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      
      const { data, error } = await supabase.rpc('get_user_permissions', {
        _user_id: user.id,
        _company_id: companyId,
      });
      
      if (error) throw error;
      return data as UserPermission[];
    },
    enabled: !!companyId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Create a map for fast lookups
  const permissionMap = useMemo(() => {
    const map = new Map<string, boolean>();
    permissions?.forEach(p => {
      const key = `${p.module}:${p.action}`;
      map.set(key, p.has_permission);
    });
    return map;
  }, [permissions]);

  // Check if user has a specific permission
  const can = useCallback((module: PermissionModule, action: PermissionAction): boolean => {
    // Super admin has all permissions
    if (role === 'super_admin') return true;
    
    // When impersonating, allow reads but block writes
    if (isImpersonating) {
      return action === 'read';
    }
    
    // Check the permission map
    const key = `${module}:${action}`;
    const hasPermission = permissionMap.get(key);
    
    // If no permissions loaded yet, default based on existing role logic
    if (hasPermission === undefined) {
      return false;
    }
    
    return hasPermission;
  }, [permissionMap, role, isImpersonating]);

  // Check if user can perform any action on a module
  const canAccessModule = useCallback((module: PermissionModule): boolean => {
    if (role === 'super_admin') return true;
    if (isImpersonating) return true; // Read access when impersonating
    
    // Check if user has any permission on this module
    return permissions?.some(p => p.module === module && p.has_permission) ?? false;
  }, [permissions, role, isImpersonating]);

  // Get all permissions for a module
  const getModulePermissions = useCallback((module: PermissionModule): UserPermission[] => {
    return permissions?.filter(p => p.module === module) ?? [];
  }, [permissions]);

  return {
    permissions,
    isLoading,
    can,
    canAccessModule,
    getModulePermissions,
  };
}

// =====================================================
// FETCH USER PERMISSIONS (FOR ADMIN VIEW)
// =====================================================
export function useUserPermissions(userId: string | null) {
  const { companyId } = useTenant();

  return useQuery({
    queryKey: ['user-permissions', companyId, userId],
    queryFn: async () => {
      if (!companyId || !userId) return [];
      
      const { data, error } = await supabase.rpc('get_user_permissions', {
        _user_id: userId,
        _company_id: companyId,
      });
      
      if (error) throw error;
      return data as UserPermission[];
    },
    enabled: !!companyId && !!userId,
  });
}

// =====================================================
// FETCH ROLE PERMISSIONS
// =====================================================
export function useRolePermissions(role: AppRole | null) {
  const { companyId } = useTenant();

  return useQuery({
    queryKey: ['role-permissions', companyId, role],
    queryFn: async () => {
      if (!companyId || !role) return [];
      
      const { data, error } = await supabase.rpc('get_role_permissions', {
        _company_id: companyId,
        _role: role,
      });
      
      if (error) throw error;
      return data as RolePermission[];
    },
    enabled: !!companyId && !!role,
  });
}

// =====================================================
// SET ROLE PERMISSION
// =====================================================
export function useSetRolePermission() {
  const { companyId } = useTenant();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      role, 
      module, 
      action, 
      grant 
    }: { 
      role: AppRole; 
      module: PermissionModule; 
      action: PermissionAction; 
      grant: boolean;
    }) => {
      if (!companyId) throw new Error('No company selected');
      
      const { data, error } = await supabase.rpc('set_role_permission', {
        _company_id: companyId,
        _role: role,
        _module: module as any, // Cast needed as DB enum may not include all app modules
        _action: action,
        _grant: grant,
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['role-permissions', companyId, variables.role] });
      queryClient.invalidateQueries({ queryKey: ['my-permissions', companyId] });
      queryClient.invalidateQueries({ queryKey: ['user-permissions', companyId] });
      toast.success(`Permission ${variables.grant ? 'granted' : 'revoked'}`);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });
}

// =====================================================
// SET USER PERMISSION OVERRIDE
// =====================================================
export function useSetUserPermission() {
  const { companyId } = useTenant();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      userId, 
      module, 
      action, 
      granted 
    }: { 
      userId: string; 
      module: PermissionModule; 
      action: PermissionAction; 
      granted: boolean | null; // null to remove override
    }) => {
      if (!companyId) throw new Error('No company selected');
      
      const { data, error } = await supabase.rpc('set_user_permission', {
        _company_id: companyId,
        _target_user_id: userId,
        _module: module as any, // Cast needed as DB enum may not include all app modules
        _action: action,
        _granted: granted,
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['user-permissions', companyId, variables.userId] });
      queryClient.invalidateQueries({ queryKey: ['my-permissions', companyId] });
      queryClient.invalidateQueries({ queryKey: ['users-with-overrides', companyId] });
      
      if (variables.granted === null) {
        toast.success('Permission override removed');
      } else {
        toast.success(`Permission ${variables.granted ? 'granted' : 'denied'}`);
      }
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });
}

// =====================================================
// BATCH SET USER PERMISSIONS (PERFORMANCE OPTIMIZED)
// =====================================================
export function useBatchSetUserPermissions() {
  const { companyId } = useTenant();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      userId, 
      permissions 
    }: { 
      userId: string; 
      permissions: { module: PermissionModule; action: PermissionAction; granted: boolean }[];
    }) => {
      if (!companyId) throw new Error('No company selected');
      
      const { data, error } = await supabase.rpc('set_user_permissions_batch', {
        _company_id: companyId,
        _target_user_id: userId,
        _permissions: permissions,
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['user-permissions', companyId, variables.userId] });
      queryClient.invalidateQueries({ queryKey: ['my-permissions', companyId] });
      queryClient.invalidateQueries({ queryKey: ['users-with-overrides', companyId] });
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });
}

// =====================================================
// FETCH USERS WITH PERMISSION OVERRIDES
// =====================================================
export function useUsersWithOverrides() {
  const { companyId } = useTenant();

  return useQuery({
    queryKey: ['users-with-overrides', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      
      // Get distinct users who have explicit permission overrides
      const { data: overrides, error: overridesError } = await supabase
        .from('user_permissions')
        .select('user_id')
        .eq('company_id', companyId);
      
      if (overridesError) throw overridesError;
      
      // Get unique user IDs
      const uniqueUserIds = [...new Set(overrides?.map(o => o.user_id) || [])];
      
      if (uniqueUserIds.length === 0) return [];
      
      // Fetch profiles for these users
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email')
        .in('id', uniqueUserIds);
      
      if (profilesError) throw profilesError;
      
      return profiles?.map(p => ({
        user_id: p.id,
        first_name: p.first_name,
        last_name: p.last_name,
        email: p.email,
      })) || [];
    },
    enabled: !!companyId,
  });
}

// =====================================================
// INITIALIZE COMPANY PERMISSIONS
// =====================================================
export function useInitializePermissions() {
  const { companyId } = useTenant();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (!companyId) throw new Error('No company selected');
      
      const { error } = await supabase.rpc('initialize_company_permissions', {
        _company_id: companyId,
      });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['role-permissions', companyId] });
      queryClient.invalidateQueries({ queryKey: ['my-permissions', companyId] });
      toast.success('Default permissions initialized');
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });
}

// =====================================================
// RESET ROLE PERMISSIONS TO DEFAULTS
// =====================================================
export function useResetRolePermissions() {
  const { companyId } = useTenant();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (!companyId) throw new Error('No company selected');
      
      const { error } = await supabase.rpc('reset_role_permissions_to_defaults', {
        _company_id: companyId,
      });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['role-permissions', companyId] });
      queryClient.invalidateQueries({ queryKey: ['my-permissions', companyId] });
      queryClient.invalidateQueries({ queryKey: ['user-permissions', companyId] });
      toast.success('Role permissions reset to defaults');
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });
}
