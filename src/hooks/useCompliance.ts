import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';

export interface ComplianceStatus {
  category: string;
  name: string;
  status: 'compliant' | 'warning' | 'non_compliant' | 'not_applicable';
  message: string;
  count?: number;
  details?: Record<string, unknown>;
}

export interface ComplianceOverview {
  overallScore: number;
  totalChecks: number;
  compliantCount: number;
  warningCount: number;
  nonCompliantCount: number;
  checks: ComplianceStatus[];
}

// Calculate company compliance overview
export function useComplianceOverview() {
  const { companyId } = useTenant();

  return useQuery({
    queryKey: ['compliance', 'overview', companyId],
    queryFn: async (): Promise<ComplianceOverview> => {
      if (!companyId) throw new Error('No company');

      const checks: ComplianceStatus[] = [];

      // 1. Check for employees without documents
      const { count: employeesWithoutDocs } = await supabase
        .from('employees')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .neq('employment_status', 'terminated')
        .is('user_id', null); // No linked user often means incomplete onboarding

      checks.push({
        category: 'documents',
        name: 'Employee Documentation',
        status: (employeesWithoutDocs || 0) === 0 ? 'compliant' : 'warning',
        message: (employeesWithoutDocs || 0) === 0 
          ? 'All employees have linked accounts' 
          : `${employeesWithoutDocs} employees without linked user accounts`,
        count: employeesWithoutDocs || 0,
      });

      // 2. Check for expired documents
      const { count: expiredDocs } = await supabase
        .from('employee_documents')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .lt('expiry_date', new Date().toISOString().split('T')[0])
        .is('deleted_at', null);

      checks.push({
        category: 'documents',
        name: 'Document Expiry',
        status: (expiredDocs || 0) === 0 ? 'compliant' : 'non_compliant',
        message: (expiredDocs || 0) === 0 
          ? 'No expired documents' 
          : `${expiredDocs} expired documents need attention`,
        count: expiredDocs || 0,
      });

      // 3. Check for pending leave requests > 7 days
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { count: stalePendingLeave } = await supabase
        .from('leave_requests')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .eq('status', 'pending')
        .lt('created_at', sevenDaysAgo.toISOString());

      checks.push({
        category: 'leave',
        name: 'Leave Request Processing',
        status: (stalePendingLeave || 0) === 0 ? 'compliant' : 'warning',
        message: (stalePendingLeave || 0) === 0 
          ? 'All leave requests processed in time' 
          : `${stalePendingLeave} leave requests pending > 7 days`,
        count: stalePendingLeave || 0,
      });

      // 4. Check for employees past probation end date (still active but overdue review)
      const { data: probationOverdue } = await supabase
        .from('employees')
        .select('id')
        .eq('company_id', companyId)
        .eq('employment_status', 'active')
        .not('probation_end_date', 'is', null)
        .lt('probation_end_date', new Date().toISOString().split('T')[0]);

      const probationCount = probationOverdue?.length || 0;
      
      checks.push({
        category: 'hr',
        name: 'Probation Reviews',
        status: probationCount === 0 ? 'compliant' : 'warning',
        message: probationCount === 0
          ? 'All probation reviews completed' 
          : `${probationCount} employees past probation end date`,
        count: probationCount,
      });

      // 5. Check for pending expense claims > 14 days
      const fourteenDaysAgo = new Date();
      fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

      const { count: stalePendingExpenses } = await supabase
        .from('expenses')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .eq('status', 'pending')
        .lt('created_at', fourteenDaysAgo.toISOString());

      checks.push({
        category: 'finance',
        name: 'Expense Processing',
        status: (stalePendingExpenses || 0) === 0 ? 'compliant' : 'warning',
        message: (stalePendingExpenses || 0) === 0 
          ? 'All expenses processed in time' 
          : `${stalePendingExpenses} expenses pending > 14 days`,
        count: stalePendingExpenses || 0,
      });

      // 6. Check for departments without managers
      const { count: deptsWithoutManager } = await supabase
        .from('departments')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .eq('is_active', true)
        .is('manager_id', null);

      checks.push({
        category: 'organization',
        name: 'Department Management',
        status: (deptsWithoutManager || 0) === 0 ? 'compliant' : 'warning',
        message: (deptsWithoutManager || 0) === 0 
          ? 'All departments have managers' 
          : `${deptsWithoutManager} departments without managers`,
        count: deptsWithoutManager || 0,
      });

      // 7. Check for unprocessed payroll
      const currentMonth = new Date();
      const lastMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1);
      const lastMonthEnd = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 0);

      const { count: recentPayroll } = await supabase
        .from('payroll_runs')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .eq('status', 'completed')
        .gte('period_start', lastMonth.toISOString().split('T')[0])
        .lte('period_end', lastMonthEnd.toISOString().split('T')[0]);

      // Only check if it's after the 5th of the month
      if (currentMonth.getDate() > 5) {
        checks.push({
          category: 'payroll',
          name: 'Monthly Payroll',
          status: (recentPayroll || 0) > 0 ? 'compliant' : 'warning',
          message: (recentPayroll || 0) > 0 
            ? 'Last month payroll processed' 
            : 'Last month payroll not yet processed',
          count: recentPayroll || 0,
        });
      }

      // Calculate overall score
      const compliantCount = checks.filter(c => c.status === 'compliant').length;
      const warningCount = checks.filter(c => c.status === 'warning').length;
      const nonCompliantCount = checks.filter(c => c.status === 'non_compliant').length;
      const totalChecks = checks.length;

      // Score: compliant = 100%, warning = 50%, non_compliant = 0%
      const score = totalChecks > 0 
        ? ((compliantCount * 100) + (warningCount * 50)) / totalChecks
        : 100;

      return {
        overallScore: Math.round(score),
        totalChecks,
        compliantCount,
        warningCount,
        nonCompliantCount,
        checks,
      };
    },
    enabled: !!companyId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

// Get employees approaching work anniversary
export function useUpcomingAnniversaries(daysAhead = 30) {
  const { companyId } = useTenant();

  return useQuery({
    queryKey: ['anniversaries', companyId, daysAhead],
    queryFn: async () => {
      if (!companyId) return [];

      const today = new Date();
      const futureDate = new Date();
      futureDate.setDate(today.getDate() + daysAhead);

      const { data: employees, error } = await supabase
        .from('employees')
        .select('id, first_name, last_name, hire_date, email')
        .eq('company_id', companyId)
        .neq('employment_status', 'terminated')
        .not('hire_date', 'is', null);

      if (error) throw error;

      const currentYear = today.getFullYear();
      
      return (employees || [])
        .map(emp => {
          const hireDate = new Date(emp.hire_date);
          const anniversaryThisYear = new Date(currentYear, hireDate.getMonth(), hireDate.getDate());
          
          // Check if anniversary already passed this year
          if (anniversaryThisYear < today) {
            anniversaryThisYear.setFullYear(currentYear + 1);
          }

          const yearsOfService = anniversaryThisYear.getFullYear() - hireDate.getFullYear();
          const daysUntil = Math.ceil((anniversaryThisYear.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

          return {
            ...emp,
            anniversaryDate: anniversaryThisYear.toISOString().split('T')[0],
            yearsOfService,
            daysUntilAnniversary: daysUntil,
          };
        })
        .filter(emp => emp.daysUntilAnniversary <= daysAhead && emp.daysUntilAnniversary >= 0)
        .sort((a, b) => a.daysUntilAnniversary - b.daysUntilAnniversary);
    },
    enabled: !!companyId,
  });
}

// Get employees with upcoming probation end dates
export function useUpcomingProbationEnds(daysAhead = 14) {
  const { companyId } = useTenant();

  return useQuery({
    queryKey: ['probation-ends', companyId, daysAhead],
    queryFn: async () => {
      if (!companyId) return [];

      const today = new Date().toISOString().split('T')[0];
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + daysAhead);
      const futureDateStr = futureDate.toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('employees')
        .select('id, first_name, last_name, hire_date, probation_end_date, email, department:departments(name)')
        .eq('company_id', companyId)
        .eq('employment_status', 'active')
        .not('probation_end_date', 'is', null)
        .gte('probation_end_date', today)
        .lte('probation_end_date', futureDateStr)
        .order('probation_end_date');

      if (error) throw error;
      return data || [];
    },
    enabled: !!companyId,
  });
}

// Get employees with birthdays coming up
export function useUpcomingBirthdays(daysAhead = 14) {
  const { companyId } = useTenant();

  return useQuery({
    queryKey: ['birthdays', companyId, daysAhead],
    queryFn: async () => {
      if (!companyId) return [];

      const { data: employees, error } = await supabase
        .from('employees')
        .select('id, first_name, last_name, date_of_birth')
        .eq('company_id', companyId)
        .neq('employment_status', 'terminated')
        .not('date_of_birth', 'is', null);

      if (error) throw error;

      const today = new Date();
      const currentYear = today.getFullYear();

      return (employees || [])
        .map(emp => {
          const dob = new Date(emp.date_of_birth);
          const birthdayThisYear = new Date(currentYear, dob.getMonth(), dob.getDate());
          
          if (birthdayThisYear < today) {
            birthdayThisYear.setFullYear(currentYear + 1);
          }

          const daysUntil = Math.ceil((birthdayThisYear.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

          return {
            ...emp,
            birthdayDate: birthdayThisYear.toISOString().split('T')[0],
            daysUntilBirthday: daysUntil,
          };
        })
        .filter(emp => emp.daysUntilBirthday <= daysAhead && emp.daysUntilBirthday >= 0)
        .sort((a, b) => a.daysUntilBirthday - b.daysUntilBirthday);
    },
    enabled: !!companyId,
  });
}
