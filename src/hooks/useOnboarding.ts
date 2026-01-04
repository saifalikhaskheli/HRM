import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { toast } from 'sonner';

export interface OnboardingTask {
  id: string;
  company_id: string;
  employee_id: string;
  task_type: string;
  title: string;
  description: string | null;
  due_date: string | null;
  completed_at: string | null;
  completed_by: string | null;
  status: 'pending' | 'in_progress' | 'completed' | 'skipped';
  assigned_to: string | null;
  order_index: number;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface OnboardingTaskTemplate {
  task_type: string;
  title: string;
  description?: string;
  days_offset: number;
  assigned_to_role?: string;
}

// Send onboarding welcome email
export function useSendWelcomeEmail() {
  return useMutation({
    mutationFn: async ({ employeeId, email, name }: { employeeId: string; email: string; name: string }) => {
      const { error } = await supabase.functions.invoke('send-notification', {
        body: {
          type: 'onboarding_welcome',
          employeeId,
          recipientEmail: email,
          recipientName: name,
        },
      });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Welcome email sent');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to send email');
    },
  });
}

// Trigger new hire onboarding notifications
export function useTriggerOnboardingNotification() {
  const { companyId } = useTenant();

  return useMutation({
    mutationFn: async ({ employeeId, employeeName, employeeEmail, hireDate }: { 
      employeeId: string; 
      employeeName: string;
      employeeEmail: string;
      hireDate: string;
    }) => {
      if (!companyId) throw new Error('No company selected');

      // Send welcome notification
      await supabase.functions.invoke('send-notification', {
        body: {
          type: 'onboarding_welcome',
          companyId,
          employeeId,
          recipientEmail: employeeEmail,
          recipientName: employeeName,
          data: { hireDate },
        },
      });

      // Log the onboarding trigger
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from('audit_logs').insert([{
        company_id: companyId,
        user_id: user?.id,
        table_name: 'employees',
        action: 'create' as const,
        record_id: employeeId,
        metadata: { action_type: 'onboarding_triggered' },
      }]);

      return { success: true };
    },
    onSuccess: () => {
      toast.success('Onboarding notifications sent');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to trigger onboarding');
    },
  });
}

// Get default onboarding checklist (static, no DB required)
export function useDefaultOnboardingChecklist(hireDate: string): OnboardingTask[] {
  const { companyId, employeeId } = useTenant();

  const defaultTasks = [
    { task_type: 'documents', title: 'Submit ID documents', days_offset: -3 },
    { task_type: 'documents', title: 'Submit bank details', days_offset: -3 },
    { task_type: 'it_setup', title: 'IT account setup', days_offset: -1 },
    { task_type: 'orientation', title: 'Welcome orientation', days_offset: 0 },
    { task_type: 'training', title: 'Complete compliance training', days_offset: 7 },
    { task_type: 'review', title: 'First week check-in', days_offset: 7 },
    { task_type: 'review', title: '30-day review', days_offset: 30 },
  ];

  return defaultTasks.map((task, index) => ({
    id: `default-${index}`,
    company_id: companyId || '',
    employee_id: employeeId || '',
    task_type: task.task_type,
    title: task.title,
    description: null,
    due_date: addDays(hireDate, task.days_offset),
    completed_at: null,
    completed_by: null,
    status: 'pending' as const,
    assigned_to: null,
    order_index: index,
    metadata: {},
    created_at: new Date().toISOString(),
  }));
}

// Helper function
function addDays(dateStr: string, days: number): string {
  const date = new Date(dateStr);
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0];
}
