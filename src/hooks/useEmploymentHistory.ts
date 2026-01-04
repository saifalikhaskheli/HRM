import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

export interface EmploymentHistoryRecord {
  id: string;
  employee_id: string;
  company_id: string;
  job_title: string;
  department_id: string | null;
  effective_from: string;
  effective_to: string | null;
  change_type: string;
  reason: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  department?: { name: string } | null;
}

export function useEmploymentHistory(employeeId: string | undefined) {
  const { companyId } = useTenant();

  return useQuery({
    queryKey: ['employment-history', employeeId, companyId],
    queryFn: async () => {
      if (!employeeId || !companyId) return [];

      const { data, error } = await supabase
        .from('employment_history')
        .select(`
          *,
          department:departments(name)
        `)
        .eq('employee_id', employeeId)
        .eq('company_id', companyId)
        .order('effective_from', { ascending: false });

      if (error) throw error;
      return data as EmploymentHistoryRecord[];
    },
    enabled: !!employeeId && !!companyId,
  });
}

export function useLatestEmploymentHistory(employeeId: string | undefined) {
  const { data } = useEmploymentHistory(employeeId);
  
  // Get the current (latest) employment record
  const current = data?.find(h => h.effective_to === null) || data?.[0];
  
  // Get last promotion
  const lastPromotion = data?.find(h => h.change_type === 'promotion');
  
  return {
    current,
    lastPromotion,
    history: data || [],
  };
}

interface CreatePromotionParams {
  employee_id: string;
  new_job_title: string;
  new_department_id?: string | null;
  effective_from: string;
  reason?: string;
  notes?: string;
  salary_increase?: number;
  salary_currency?: string;
}

export function useCreatePromotion() {
  const { companyId } = useTenant();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: CreatePromotionParams) => {
      if (!companyId) throw new Error('No company selected');

      // 1. Close any existing current employment record
      const { data: currentRecords } = await supabase
        .from('employment_history')
        .select('id')
        .eq('employee_id', params.employee_id)
        .eq('company_id', companyId)
        .is('effective_to', null);

      if (currentRecords && currentRecords.length > 0) {
        // Close the current record by setting effective_to to day before new effective_from
        const effectiveToDate = new Date(params.effective_from);
        effectiveToDate.setDate(effectiveToDate.getDate() - 1);
        
        await supabase
          .from('employment_history')
          .update({ effective_to: effectiveToDate.toISOString().split('T')[0] })
          .eq('id', currentRecords[0].id);
      }

      // 2. Create new employment history record
      const { error: historyError } = await supabase
        .from('employment_history')
        .insert({
          employee_id: params.employee_id,
          company_id: companyId,
          job_title: params.new_job_title,
          department_id: params.new_department_id || null,
          effective_from: params.effective_from,
          change_type: 'promotion',
          reason: params.reason || null,
          notes: params.notes || null,
          created_by: user?.user_id || null,
        });

      if (historyError) throw historyError;

      // 3. Update employee record with new job title and department
      const { error: employeeError } = await supabase
        .from('employees')
        .update({
          job_title: params.new_job_title,
          department_id: params.new_department_id || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', params.employee_id);

      if (employeeError) throw employeeError;

      // 4. If salary increase is specified, create salary history record
      if (params.salary_increase && params.salary_increase > 0) {
        // Get current salary
        const { data: currentSalary } = await supabase
          .from('salary_history')
          .select('*')
          .eq('employee_id', params.employee_id)
          .eq('company_id', companyId)
          .is('effective_to', null)
          .order('effective_from', { ascending: false })
          .limit(1)
          .maybeSingle();

        const newSalary = (currentSalary?.base_salary || 0) + params.salary_increase;
        
        // Close current salary record
        if (currentSalary) {
          const effectiveToDate = new Date(params.effective_from);
          effectiveToDate.setDate(effectiveToDate.getDate() - 1);
          
          await supabase
            .from('salary_history')
            .update({ effective_to: effectiveToDate.toISOString().split('T')[0] })
            .eq('id', currentSalary.id);
        }

        // Create new salary record
        await supabase
          .from('salary_history')
          .insert({
            employee_id: params.employee_id,
            company_id: companyId,
            base_salary: newSalary,
            salary_currency: params.salary_currency || currentSalary?.salary_currency || 'USD',
            effective_from: params.effective_from,
            reason: 'Promotion',
            created_by: user?.user_id || null,
          });
      }

      return { success: true };
    },
    onSuccess: (_, params) => {
      queryClient.invalidateQueries({ queryKey: ['employment-history', params.employee_id] });
      queryClient.invalidateQueries({ queryKey: ['salary-history', params.employee_id] });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      queryClient.invalidateQueries({ queryKey: ['employee', params.employee_id] });
      toast.success('Employee promoted successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to process promotion');
    },
  });
}
