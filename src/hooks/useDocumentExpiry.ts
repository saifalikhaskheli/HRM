import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { toast } from 'sonner';

export interface ExpiringDocument {
  document_id: string;
  company_id: string;
  employee_id: string;
  employee_user_id: string | null;
  employee_email: string;
  employee_name: string;
  document_title: string;
  document_type_name: string;
  expiry_date: string;
  days_until_expiry: number;
  manager_user_id: string | null;
  manager_email: string | null;
}

export interface DocumentExpiryNotification {
  id: string;
  document_id: string;
  company_id: string;
  employee_id: string;
  notification_type: string;
  days_until_expiry: number;
  sent_to: string;
  sent_at: string;
}

export function useExpiringDocuments(daysThreshold = 30) {
  const { companyId } = useTenant();

  return useQuery({
    queryKey: ['expiring-documents', companyId, daysThreshold],
    queryFn: async () => {
      if (!companyId) return [];

      const { data, error } = await supabase
        .rpc('get_expiring_documents', { _days_threshold: daysThreshold });

      if (error) throw error;
      
      // Filter to only this company
      return (data as ExpiringDocument[]).filter(d => d.company_id === companyId);
    },
    enabled: !!companyId,
  });
}

export function useExpiredDocuments() {
  const { companyId } = useTenant();

  return useQuery({
    queryKey: ['expired-documents', companyId],
    queryFn: async () => {
      if (!companyId) return [];

      const { data, error } = await supabase
        .rpc('get_expired_documents');

      if (error) throw error;
      
      // Filter to only this company
      return (data as { document_id: string; company_id: string; employee_id: string; document_title: string; document_type_name: string; expiry_date: string; days_expired: number }[])
        .filter(d => d.company_id === companyId);
    },
    enabled: !!companyId,
  });
}

export function useDocumentExpiryNotifications(documentId: string | null) {
  return useQuery({
    queryKey: ['document-expiry-notifications', documentId],
    queryFn: async () => {
      if (!documentId) return [];

      const { data, error } = await supabase
        .from('document_expiry_notifications')
        .select('*')
        .eq('document_id', documentId)
        .order('sent_at', { ascending: false });

      if (error) throw error;
      return data as DocumentExpiryNotification[];
    },
    enabled: !!documentId,
  });
}

// Manual trigger for document expiry cron (for admins)
export function useTriggerDocumentExpiryCron() {
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('cron-document-expiry');
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success(`Processed ${data.documentsExpired} expired docs, sent ${data.notificationsSent} notifications`);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to process document expiry');
    },
  });
}

// Manual trigger for subscription health cron (for platform admins)
export function useTriggerSubscriptionHealthCron() {
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('cron-subscription-health');
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success(`Processed ${data.trialsExpired} expired trials, sent ${data.trialWarningsSent} warnings`);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to process subscription health');
    },
  });
}
