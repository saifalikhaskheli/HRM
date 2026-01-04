import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface PlatformEmailLog {
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
  company_name?: string;
}

export interface PlatformEmailLogFilters {
  status?: 'all' | 'pending' | 'sent' | 'failed';
  search?: string;
  companyId?: string;
  dateFrom?: string;
  dateTo?: string;
}

export function usePlatformEmailLogs(filters?: PlatformEmailLogFilters) {
  return useQuery({
    queryKey: ['platform-email-logs', filters],
    queryFn: async () => {
      let query = supabase
        .from('email_logs')
        .select(`
          *,
          companies:company_id (name)
        `)
        .order('created_at', { ascending: false });

      // Apply status filter
      if (filters?.status && filters.status !== 'all') {
        query = query.eq('status', filters.status);
      }

      // Apply company filter
      if (filters?.companyId) {
        query = query.eq('company_id', filters.companyId);
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

      const { data, error } = await query.limit(1000);

      if (error) {
        console.error('Failed to fetch platform email logs:', error);
        throw error;
      }

      return (data || []).map((log: any) => ({
        ...log,
        company_name: log.companies?.name || null,
      })) as PlatformEmailLog[];
    },
  });
}

export function usePlatformEmailLogStats() {
  return useQuery({
    queryKey: ['platform-email-log-stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('email_logs')
        .select('status');

      if (error) {
        console.error('Failed to fetch platform email log stats:', error);
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
  });
}

export function usePlatformCompaniesForFilter() {
  return useQuery({
    queryKey: ['platform-companies-for-email-filter'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('companies')
        .select('id, name')
        .order('name');

      if (error) {
        console.error('Failed to fetch companies:', error);
        throw error;
      }

      return data || [];
    },
  });
}
