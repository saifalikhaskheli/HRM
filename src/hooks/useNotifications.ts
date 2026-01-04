import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTenant } from '@/contexts/TenantContext';
import { useAuth } from '@/contexts/AuthContext';

interface Notification {
  id: string;
  company_id: string;
  user_id: string;
  title: string;
  message: string | null;
  type: string;
  is_read: boolean;
  link_url: string | null;
  created_at: string;
}

// Note: These hooks require the notifications table to be created via migration
// For now, they return empty data gracefully
export function useNotifications() {
  const { companyId } = useTenant();
  const { user } = useAuth();

  return useQuery({
    queryKey: ['notifications', companyId, user?.user_id],
    queryFn: async (): Promise<Notification[]> => {
      // Return empty array until notifications table is created
      return [];
    },
    enabled: !!companyId && !!user?.user_id,
  });
}

export function useUnreadNotificationCount() {
  const { companyId } = useTenant();
  const { user } = useAuth();

  return useQuery({
    queryKey: ['notifications-count', companyId, user?.user_id],
    queryFn: async () => {
      return 0;
    },
    enabled: !!companyId && !!user?.user_id,
    refetchInterval: 30000,
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  const { companyId } = useTenant();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (notificationId: string) => {
      // No-op until table exists
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', companyId, user?.user_id] });
      queryClient.invalidateQueries({ queryKey: ['notifications-count', companyId, user?.user_id] });
    },
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  const { companyId } = useTenant();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async () => {
      // No-op until table exists
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', companyId, user?.user_id] });
      queryClient.invalidateQueries({ queryKey: ['notifications-count', companyId, user?.user_id] });
    },
  });
}