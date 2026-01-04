import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';

export interface EmailLog {
  id: string;
  company_id: string | null;
  template_type: string | null;
  subject: string;
  recipient_email: string;
  recipient_name: string | null;
  cc_emails: string[] | null;
  bcc_emails: string[] | null;
  status: 'pending' | 'sent' | 'failed';
  provider: string | null;
  message_id: string | null;
  error_message: string | null;
  error_code: string | null;
  retry_count: number;
  triggered_by: string | null;
  triggered_from: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  sent_at: string | null;
  updated_at: string;
}

export interface EmailLogFilters {
  status?: 'all' | 'pending' | 'sent' | 'failed';
  search?: string;
  dateFrom?: string;
  dateTo?: string;
}

export function useEmailLogs(filters?: EmailLogFilters) {
  const { companyId } = useTenant();

  return useQuery({
    queryKey: ['email-logs', companyId, filters],
    queryFn: async () => {
      if (!companyId) return [];

      let query = supabase
        .from('email_logs')
        .select('*')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });

      // Apply status filter
      if (filters?.status && filters.status !== 'all') {
        query = query.eq('status', filters.status);
      }

      // Apply search filter
      if (filters?.search) {
        query = query.or(`recipient_email.ilike.%${filters.search}%,subject.ilike.%${filters.search}%`);
      }

      // Apply date filters
      if (filters?.dateFrom) {
        query = query.gte('created_at', filters.dateFrom);
      }
      if (filters?.dateTo) {
        query = query.lte('created_at', filters.dateTo);
      }

      const { data, error } = await query.limit(500);

      if (error) {
        console.error('Failed to fetch email logs:', error);
        throw error;
      }

      return (data || []) as EmailLog[];
    },
    enabled: !!companyId,
  });
}

export function useEmailLogStats() {
  const { companyId } = useTenant();

  return useQuery({
    queryKey: ['email-log-stats', companyId],
    queryFn: async () => {
      if (!companyId) return { total: 0, sent: 0, failed: 0, pending: 0 };

      const { data, error } = await supabase
        .from('email_logs')
        .select('status')
        .eq('company_id', companyId);

      if (error) {
        console.error('Failed to fetch email log stats:', error);
        throw error;
      }

      const logs = data || [];
      return {
        total: logs.length,
        sent: logs.filter(l => l.status === 'sent').length,
        failed: logs.filter(l => l.status === 'failed').length,
        pending: logs.filter(l => l.status === 'pending').length,
      };
    },
    enabled: !!companyId,
  });
}
