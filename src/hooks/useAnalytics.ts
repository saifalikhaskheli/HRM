import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';

export interface DashboardStats {
  totalEmployees: number;
  activeEmployees: number;
  newHiresThisMonth: number;
  terminationsThisMonth: number;
  pendingLeaveRequests: number;
  openPositions: number;
  pendingReviews: number;
  departmentBreakdown: { name: string; count: number }[];
  employmentTypeBreakdown: { type: string; count: number }[];
  headcountTrend: { month: string; count: number }[];
}

export function useDashboardStats() {
  const { companyId, isHR, isManager } = useTenant();

  return useQuery({
    queryKey: ['dashboard-stats', companyId],
    queryFn: async (): Promise<DashboardStats> => {
      if (!companyId) {
        return getEmptyStats();
      }

      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      // Fetch all data in parallel
      const [
        employeesResult,
        leaveResult,
        jobsResult,
        reviewsResult,
        departmentsResult,
      ] = await Promise.all([
        supabase
          .from('employees')
          .select('id, employment_status, employment_type, hire_date, termination_date, department_id')
          .eq('company_id', companyId),
        supabase
          .from('leave_requests')
          .select('id, status')
          .eq('company_id', companyId)
          .eq('status', 'pending'),
        supabase
          .from('jobs')
          .select('id')
          .eq('company_id', companyId)
          .eq('status', 'open'),
        supabase
          .from('performance_reviews')
          .select('id, status')
          .eq('company_id', companyId)
          .in('status', ['draft', 'in_progress']),
        supabase
          .from('departments')
          .select('id, name')
          .eq('company_id', companyId)
          .eq('is_active', true),
      ]);

      const employees = employeesResult.data || [];
      const leaveRequests = leaveResult.data || [];
      const openJobs = jobsResult.data || [];
      const pendingReviews = reviewsResult.data || [];
      const departments = departmentsResult.data || [];

      // Calculate stats
      const activeEmployees = employees.filter(e => e.employment_status === 'active');
      const newHires = employees.filter(e => e.hire_date && e.hire_date >= startOfMonth.split('T')[0]);
      const terminations = employees.filter(e => e.termination_date && e.termination_date >= startOfMonth.split('T')[0]);

      // Department breakdown
      const deptCounts = new Map<string, number>();
      departments.forEach(d => deptCounts.set(d.id, 0));
      employees.forEach(e => {
        if (e.department_id && deptCounts.has(e.department_id)) {
          deptCounts.set(e.department_id, (deptCounts.get(e.department_id) || 0) + 1);
        }
      });
      const departmentBreakdown = departments.map(d => ({
        name: d.name,
        count: deptCounts.get(d.id) || 0,
      })).sort((a, b) => b.count - a.count);

      // Employment type breakdown
      const typeCounts = new Map<string, number>();
      employees.forEach(e => {
        const type = e.employment_type || 'unknown';
        typeCounts.set(type, (typeCounts.get(type) || 0) + 1);
      });
      const employmentTypeBreakdown = Array.from(typeCounts.entries()).map(([type, count]) => ({
        type: type.replace('_', ' '),
        count,
      }));

      // Headcount trend (last 6 months)
      const headcountTrend: { month: string; count: number }[] = [];
      for (let i = 5; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);
        const monthStr = monthEnd.toISOString().split('T')[0];
        const monthLabel = date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
        
        const count = employees.filter(e => {
          const hireDate = e.hire_date;
          const termDate = e.termination_date;
          return hireDate && hireDate <= monthStr && (!termDate || termDate > monthStr);
        }).length;
        
        headcountTrend.push({ month: monthLabel, count });
      }

      return {
        totalEmployees: employees.length,
        activeEmployees: activeEmployees.length,
        newHiresThisMonth: newHires.length,
        terminationsThisMonth: terminations.length,
        pendingLeaveRequests: leaveRequests.length,
        openPositions: openJobs.length,
        pendingReviews: pendingReviews.length,
        departmentBreakdown,
        employmentTypeBreakdown,
        headcountTrend,
      };
    },
    enabled: !!companyId && (isHR || isManager),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

function getEmptyStats(): DashboardStats {
  return {
    totalEmployees: 0,
    activeEmployees: 0,
    newHiresThisMonth: 0,
    terminationsThisMonth: 0,
    pendingLeaveRequests: 0,
    openPositions: 0,
    pendingReviews: 0,
    departmentBreakdown: [],
    employmentTypeBreakdown: [],
    headcountTrend: [],
  };
}

// Leave analytics
export function useLeaveAnalytics() {
  const { companyId } = useTenant();

  return useQuery({
    queryKey: ['leave-analytics', companyId],
    queryFn: async () => {
      if (!companyId) return null;

      const year = new Date().getFullYear();
      const startOfYear = `${year}-01-01`;

      const { data: requests, error } = await supabase
        .from('leave_requests')
        .select(`
          id,
          status,
          total_days,
          start_date,
          leave_type:leave_types(name, code, color)
        `)
        .eq('company_id', companyId)
        .gte('start_date', startOfYear);

      if (error) throw error;

      const byType = new Map<string, { name: string; days: number; color: string }>();
      const byMonth = new Map<string, number>();

      requests?.forEach(r => {
        if (r.status === 'approved') {
          const typeName = (r.leave_type as any)?.name || 'Unknown';
          const typeColor = (r.leave_type as any)?.color || '#3B82F6';
          const current = byType.get(typeName) || { name: typeName, days: 0, color: typeColor };
          byType.set(typeName, { ...current, days: current.days + (r.total_days || 0) });

          const month = new Date(r.start_date).toLocaleDateString('en-US', { month: 'short' });
          byMonth.set(month, (byMonth.get(month) || 0) + (r.total_days || 0));
        }
      });

      return {
        byType: Array.from(byType.values()),
        byMonth: Array.from(byMonth.entries()).map(([month, days]) => ({ month, days })),
        totalRequests: requests?.length || 0,
        approvedDays: requests?.filter(r => r.status === 'approved').reduce((sum, r) => sum + (r.total_days || 0), 0) || 0,
      };
    },
    enabled: !!companyId,
  });
}
