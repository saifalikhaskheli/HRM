import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { Tables } from '@/integrations/supabase/types';

export type AuditLog = Tables<'audit_logs'> & {
  user_name?: string | null;
  user_email?: string | null;
};

type AuditAction = 'create' | 'read' | 'update' | 'delete' | 'login' | 'logout' | 'export' | 'import';

export interface AuditLogFilters {
  action?: AuditAction;
  tableName?: string;
  userId?: string;
  startDate?: string;
  endDate?: string;
  searchTerm?: string;
}

export function useAuditLogs(filters: AuditLogFilters = {}, page = 1, pageSize = 50) {
  const { companyId } = useTenant();

  return useQuery({
    queryKey: ['audit-logs', companyId, filters, page, pageSize],
    queryFn: async () => {
      if (!companyId) return { logs: [], total: 0 };

      // First get the audit logs
      let query = supabase
        .from('audit_logs')
        .select('*', { count: 'exact' })
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });

      // Apply filters
      if (filters.action) {
        query = query.eq('action', filters.action);
      }
      if (filters.tableName) {
        query = query.eq('table_name', filters.tableName);
      }
      if (filters.userId) {
        query = query.eq('user_id', filters.userId);
      }
      if (filters.startDate) {
        query = query.gte('created_at', filters.startDate);
      }
      if (filters.endDate) {
        query = query.lte('created_at', filters.endDate);
      }

      // Pagination
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);

      const { data: logs, error, count } = await query;

      if (error) throw error;

      // Get unique user IDs to fetch profiles
      const userIds = [...new Set(logs?.map(l => l.user_id).filter(Boolean) as string[])];
      
      let profilesMap: Record<string, { first_name: string | null; last_name: string | null; email: string }> = {};
      
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, first_name, last_name, email')
          .in('id', userIds);
        
        if (profiles) {
          profilesMap = profiles.reduce((acc, p) => {
            acc[p.id] = { first_name: p.first_name, last_name: p.last_name, email: p.email };
            return acc;
          }, {} as typeof profilesMap);
        }
      }

      // Enhance logs with user info
      const enhancedLogs = logs?.map(log => {
        const profile = log.user_id ? profilesMap[log.user_id] : null;
        const fullName = profile 
          ? [profile.first_name, profile.last_name].filter(Boolean).join(' ') || null
          : null;
        return {
          ...log,
          user_name: fullName,
          user_email: profile?.email || null,
        };
      }) as AuditLog[];

      return { logs: enhancedLogs, total: count || 0 };
    },
    enabled: !!companyId,
  });
}

export function useAuditLogStats() {
  const { companyId } = useTenant();

  return useQuery({
    queryKey: ['audit-log-stats', companyId],
    queryFn: async () => {
      if (!companyId) return null;

      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7).toISOString();

      const [todayResult, weekResult, tablesResult] = await Promise.all([
        supabase
          .from('audit_logs')
          .select('id', { count: 'exact', head: true })
          .eq('company_id', companyId)
          .gte('created_at', startOfDay),
        supabase
          .from('audit_logs')
          .select('id', { count: 'exact', head: true })
          .eq('company_id', companyId)
          .gte('created_at', startOfWeek),
        supabase
          .from('audit_logs')
          .select('table_name, action')
          .eq('company_id', companyId)
          .gte('created_at', startOfWeek),
      ]);

      // Count by table
      const tableCounts = new Map<string, number>();
      const actionCounts = new Map<string, number>();
      tablesResult.data?.forEach(log => {
        tableCounts.set(log.table_name, (tableCounts.get(log.table_name) || 0) + 1);
        actionCounts.set(log.action, (actionCounts.get(log.action) || 0) + 1);
      });

      return {
        todayCount: todayResult.count || 0,
        weekCount: weekResult.count || 0,
        byTable: Array.from(tableCounts.entries()).map(([table, count]) => ({ table, count })),
        byAction: Array.from(actionCounts.entries()).map(([action, count]) => ({ action, count })),
      };
    },
    enabled: !!companyId,
  });
}

export function useSecurityEvents() {
  const { companyId } = useTenant();

  return useQuery({
    queryKey: ['security-events', companyId],
    queryFn: async () => {
      if (!companyId) return [];

      const { data, error } = await supabase
        .from('security_events')
        .select('*')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      return data;
    },
    enabled: !!companyId,
  });
}

// Get unique table names for filter dropdown
export function useAuditLogTables() {
  const { companyId } = useTenant();

  return useQuery({
    queryKey: ['audit-log-tables', companyId],
    queryFn: async () => {
      if (!companyId) return [];

      const { data, error } = await supabase
        .from('audit_logs')
        .select('table_name')
        .eq('company_id', companyId);

      if (error) throw error;

      const tables = [...new Set(data?.map(d => d.table_name))].sort();
      return tables;
    },
    enabled: !!companyId,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}
