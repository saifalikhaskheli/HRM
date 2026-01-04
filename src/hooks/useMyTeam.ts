import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { useAuth } from '@/contexts/AuthContext';

export interface TeamMember {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  job_title: string | null;
  employment_status: string;
  department: { name: string } | null;
  pending_leave_count: number;
  pending_expense_count: number;
  is_on_leave: boolean;
}

export interface TeamStats {
  teamSize: number;
  pendingApprovals: number;
  outToday: number;
  onLeaveToday: string[];
}

export function useMyTeam() {
  const { companyId, employeeId } = useTenant();
  const { user } = useAuth();
  const userId = user?.user_id;

  return useQuery({
    queryKey: ['my-team', companyId, employeeId, userId],
    queryFn: async (): Promise<TeamMember[]> => {
      console.log('[useMyTeam] Starting query with:', { companyId, employeeId, userId });
      
      if (!companyId) {
        console.log('[useMyTeam] No companyId, returning empty');
        return [];
      }

      // Use employeeId from context first, fallback to query
      let managerId = employeeId;
      if (!managerId && userId) {
        console.log('[useMyTeam] No employeeId, falling back to userId lookup');
        const { data: currentEmployee } = await supabase
          .from('employees')
          .select('id')
          .eq('company_id', companyId)
          .eq('user_id', userId)
          .maybeSingle();
        managerId = currentEmployee?.id;
        console.log('[useMyTeam] Fallback lookup result:', managerId);
      }

      if (!managerId) {
        console.log('[useMyTeam] No managerId found, returning empty');
        return [];
      }
      
      console.log('[useMyTeam] Using managerId:', managerId);

      // Get direct reports (employees where manager_id = current employee)
      const { data: directReports, error: reportsError } = await supabase
        .from('employees')
        .select(`
          id,
          first_name,
          last_name,
          email,
          job_title,
          employment_status,
          department:departments!employees_department_id_fkey(name)
        `)
        .eq('company_id', companyId)
        .eq('manager_id', managerId)
        .neq('employment_status', 'terminated');

      console.log('[useMyTeam] Direct reports query result:', { directReports, reportsError });

      if (reportsError) throw reportsError;
      
      // Also check if user is department manager
      const { data: managedDepartments } = await supabase
        .from('departments')
        .select('id')
        .eq('company_id', companyId)
        .eq('manager_id', managerId);

      const deptIds = managedDepartments?.map(d => d.id) || [];
      
      let deptEmployees: any[] = [];
      if (deptIds.length > 0) {
        const { data: deptEmps } = await supabase
          .from('employees')
          .select(`
            id,
            first_name,
            last_name,
            email,
            job_title,
            employment_status,
            department:departments!employees_department_id_fkey(name)
          `)
          .eq('company_id', companyId)
          .in('department_id', deptIds)
          .neq('id', managerId)
          .neq('employment_status', 'terminated');
        deptEmployees = deptEmps || [];
      }

      // Merge and deduplicate
      const allEmployeesMap = new Map<string, any>();
      [...(directReports || []), ...deptEmployees].forEach(emp => {
        if (!allEmployeesMap.has(emp.id)) {
          allEmployeesMap.set(emp.id, emp);
        }
      });
      const allEmployees = Array.from(allEmployeesMap.values());

      if (allEmployees.length === 0) return [];

      const today = new Date().toISOString().split('T')[0];
      const employeeIds = allEmployees.map(e => e.id);

      // Get pending leave requests for team members
      const { data: pendingLeaves } = await supabase
        .from('leave_requests')
        .select('employee_id, start_date, end_date, status')
        .eq('company_id', companyId)
        .in('employee_id', employeeIds);

      // Get pending expenses for team members
      const { data: pendingExpenses } = await supabase
        .from('expenses')
        .select('employee_id')
        .eq('company_id', companyId)
        .in('employee_id', employeeIds)
        .eq('status', 'pending');

      // Map data
      return allEmployees.map(emp => {
        const empLeaves = pendingLeaves?.filter(l => l.employee_id === emp.id) || [];
        const pendingLeaveCount = empLeaves.filter(l => l.status === 'pending').length;
        const isOnLeave = empLeaves.some(l => 
          l.status === 'approved' && 
          l.start_date <= today && 
          l.end_date >= today
        );
        const pendingExpenseCount = pendingExpenses?.filter(e => e.employee_id === emp.id).length || 0;

        return {
          id: emp.id,
          first_name: emp.first_name,
          last_name: emp.last_name,
          email: emp.email,
          job_title: emp.job_title,
          employment_status: emp.employment_status,
          department: Array.isArray(emp.department) ? emp.department[0] : emp.department,
          pending_leave_count: pendingLeaveCount,
          pending_expense_count: pendingExpenseCount,
          is_on_leave: isOnLeave,
        };
      });
    },
    enabled: !!companyId && (!!employeeId || !!userId),
    staleTime: 0,
    refetchOnMount: 'always' as const,
  });
}

export function useTeamStats() {
  const { companyId, employeeId } = useTenant();
  const { user } = useAuth();
  const userId = user?.user_id;

  return useQuery({
    queryKey: ['team-stats', companyId, employeeId],
    queryFn: async (): Promise<TeamStats> => {
      if (!companyId) {
        return { teamSize: 0, pendingApprovals: 0, outToday: 0, onLeaveToday: [] };
      }

      // Get current employee - use employeeId from context
      let managerId = employeeId;
      if (!managerId && userId) {
        const { data: currentEmployee } = await supabase
          .from('employees')
          .select('id')
          .eq('company_id', companyId)
          .eq('user_id', userId)
          .maybeSingle();
        managerId = currentEmployee?.id;
      }

      if (!managerId) {
        return { teamSize: 0, pendingApprovals: 0, outToday: 0, onLeaveToday: [] };
      }

      // Get team members (direct reports + department members if dept manager)
      const { data: directReports } = await supabase
        .from('employees')
        .select('id, first_name, last_name')
        .eq('company_id', companyId)
        .eq('manager_id', managerId)
        .neq('employment_status', 'terminated');

      const { data: managedDepartments } = await supabase
        .from('departments')
        .select('id')
        .eq('company_id', companyId)
        .eq('manager_id', managerId);

      const deptIds = managedDepartments?.map(d => d.id) || [];
      
      let deptEmployees: any[] = [];
      if (deptIds.length > 0) {
        const { data: deptEmps } = await supabase
          .from('employees')
          .select('id, first_name, last_name')
          .eq('company_id', companyId)
          .in('department_id', deptIds)
          .neq('id', managerId)
          .neq('employment_status', 'terminated');
        deptEmployees = deptEmps || [];
      }

      // Merge and deduplicate
      const allEmployeesMap = new Map<string, any>();
      [...(directReports || []), ...deptEmployees].forEach(emp => {
        if (!allEmployeesMap.has(emp.id)) {
          allEmployeesMap.set(emp.id, emp);
        }
      });
      const teamMembers = Array.from(allEmployeesMap.values());
      const teamSize = teamMembers.length;
      const employeeIds = teamMembers.map(e => e.id);

      if (employeeIds.length === 0) {
        return { teamSize: 0, pendingApprovals: 0, outToday: 0, onLeaveToday: [] };
      }

      const today = new Date().toISOString().split('T')[0];

      // Get pending leave requests
      const { data: pendingLeaves } = await supabase
        .from('leave_requests')
        .select('id')
        .eq('company_id', companyId)
        .in('employee_id', employeeIds)
        .eq('status', 'pending');

      // Get who's on approved leave today
      const { data: onLeaveToday } = await supabase
        .from('leave_requests')
        .select('employee_id')
        .eq('company_id', companyId)
        .in('employee_id', employeeIds)
        .eq('status', 'approved')
        .lte('start_date', today)
        .gte('end_date', today);

      const outEmployeeIds = new Set(onLeaveToday?.map(l => l.employee_id) || []);
      const onLeaveNames = teamMembers
        .filter(e => outEmployeeIds.has(e.id))
        .map(e => `${e.first_name} ${e.last_name}`);

      return {
        teamSize,
        pendingApprovals: pendingLeaves?.length || 0,
        outToday: outEmployeeIds.size,
        onLeaveToday: onLeaveNames,
      };
    },
    enabled: !!companyId && (!!employeeId || !!userId),
    staleTime: 0,
    refetchOnMount: 'always' as const,
  });
}

export function useTeamLeaves() {
  const { companyId, employeeId } = useTenant();
  const { user } = useAuth();
  const userId = user?.user_id;

  return useQuery({
    queryKey: ['team-leaves', companyId, employeeId],
    queryFn: async () => {
      if (!companyId) return [];

      // Get current employee
      let managerId = employeeId;
      if (!managerId && userId) {
        const { data: currentEmployee } = await supabase
          .from('employees')
          .select('id')
          .eq('company_id', companyId)
          .eq('user_id', userId)
          .maybeSingle();
        managerId = currentEmployee?.id;
      }

      if (!managerId) return [];

      // Get team members
      const { data: directReports } = await supabase
        .from('employees')
        .select('id')
        .eq('company_id', companyId)
        .eq('manager_id', managerId)
        .neq('employment_status', 'terminated');

      const employeeIds = directReports?.map(e => e.id) || [];
      if (employeeIds.length === 0) return [];

      // Get approved leaves
      const { data: leaves, error } = await supabase
        .from('leave_requests')
        .select(`
          id,
          start_date,
          end_date,
          status,
          employee:employees(id, first_name, last_name),
          leave_type:leave_types(name, color)
        `)
        .eq('company_id', companyId)
        .in('employee_id', employeeIds)
        .eq('status', 'approved');

      if (error) throw error;
      return leaves || [];
    },
    enabled: !!companyId,
  });
}

export function usePendingApprovalsCount() {
  const { companyId, employeeId } = useTenant();
  const { user } = useAuth();
  const userId = user?.user_id;

  return useQuery({
    queryKey: ['pending-approvals-count', companyId, employeeId],
    queryFn: async (): Promise<number> => {
      if (!companyId) return 0;

      // Get current employee
      let managerId = employeeId;
      if (!managerId && userId) {
        const { data: currentEmployee } = await supabase
          .from('employees')
          .select('id')
          .eq('company_id', companyId)
          .eq('user_id', userId)
          .maybeSingle();
        managerId = currentEmployee?.id;
      }

      if (!managerId) return 0;

      // Get team member IDs
      const { data: teamMembers } = await supabase
        .from('employees')
        .select('id')
        .eq('company_id', companyId)
        .eq('manager_id', managerId)
        .neq('employment_status', 'terminated');

      const employeeIds = teamMembers?.map(e => e.id) || [];
      if (employeeIds.length === 0) return 0;

      // Count pending leave requests
      const { count } = await supabase
        .from('leave_requests')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .in('employee_id', employeeIds)
        .eq('status', 'pending');

      return count || 0;
    },
    enabled: !!companyId,
    staleTime: 1000 * 30,
  });
}

export function useTeamTimeEntries(startDate?: string, endDate?: string) {
  const { companyId, employeeId } = useTenant();
  
  return useQuery({
    queryKey: ['team-time-entries', companyId, employeeId, startDate, endDate],
    queryFn: async () => {
      if (!companyId || !employeeId) return [];

      // Get team members
      const { data: directReports } = await supabase
        .from('employees')
        .select('id')
        .eq('company_id', companyId)
        .eq('manager_id', employeeId)
        .neq('employment_status', 'terminated');

      const employeeIds = directReports?.map(e => e.id) || [];
      if (employeeIds.length === 0) return [];

      let query = supabase
        .from('time_entries')
        .select(`
          *,
          employee:employees(id, first_name, last_name, employee_number)
        `)
        .eq('company_id', companyId)
        .in('employee_id', employeeIds)
        .order('date', { ascending: false });

      if (startDate) query = query.gte('date', startDate);
      if (endDate) query = query.lte('date', endDate);

      const { data, error } = await query.limit(200);
      if (error) throw error;
      return data || [];
    },
    enabled: !!companyId && !!employeeId,
  });
}

export function useTeamPerformanceReviews() {
  const { companyId, employeeId } = useTenant();
  
  return useQuery({
    queryKey: ['team-performance-reviews', companyId, employeeId],
    queryFn: async () => {
      if (!companyId || !employeeId) return [];

      // Get team members
      const { data: directReports } = await supabase
        .from('employees')
        .select('id')
        .eq('company_id', companyId)
        .eq('manager_id', employeeId)
        .neq('employment_status', 'terminated');

      const employeeIds = directReports?.map(e => e.id) || [];
      if (employeeIds.length === 0) return [];

      const { data, error } = await supabase
        .from('performance_reviews')
        .select(`
          *,
          employee:employees(id, first_name, last_name),
          reviewer:employees!performance_reviews_reviewer_id_fkey(id, first_name, last_name)
        `)
        .eq('company_id', companyId)
        .in('employee_id', employeeIds)
        .order('review_date', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!companyId && !!employeeId,
  });
}
