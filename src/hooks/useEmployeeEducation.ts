import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { toast } from 'sonner';

export interface Education {
  id: string;
  employee_id: string;
  company_id: string;
  institution: string;
  degree: string;
  field_of_study: string | null;
  start_date: string | null;
  end_date: string | null;
  grade: string | null;
  is_current: boolean;
  description: string | null;
}

export interface Experience {
  id: string;
  employee_id: string;
  company_id: string;
  company_name: string;
  job_title: string;
  location: string | null;
  start_date: string;
  end_date: string | null;
  is_current: boolean;
  description: string | null;
}

// Education hooks
export function useEmployeeEducation(employeeId: string | null) {
  return useQuery({
    queryKey: ['employee-education', employeeId],
    queryFn: async () => {
      if (!employeeId) throw new Error('No employee selected');
      
      const { data, error } = await supabase
        .from('employee_education')
        .select('*')
        .eq('employee_id', employeeId)
        .order('start_date', { ascending: false });

      if (error) throw error;
      return data as Education[];
    },
    enabled: !!employeeId,
  });
}

export function useAddEducation() {
  const queryClient = useQueryClient();
  const { companyId } = useTenant();

  return useMutation({
    mutationFn: async ({ employeeId, education }: { 
      employeeId: string; 
      education: Omit<Education, 'id' | 'employee_id' | 'company_id'> 
    }) => {
      if (!companyId) throw new Error('No company selected');
      
      const { data, error } = await supabase
        .from('employee_education')
        .insert({
          ...education,
          employee_id: employeeId,
          company_id: companyId,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, { employeeId }) => {
      queryClient.invalidateQueries({ queryKey: ['employee-education', employeeId] });
      toast.success('Education added');
    },
    onError: (error: Error) => {
      toast.error(`Failed to add education: ${error.message}`);
    },
  });
}

export function useUpdateEducation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, education }: { 
      id: string; 
      education: Partial<Education> 
    }) => {
      const { data, error } = await supabase
        .from('employee_education')
        .update(education)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['employee-education', data.employee_id] });
      toast.success('Education updated');
    },
    onError: (error: Error) => {
      toast.error(`Failed to update education: ${error.message}`);
    },
  });
}

export function useDeleteEducation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, employeeId }: { id: string; employeeId: string }) => {
      const { error } = await supabase
        .from('employee_education')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return employeeId;
    },
    onSuccess: (employeeId) => {
      queryClient.invalidateQueries({ queryKey: ['employee-education', employeeId] });
      toast.success('Education removed');
    },
    onError: (error: Error) => {
      toast.error(`Failed to remove education: ${error.message}`);
    },
  });
}

// Experience hooks
export function useEmployeeExperience(employeeId: string | null) {
  return useQuery({
    queryKey: ['employee-experience', employeeId],
    queryFn: async () => {
      if (!employeeId) throw new Error('No employee selected');
      
      const { data, error } = await supabase
        .from('employee_experience')
        .select('*')
        .eq('employee_id', employeeId)
        .order('start_date', { ascending: false });

      if (error) throw error;
      return data as Experience[];
    },
    enabled: !!employeeId,
  });
}

export function useAddExperience() {
  const queryClient = useQueryClient();
  const { companyId } = useTenant();

  return useMutation({
    mutationFn: async ({ employeeId, experience }: { 
      employeeId: string; 
      experience: Omit<Experience, 'id' | 'employee_id' | 'company_id'> 
    }) => {
      if (!companyId) throw new Error('No company selected');
      
      const { data, error } = await supabase
        .from('employee_experience')
        .insert({
          ...experience,
          employee_id: employeeId,
          company_id: companyId,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, { employeeId }) => {
      queryClient.invalidateQueries({ queryKey: ['employee-experience', employeeId] });
      toast.success('Experience added');
    },
    onError: (error: Error) => {
      toast.error(`Failed to add experience: ${error.message}`);
    },
  });
}

export function useUpdateExperience() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, experience }: { 
      id: string; 
      experience: Partial<Experience> 
    }) => {
      const { data, error } = await supabase
        .from('employee_experience')
        .update(experience)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['employee-experience', data.employee_id] });
      toast.success('Experience updated');
    },
    onError: (error: Error) => {
      toast.error(`Failed to update experience: ${error.message}`);
    },
  });
}

export function useDeleteExperience() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, employeeId }: { id: string; employeeId: string }) => {
      const { error } = await supabase
        .from('employee_experience')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return employeeId;
    },
    onSuccess: (employeeId) => {
      queryClient.invalidateQueries({ queryKey: ['employee-experience', employeeId] });
      toast.success('Experience removed');
    },
    onError: (error: Error) => {
      toast.error(`Failed to remove experience: ${error.message}`);
    },
  });
}
