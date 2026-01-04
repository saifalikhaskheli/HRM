import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { toast } from 'sonner';
import type { AppRole } from '@/types/auth';

interface InviteUserParams {
  email: string;
  role: AppRole;
  firstName?: string;
  lastName?: string;
}

interface CreateEmployeeUserParams {
  employeeId: string;
  role: AppRole;
}

interface UpdateRoleParams {
  userId: string;
  companyUserId: string;
  newRole: AppRole;
  currentRole: AppRole;
}

interface RemoveUserParams {
  companyUserId: string;
  userId: string;
}

export function useUserManagement() {
  const { companyId, role: currentUserRole } = useTenant();
  const queryClient = useQueryClient();

  // Computed permission for managing users
  const canManageUsers = currentUserRole === 'super_admin' || currentUserRole === 'company_admin';

  // Legacy invite user - kept for backwards compatibility
  const inviteUser = useMutation({
    mutationFn: async (params: InviteUserParams) => {
      if (!companyId) throw new Error('No company selected');

      const { data, error } = await supabase.functions.invoke('invite-user', {
        body: {
          company_id: companyId,
          email: params.email.toLowerCase().trim(),
          role: params.role,
          first_name: params.firstName?.trim() || undefined,
          last_name: params.lastName?.trim() || undefined,
        },
      });

      if (error) {
        console.error('Invite error:', error);
        throw new Error(error.message || 'Failed to invite user');
      }

      if (!data.success) {
        throw new Error(data.message || 'Failed to invite user');
      }

      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['company-users', companyId] });
      toast.success(data.user_added ? 'User added to company' : 'Invitation sent successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // New: Create user account from employee
  const createEmployeeUser = useMutation({
    mutationFn: async (params: CreateEmployeeUserParams) => {
      if (!companyId) throw new Error('No company selected');

      console.log('Creating employee user:', { employeeId: params.employeeId, companyId, role: params.role });

      const { data, error } = await supabase.functions.invoke('create-employee-user', {
        body: {
          employee_id: params.employeeId,
          company_id: companyId,
          role: params.role,
        },
      });

      console.log('Edge function response:', { data, error });

       if (error) {
         console.error('Create employee user error:', error);

         let message = error.message || 'Failed to create user account';
         // For non-2xx responses Supabase returns a FunctionsHttpError with a response body
         // available via error.context.text()/json(). Parse it so we show the real backend error.
         try {
           const anyErr = error as any;
           const text = await anyErr?.context?.text?.();
           if (typeof text === 'string' && text.trim().length > 0) {
             try {
               const parsed = JSON.parse(text);
               message = parsed?.message || parsed?.error || message;
             } catch {
               message = text;
             }
           }
         } catch {
           // ignore parsing issues and fall back to error.message
         }

         throw new Error(message);
       }

      // Handle case where data might be the response directly or wrapped
      const responseData = data;
      
      if (responseData?.error) {
        throw new Error(responseData.error || 'Failed to create user account');
      }

      if (responseData && responseData.success === false) {
        throw new Error(responseData.message || 'Failed to create user account');
      }

      return responseData;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-users', companyId] });
      queryClient.invalidateQueries({ queryKey: ['employees-without-user', companyId] });
      queryClient.invalidateQueries({ queryKey: ['employees', companyId] });
      toast.success('User account created. Login credentials sent to employee\'s email.');
    },
    onError: (error: Error) => {
      console.error('createEmployeeUser mutation error:', error);
      toast.error(error.message);
    },
  });

  const updateUserRole = useMutation({
    mutationFn: async (params: UpdateRoleParams) => {
      if (!companyId) throw new Error('No company selected');

      // Prevent promoting to super_admin
      if (params.newRole === 'super_admin') {
        throw new Error('Cannot promote to Super Admin');
      }

      const { error } = await supabase
        .from('company_users')
        .update({ role: params.newRole, updated_at: new Date().toISOString() })
        .eq('id', params.companyUserId)
        .eq('company_id', companyId);

      if (error) throw error;

      // Log audit event
      await supabase.from('audit_logs').insert({
        company_id: companyId,
        action: 'update',
        table_name: 'company_users',
        record_id: params.companyUserId,
        old_values: { role: params.currentRole },
        new_values: { role: params.newRole },
        metadata: { action_type: 'role_change' },
      });

      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-users', companyId] });
      toast.success('User role updated');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update role');
    },
  });

  const removeUser = useMutation({
    mutationFn: async (params: RemoveUserParams) => {
      if (!companyId) throw new Error('No company selected');

      // Soft remove - set is_active to false
      const { error } = await supabase
        .from('company_users')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', params.companyUserId)
        .eq('company_id', companyId);

      if (error) throw error;

      // Log audit event
      await supabase.from('audit_logs').insert({
        company_id: companyId,
        action: 'update',
        table_name: 'company_users',
        record_id: params.companyUserId,
        old_values: { is_active: true },
        new_values: { is_active: false },
        metadata: { action_type: 'user_removed' },
      });

      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-users', companyId] });
      toast.success('User removed from company');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to remove user');
    },
  });

  const reactivateUser = useMutation({
    mutationFn: async (params: RemoveUserParams) => {
      if (!companyId) throw new Error('No company selected');

      // Check permission before making request
      if (!canManageUsers) {
        throw new Error('Only admins can reactivate users');
      }

      const { data, error } = await supabase.functions.invoke('reactivate-user', {
        body: {
          company_user_id: params.companyUserId,
          user_id: params.userId,
          company_id: companyId,
        },
      });

      if (error) {
        console.error('Reactivate user error:', error);
        // Parse error message from edge function
        if (error.message?.includes('non-2xx')) {
          throw new Error('Only admins can reactivate users. Please contact your administrator.');
        }
        throw new Error(error.message || 'Failed to reactivate user');
      }

      if (!data?.success) {
        throw new Error(data?.error || 'Failed to reactivate user');
      }

      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['company-users', companyId] });
      if (data.email_sent) {
        toast.success('User reactivated. New login credentials sent via email.');
      } else {
        toast.success('User reactivated. Email notification failed - please share credentials manually.');
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to reactivate user');
    },
  });

  const bulkReactivateUsers = useMutation({
    mutationFn: async (users: RemoveUserParams[]) => {
      if (!companyId) throw new Error('No company selected');

      // Check permission before making request
      if (!canManageUsers) {
        throw new Error('Only admins can reactivate users');
      }

      const results = await Promise.allSettled(
        users.map(async (params) => {
          const { data, error } = await supabase.functions.invoke('reactivate-user', {
            body: {
              company_user_id: params.companyUserId,
              user_id: params.userId,
              company_id: companyId,
            },
          });

          if (error) throw error;
          if (!data?.success) throw new Error(data?.error || 'Failed to reactivate user');
          return data;
        })
      );

      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;

      return { successful, failed, total: users.length };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['company-users', companyId] });
      if (data.failed === 0) {
        toast.success(`${data.successful} user(s) reactivated successfully. Credentials sent via email.`);
      } else {
        toast.warning(`${data.successful} user(s) reactivated, ${data.failed} failed.`);
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to reactivate users');
    },
  });

  return {
    inviteUser,
    createEmployeeUser,
    isCreatingUser: createEmployeeUser.isPending,
    updateUserRole,
    removeUser,
    reactivateUser,
    bulkReactivateUsers,
    canManageUsers,
  };
}
