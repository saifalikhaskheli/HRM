import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';

interface EmployeeWithoutUser {
  id: string;
  employee_number: string;
  first_name: string;
  last_name: string;
  email: string;
  job_title: string | null;
  department: {
    name: string;
  } | null;
}

export function useEmployeesWithoutUser() {
  const { companyId } = useTenant();

  return useQuery({
    queryKey: ['employees-without-user', companyId],
    queryFn: async (): Promise<EmployeeWithoutUser[]> => {
      if (!companyId) return [];

      const { data, error } = await supabase
        .from('employees')
        .select(`
          id,
          employee_number,
          first_name,
          last_name,
          email,
          job_title,
          department:departments!employees_department_id_fkey(name)
        `)
        .eq('company_id', companyId)
        .is('user_id', null)
        .eq('employment_status', 'active')
        .order('first_name', { ascending: true });

      if (error) {
        console.error('Error fetching employees without user:', error);
        throw error;
      }

      return (data || []).map(emp => ({
        ...emp,
        department: emp.department as { name: string } | null
      }));
    },
    enabled: !!companyId,
    refetchOnMount: 'always',
    staleTime: 0,
  });
}
