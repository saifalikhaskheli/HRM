import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { startOfMonth, endOfMonth, subMonths, format } from 'date-fns';

export interface AttendanceAnalytics {
  totalDays: number;
  presentDays: number;
  absentDays: number;
  lateDays: number;
  averageHoursPerDay: number;
  attendanceRate: number;
  monthlyTrend: Array<{
    month: string;
    present: number;
    absent: number;
    late: number;
  }>;
}

export interface ExpenseAnalytics {
  totalAmount: number;
  pendingAmount: number;
  approvedAmount: number;
  rejectedAmount: number;
  categoryBreakdown: Array<{
    category: string;
    amount: number;
    count: number;
  }>;
  monthlyTrend: Array<{
    month: string;
    amount: number;
  }>;
}

export interface LeaveAnalytics {
  totalRequests: number;
  pendingRequests: number;
  approvedDays: number;
  utilizationRate: number;
  typeBreakdown: Array<{
    type: string;
    days: number;
    count: number;
    color: string;
  }>;
}

export interface PayrollAnalytics {
  totalGross: number;
  totalNet: number;
  totalDeductions: number;
  averageSalary: number;
  departmentBreakdown: Array<{
    department: string;
    totalCost: number;
    employeeCount: number;
  }>;
  monthlyTrend: Array<{
    month: string;
    gross: number;
    net: number;
  }>;
}

export function useAttendanceAnalytics() {
  const { companyId } = useTenant();
  
  return useQuery({
    queryKey: ['analytics', 'attendance', companyId],
    queryFn: async (): Promise<AttendanceAnalytics> => {
      if (!companyId) throw new Error('No company');
      
      const now = new Date();
      const sixMonthsAgo = subMonths(now, 6);
      
      const { data: entries, error } = await supabase
        .from('time_entries')
        .select('*')
        .eq('company_id', companyId)
        .gte('date', sixMonthsAgo.toISOString().split('T')[0]);
      
      if (error) throw error;
      
      const presentEntries = entries?.filter(e => e.attendance_status === 'present' || e.clock_in) || [];
      const absentEntries = entries?.filter(e => e.attendance_status === 'absent') || [];
      const lateEntries = entries?.filter(e => e.attendance_status === 'late' || (e.late_minutes && e.late_minutes > 0)) || [];
      
      const totalHours = presentEntries.reduce((sum, e) => sum + (e.total_hours || 0), 0);
      
      // Monthly trend
      const monthlyData: Record<string, { present: number; absent: number; late: number }> = {};
      for (let i = 5; i >= 0; i--) {
        const month = format(subMonths(now, i), 'MMM yyyy');
        monthlyData[month] = { present: 0, absent: 0, late: 0 };
      }
      
      entries?.forEach(entry => {
        const month = format(new Date(entry.date), 'MMM yyyy');
        if (monthlyData[month]) {
          if (entry.attendance_status === 'present' || entry.clock_in) monthlyData[month].present++;
          if (entry.attendance_status === 'absent') monthlyData[month].absent++;
          if (entry.attendance_status === 'late' || (entry.late_minutes && entry.late_minutes > 0)) monthlyData[month].late++;
        }
      });
      
      const totalDays = entries?.length || 0;
      
      return {
        totalDays,
        presentDays: presentEntries.length,
        absentDays: absentEntries.length,
        lateDays: lateEntries.length,
        averageHoursPerDay: presentEntries.length > 0 ? totalHours / presentEntries.length : 0,
        attendanceRate: totalDays > 0 ? (presentEntries.length / totalDays) * 100 : 0,
        monthlyTrend: Object.entries(monthlyData).map(([month, data]) => ({
          month,
          ...data,
        })),
      };
    },
    enabled: !!companyId,
    staleTime: 1000 * 60 * 5,
  });
}

export function useExpenseAnalytics() {
  const { companyId } = useTenant();
  
  return useQuery({
    queryKey: ['analytics', 'expenses', companyId],
    queryFn: async (): Promise<ExpenseAnalytics> => {
      if (!companyId) throw new Error('No company');
      
      const now = new Date();
      const sixMonthsAgo = subMonths(now, 6);
      
      const { data: expenses, error } = await supabase
        .from('expenses')
        .select('*, category:expense_categories(name)')
        .eq('company_id', companyId)
        .gte('expense_date', sixMonthsAgo.toISOString().split('T')[0]);
      
      if (error) throw error;
      
      const totalAmount = expenses?.reduce((sum, e) => sum + e.amount, 0) || 0;
      const pendingAmount = expenses?.filter(e => e.status === 'pending').reduce((sum, e) => sum + e.amount, 0) || 0;
      const approvedAmount = expenses?.filter(e => e.status === 'approved' || e.status === 'reimbursed').reduce((sum, e) => sum + e.amount, 0) || 0;
      const rejectedAmount = expenses?.filter(e => e.status === 'rejected').reduce((sum, e) => sum + e.amount, 0) || 0;
      
      // Category breakdown
      const categoryMap: Record<string, { amount: number; count: number }> = {};
      expenses?.forEach(e => {
        const catName = (e.category as any)?.name || 'Uncategorized';
        if (!categoryMap[catName]) categoryMap[catName] = { amount: 0, count: 0 };
        categoryMap[catName].amount += e.amount;
        categoryMap[catName].count++;
      });
      
      // Monthly trend
      const monthlyData: Record<string, number> = {};
      for (let i = 5; i >= 0; i--) {
        const month = format(subMonths(now, i), 'MMM yyyy');
        monthlyData[month] = 0;
      }
      
      expenses?.forEach(e => {
        const month = format(new Date(e.expense_date), 'MMM yyyy');
        if (monthlyData[month] !== undefined) monthlyData[month] += e.amount;
      });
      
      return {
        totalAmount,
        pendingAmount,
        approvedAmount,
        rejectedAmount,
        categoryBreakdown: Object.entries(categoryMap).map(([category, data]) => ({
          category,
          ...data,
        })).sort((a, b) => b.amount - a.amount),
        monthlyTrend: Object.entries(monthlyData).map(([month, amount]) => ({
          month,
          amount,
        })),
      };
    },
    enabled: !!companyId,
    staleTime: 1000 * 60 * 5,
  });
}

export function useLeaveAnalytics() {
  const { companyId } = useTenant();
  
  return useQuery({
    queryKey: ['analytics', 'leave', companyId],
    queryFn: async (): Promise<LeaveAnalytics> => {
      if (!companyId) throw new Error('No company');
      
      const startOfYear = new Date(new Date().getFullYear(), 0, 1);
      
      const { data: requests, error } = await supabase
        .from('leave_requests')
        .select('*, leave_type:leave_types(name, color, default_days)')
        .eq('company_id', companyId)
        .gte('start_date', startOfYear.toISOString().split('T')[0]);
      
      if (error) throw error;
      
      const pendingRequests = requests?.filter(r => r.status === 'pending').length || 0;
      const approvedDays = requests?.filter(r => r.status === 'approved').reduce((sum, r) => sum + r.total_days, 0) || 0;
      
      // Type breakdown
      const typeMap: Record<string, { days: number; count: number; color: string }> = {};
      requests?.filter(r => r.status === 'approved').forEach(r => {
        const typeName = (r.leave_type as any)?.name || 'Other';
        const color = (r.leave_type as any)?.color || '#3B82F6';
        if (!typeMap[typeName]) typeMap[typeName] = { days: 0, count: 0, color };
        typeMap[typeName].days += r.total_days;
        typeMap[typeName].count++;
      });
      
      // Get total available days for utilization rate
      const { count: employeeCount } = await supabase
        .from('employees')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .neq('employment_status', 'terminated');
      
      // Assume 20 days per employee average
      const totalAvailable = (employeeCount || 1) * 20;
      const utilizationRate = (approvedDays / totalAvailable) * 100;
      
      return {
        totalRequests: requests?.length || 0,
        pendingRequests,
        approvedDays,
        utilizationRate: Math.min(100, utilizationRate),
        typeBreakdown: Object.entries(typeMap).map(([type, data]) => ({
          type,
          ...data,
        })).sort((a, b) => b.days - a.days),
      };
    },
    enabled: !!companyId,
    staleTime: 1000 * 60 * 5,
  });
}

export function usePayrollAnalytics() {
  const { companyId } = useTenant();
  
  return useQuery({
    queryKey: ['analytics', 'payroll', companyId],
    queryFn: async (): Promise<PayrollAnalytics> => {
      if (!companyId) throw new Error('No company');
      
      const now = new Date();
      const sixMonthsAgo = subMonths(now, 6);
      
      const { data: runs, error } = await supabase
        .from('payroll_runs')
        .select('*')
        .eq('company_id', companyId)
        .gte('period_start', sixMonthsAgo.toISOString().split('T')[0])
        .eq('status', 'completed');
      
      if (error) throw error;
      
      const totalGross = runs?.reduce((sum, r) => sum + (r.total_gross || 0), 0) || 0;
      const totalNet = runs?.reduce((sum, r) => sum + (r.total_net || 0), 0) || 0;
      const totalDeductions = runs?.reduce((sum, r) => sum + (r.total_deductions || 0), 0) || 0;
      const totalEmployees = runs?.reduce((sum, r) => sum + (r.employee_count || 0), 0) || 0;
      
      // Monthly trend
      const monthlyData: Record<string, { gross: number; net: number }> = {};
      for (let i = 5; i >= 0; i--) {
        const month = format(subMonths(now, i), 'MMM yyyy');
        monthlyData[month] = { gross: 0, net: 0 };
      }
      
      runs?.forEach(r => {
        const month = format(new Date(r.period_start), 'MMM yyyy');
        if (monthlyData[month]) {
          monthlyData[month].gross += r.total_gross || 0;
          monthlyData[month].net += r.total_net || 0;
        }
      });
      
      // Department breakdown from employees
      const { data: employees } = await supabase
        .from('employees')
        .select('salary, department:departments(name)')
        .eq('company_id', companyId)
        .neq('employment_status', 'terminated');
      
      const deptMap: Record<string, { totalCost: number; employeeCount: number }> = {};
      employees?.forEach(e => {
        const deptName = (e.department as any)?.name || 'No Department';
        if (!deptMap[deptName]) deptMap[deptName] = { totalCost: 0, employeeCount: 0 };
        deptMap[deptName].totalCost += e.salary || 0;
        deptMap[deptName].employeeCount++;
      });
      
      return {
        totalGross,
        totalNet,
        totalDeductions,
        averageSalary: totalEmployees > 0 ? totalGross / totalEmployees : 0,
        departmentBreakdown: Object.entries(deptMap).map(([department, data]) => ({
          department,
          ...data,
        })).sort((a, b) => b.totalCost - a.totalCost),
        monthlyTrend: Object.entries(monthlyData).map(([month, data]) => ({
          month,
          ...data,
        })),
      };
    },
    enabled: !!companyId,
    staleTime: 1000 * 60 * 5,
  });
}
