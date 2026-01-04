import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface ProfileAuthData {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  is_first_login: boolean;
  password_changed_at: string | null;
  failed_login_attempts: number;
  locked_until: string | null;
  password_expires_at: string | null;
  force_password_change: boolean;
  last_login_at: string | null;
}

// Get current user's auth profile data
export function useProfileAuth() {
  const { user } = useAuth();
  const userId = user?.user_id;
  
  return useQuery({
    queryKey: ['profile-auth', userId],
    queryFn: async () => {
      if (!userId) return null;
      
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          id,
          email,
          first_name,
          last_name,
          is_first_login,
          password_changed_at,
          failed_login_attempts,
          locked_until,
          password_expires_at,
          force_password_change,
          last_login_at
        `)
        .eq('id', userId)
        .single();
      
      if (error) throw error;
      return data as ProfileAuthData;
    },
    enabled: !!userId,
  });
}

// Check if user needs to change password
export function useNeedsPasswordChange() {
  const { data: profile, isLoading } = useProfileAuth();
  
  if (isLoading || !profile) return { needsChange: false, isLoading };
  
  const needsChange = 
    profile.is_first_login || 
    profile.force_password_change ||
    (profile.password_expires_at && new Date(profile.password_expires_at) < new Date());
  
  return { 
    needsChange, 
    isLoading,
    reason: profile.is_first_login 
      ? 'first_login' 
      : profile.force_password_change 
        ? 'forced' 
        : 'expired',
  };
}

// Check if account is locked
export function useIsAccountLocked() {
  const { user } = useAuth();
  const userId = user?.user_id;
  
  return useQuery({
    queryKey: ['account-locked', userId],
    queryFn: async () => {
      if (!userId) return false;
      
      const { data, error } = await supabase
        .rpc('is_account_locked', { _user_id: userId });
      
      if (error) throw error;
      return data as boolean;
    },
    enabled: !!userId,
  });
}

// Record password change
export function useRecordPasswordChange() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const userId = user?.user_id;
  
  return useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error('Not authenticated');
      
      const { error } = await supabase
        .from('profiles')
        .update({
          password_changed_at: new Date().toISOString(),
          is_first_login: false,
          force_password_change: false,
        })
        .eq('id', userId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile-auth', userId] });
      toast.success('Password updated successfully');
    },
    onError: (error) => {
      toast.error('Failed to record password change: ' + error.message);
    },
  });
}

// Record successful login
export function useRecordSuccessfulLogin() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase
        .rpc('record_successful_login', { _user_id: userId });
      
      if (error) throw error;
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['profile-auth', id] });
    },
  });
}

// Record failed login (for security logging)
export function useRecordFailedLogin() {
  return useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase
        .rpc('record_failed_login', { _user_id: userId });
      
      if (error) throw error;
    },
  });
}
