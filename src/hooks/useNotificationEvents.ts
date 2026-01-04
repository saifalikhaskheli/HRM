import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { useAuth } from '@/contexts/AuthContext';
import { Json } from '@/integrations/supabase/types';

export interface NotificationEvent {
  id: string;
  company_id: string | null;
  user_id: string | null;
  employee_id: string | null;
  event_type: string;
  event_data: Record<string, unknown>;
  notification_channels: string[];
  status: 'pending' | 'sent' | 'failed';
  scheduled_at: string;
  sent_at: string | null;
  error_message: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export type NotificationEventType = 
  | 'document_expiry'
  | 'onboarding_welcome'
  | 'password_reset'
  | 'leave_request'
  | 'leave_approved'
  | 'leave_rejected'
  | 'expense_approved'
  | 'expense_rejected'
  | 'review_scheduled'
  | 'security_alert';

// Fetch notifications for current user
export function useMyNotifications() {
  const { user } = useAuth();
  const userId = user?.user_id;
  
  return useQuery({
    queryKey: ['my-notifications', userId],
    queryFn: async () => {
      if (!userId) return [];
      
      const { data, error } = await supabase
        .from('notification_events')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50);
      
      if (error) throw error;
      return data as NotificationEvent[];
    },
    enabled: !!userId,
  });
}

// Fetch all company notifications (admin view)
export function useCompanyNotifications(status?: 'pending' | 'sent' | 'failed') {
  const { companyId } = useTenant();
  
  return useQuery({
    queryKey: ['company-notifications', companyId, status],
    queryFn: async () => {
      if (!companyId) return [];
      
      let query = supabase
        .from('notification_events')
        .select('*')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })
        .limit(100);
      
      if (status) {
        query = query.eq('status', status);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      return data as NotificationEvent[];
    },
    enabled: !!companyId,
  });
}

// Create a notification event
export function useCreateNotificationEvent() {
  const queryClient = useQueryClient();
  const { companyId } = useTenant();
  const { user } = useAuth();
  const userId = user?.user_id;
  
  return useMutation({
    mutationFn: async ({
      event_type,
      event_data,
      employee_id,
      user_id,
      notification_channels = ['email'],
      scheduled_at,
    }: {
      event_type: NotificationEventType;
      event_data: Record<string, unknown>;
      employee_id?: string;
      user_id?: string;
      notification_channels?: string[];
      scheduled_at?: string;
    }) => {
      const { data, error } = await supabase
        .from('notification_events')
        .insert([{
          company_id: companyId || null,
          user_id: user_id || userId || null,
          employee_id: employee_id || null,
          event_type,
          event_data: event_data as Json,
          notification_channels,
          scheduled_at: scheduled_at || new Date().toISOString(),
          status: 'pending',
        }])
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-notifications', companyId] });
      queryClient.invalidateQueries({ queryKey: ['my-notifications', userId] });
    },
  });
}

// Mark notification as sent
export function useMarkNotificationSent() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (notificationId: string) => {
      const { error } = await supabase
        .from('notification_events')
        .update({
          status: 'sent',
          sent_at: new Date().toISOString(),
        })
        .eq('id', notificationId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-notifications'] });
      queryClient.invalidateQueries({ queryKey: ['my-notifications'] });
    },
  });
}

// Get documents needing expiry notifications
export function useDocumentsNeedingExpiryNotification(daysBefore = 30) {
  const { companyId } = useTenant();
  
  return useQuery({
    queryKey: ['documents-expiry-notifications', companyId, daysBefore],
    queryFn: async () => {
      const { data, error } = await supabase
        .rpc('get_documents_needing_expiry_notification', { 
          _days_before: daysBefore 
        });
      
      if (error) throw error;
      return data as Array<{
        document_id: string;
        company_id: string;
        employee_id: string;
        document_title: string;
        document_type_name: string;
        employee_email: string;
        employee_name: string;
        expiry_date: string;
        days_until_expiry: number;
      }>;
    },
    enabled: !!companyId,
  });
}

// Mark document expiry notification as sent
export function useMarkExpiryNotificationSent() {
  const queryClient = useQueryClient();
  const { companyId } = useTenant();
  
  return useMutation({
    mutationFn: async (documentId: string) => {
      const { error } = await supabase
        .rpc('mark_expiry_notification_sent', { _document_id: documentId });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        queryKey: ['documents-expiry-notifications', companyId] 
      });
    },
  });
}
