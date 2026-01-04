import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';

export interface DashboardStats {
  totalEmployees: number;
  pendingLeave: number;
  activeDepartments: number;
  openPositions: number;
}

export function useDashboardStats() {
  const { companyId } = useTenant();

  return useQuery({
    queryKey: ['dashboard-stats', companyId],
    queryFn: async (): Promise<DashboardStats> => {
      if (!companyId) {
        return {
          totalEmployees: 0,
          pendingLeave: 0,
          activeDepartments: 0,
          openPositions: 0,
        };
      }

      // Fetch all counts in parallel
      const [employeesRes, leaveRes, departmentsRes, jobsRes] = await Promise.all([
        supabase
          .from('employees')
          .select('id', { count: 'exact', head: true })
          .eq('company_id', companyId)
          .neq('employment_status', 'terminated'),
        supabase
          .from('leave_requests')
          .select('id', { count: 'exact', head: true })
          .eq('company_id', companyId)
          .eq('status', 'pending'),
        supabase
          .from('departments')
          .select('id', { count: 'exact', head: true })
          .eq('company_id', companyId)
          .eq('is_active', true),
        supabase
          .from('jobs')
          .select('id', { count: 'exact', head: true })
          .eq('company_id', companyId)
          .eq('status', 'open'),
      ]);

      return {
        totalEmployees: employeesRes.count ?? 0,
        pendingLeave: leaveRes.count ?? 0,
        activeDepartments: departmentsRes.count ?? 0,
        openPositions: jobsRes.count ?? 0,
      };
    },
    enabled: !!companyId,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}
