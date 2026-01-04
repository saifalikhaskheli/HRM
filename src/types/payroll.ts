import { Tables } from '@/integrations/supabase/types';

export type PayrollRun = Tables<'payroll_runs'>;
export type PayrollEntry = Tables<'payroll_entries'>;

export type PayrollStatus = 'draft' | 'processing' | 'completed' | 'failed';

export interface PayrollEntryEmployee {
  id: string;
  first_name: string;
  last_name: string;
  employee_number: string;
  job_title: string | null;
}

export interface PayrollEntryWithEmployee extends PayrollEntry {
  employee: PayrollEntryEmployee | null;
}

export interface PayrollRunWithEntries extends PayrollRun {
  entries?: PayrollEntry[];
  entry_count?: number;
}

export const payrollStatusConfig: Record<PayrollStatus, { label: string; color: string }> = {
  draft: { label: 'Draft', color: 'bg-muted text-muted-foreground' },
  processing: { label: 'Processing', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' },
  completed: { label: 'Completed', color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' },
  failed: { label: 'Failed', color: 'bg-destructive/20 text-destructive' },
};
