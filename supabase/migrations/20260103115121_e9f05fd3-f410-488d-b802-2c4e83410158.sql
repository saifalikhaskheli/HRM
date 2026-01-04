
-- Phase 1: RLS Policy Fixes for HR functionality

-- 1.1 Fix expense_categories - Allow HR to manage
DROP POLICY IF EXISTS "expense_categories_insert_hr" ON expense_categories;
DROP POLICY IF EXISTS "expense_categories_update_hr" ON expense_categories;
DROP POLICY IF EXISTS "expense_categories_delete_hr" ON expense_categories;

CREATE POLICY "expense_categories_insert_hr" 
ON expense_categories FOR INSERT 
WITH CHECK (is_active_hr_or_above(auth.uid(), company_id) AND is_company_active(company_id));

CREATE POLICY "expense_categories_update_hr" 
ON expense_categories FOR UPDATE 
USING (is_active_hr_or_above(auth.uid(), company_id))
WITH CHECK (is_company_active(company_id));

CREATE POLICY "expense_categories_delete_hr" 
ON expense_categories FOR DELETE 
USING (is_active_company_admin(auth.uid(), company_id));

-- 1.2 Fix goals - Allow employees to create own goals and HR to manage all
DROP POLICY IF EXISTS "goals_insert_own" ON goals;
DROP POLICY IF EXISTS "goals_insert_hr" ON goals;
DROP POLICY IF EXISTS "goals_update_own" ON goals;
DROP POLICY IF EXISTS "goals_update_hr" ON goals;
DROP POLICY IF EXISTS "goals_delete_hr" ON goals;

CREATE POLICY "goals_insert_own" 
ON goals FOR INSERT 
WITH CHECK (
  is_company_active(company_id) AND 
  EXISTS (
    SELECT 1 FROM employees e 
    WHERE e.id = goals.employee_id 
    AND e.user_id = auth.uid() 
    AND e.company_id = goals.company_id
  )
);

CREATE POLICY "goals_insert_hr" 
ON goals FOR INSERT 
WITH CHECK (is_active_hr_or_above(auth.uid(), company_id) AND is_company_active(company_id));

CREATE POLICY "goals_update_own" 
ON goals FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM employees e 
    WHERE e.id = goals.employee_id 
    AND e.user_id = auth.uid()
  )
)
WITH CHECK (is_company_active(company_id));

CREATE POLICY "goals_update_hr" 
ON goals FOR UPDATE 
USING (is_active_hr_or_above(auth.uid(), company_id))
WITH CHECK (is_company_active(company_id));

CREATE POLICY "goals_delete_hr" 
ON goals FOR DELETE 
USING (is_active_hr_or_above(auth.uid(), company_id));

-- 1.3 Fix leave_types - Allow HR to manage
DROP POLICY IF EXISTS "leave_types_insert_hr" ON leave_types;
DROP POLICY IF EXISTS "leave_types_update_hr" ON leave_types;
DROP POLICY IF EXISTS "leave_types_delete_admin" ON leave_types;

CREATE POLICY "leave_types_insert_hr" 
ON leave_types FOR INSERT 
WITH CHECK (is_active_hr_or_above(auth.uid(), company_id) AND is_company_active(company_id));

CREATE POLICY "leave_types_update_hr" 
ON leave_types FOR UPDATE 
USING (is_active_hr_or_above(auth.uid(), company_id))
WITH CHECK (is_company_active(company_id));

CREATE POLICY "leave_types_delete_admin" 
ON leave_types FOR DELETE 
USING (is_active_company_admin(auth.uid(), company_id));

-- 1.4 Fix payroll_runs - Allow HR to manage
DROP POLICY IF EXISTS "payroll_runs_insert_hr" ON payroll_runs;
DROP POLICY IF EXISTS "payroll_runs_update_hr" ON payroll_runs;

CREATE POLICY "payroll_runs_insert_hr" 
ON payroll_runs FOR INSERT 
WITH CHECK (is_active_hr_or_above(auth.uid(), company_id) AND is_company_active(company_id));

CREATE POLICY "payroll_runs_update_hr" 
ON payroll_runs FOR UPDATE 
USING (is_active_hr_or_above(auth.uid(), company_id))
WITH CHECK (is_company_active(company_id));

-- 1.5 Fix payroll_entries - Allow HR to manage
DROP POLICY IF EXISTS "payroll_entries_insert_hr" ON payroll_entries;
DROP POLICY IF EXISTS "payroll_entries_update_hr" ON payroll_entries;

CREATE POLICY "payroll_entries_insert_hr" 
ON payroll_entries FOR INSERT 
WITH CHECK (is_active_hr_or_above(auth.uid(), company_id) AND is_company_active(company_id));

CREATE POLICY "payroll_entries_update_hr" 
ON payroll_entries FOR UPDATE 
USING (is_active_hr_or_above(auth.uid(), company_id))
WITH CHECK (is_company_active(company_id));

-- 1.6 Fix employee_shift_assignments - Allow HR to manage
DROP POLICY IF EXISTS "shift_assignments_select_hr" ON employee_shift_assignments;
DROP POLICY IF EXISTS "shift_assignments_insert_hr" ON employee_shift_assignments;
DROP POLICY IF EXISTS "shift_assignments_update_hr" ON employee_shift_assignments;
DROP POLICY IF EXISTS "shift_assignments_delete_hr" ON employee_shift_assignments;

CREATE POLICY "shift_assignments_select_hr" 
ON employee_shift_assignments FOR SELECT 
USING (is_active_hr_or_above(auth.uid(), company_id));

CREATE POLICY "shift_assignments_insert_hr" 
ON employee_shift_assignments FOR INSERT 
WITH CHECK (is_active_hr_or_above(auth.uid(), company_id) AND is_company_active(company_id));

CREATE POLICY "shift_assignments_update_hr" 
ON employee_shift_assignments FOR UPDATE 
USING (is_active_hr_or_above(auth.uid(), company_id))
WITH CHECK (is_company_active(company_id));

CREATE POLICY "shift_assignments_delete_hr" 
ON employee_shift_assignments FOR DELETE 
USING (is_active_hr_or_above(auth.uid(), company_id));

-- 1.7 Fix leave_balances - Allow HR to manage
DROP POLICY IF EXISTS "leave_balances_insert_hr" ON leave_balances;
DROP POLICY IF EXISTS "leave_balances_update_hr" ON leave_balances;
DROP POLICY IF EXISTS "leave_balances_delete_admin" ON leave_balances;

CREATE POLICY "leave_balances_insert_hr" 
ON leave_balances FOR INSERT 
WITH CHECK (is_active_hr_or_above(auth.uid(), company_id) AND is_company_active(company_id));

CREATE POLICY "leave_balances_update_hr" 
ON leave_balances FOR UPDATE 
USING (is_active_hr_or_above(auth.uid(), company_id))
WITH CHECK (is_company_active(company_id));

CREATE POLICY "leave_balances_delete_admin" 
ON leave_balances FOR DELETE 
USING (is_active_company_admin(auth.uid(), company_id));

-- 1.8 Fix work_schedules - Allow HR to manage
DROP POLICY IF EXISTS "work_schedules_insert_hr" ON work_schedules;
DROP POLICY IF EXISTS "work_schedules_update_hr" ON work_schedules;
DROP POLICY IF EXISTS "work_schedules_delete_admin" ON work_schedules;

CREATE POLICY "work_schedules_insert_hr" 
ON work_schedules FOR INSERT 
WITH CHECK (is_active_hr_or_above(auth.uid(), company_id) AND is_company_active(company_id));

CREATE POLICY "work_schedules_update_hr" 
ON work_schedules FOR UPDATE 
USING (is_active_hr_or_above(auth.uid(), company_id))
WITH CHECK (is_company_active(company_id));

CREATE POLICY "work_schedules_delete_admin" 
ON work_schedules FOR DELETE 
USING (is_active_company_admin(auth.uid(), company_id));

-- 1.9 Add time_correction_requests table for proper time correction workflow
CREATE TABLE IF NOT EXISTS time_correction_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  time_entry_id uuid REFERENCES time_entries(id) ON DELETE SET NULL,
  request_date date NOT NULL,
  original_clock_in time,
  original_clock_out time,
  requested_clock_in time NOT NULL,
  requested_clock_out time,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'reverted')),
  reviewed_by uuid REFERENCES employees(id),
  reviewed_at timestamptz,
  reviewer_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE time_correction_requests ENABLE ROW LEVEL SECURITY;

-- Policies for time_correction_requests
CREATE POLICY "time_correction_requests_select_own" 
ON time_correction_requests FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM employees e 
    WHERE e.id = time_correction_requests.employee_id 
    AND e.user_id = auth.uid()
  )
);

CREATE POLICY "time_correction_requests_select_hr" 
ON time_correction_requests FOR SELECT 
USING (is_active_hr_or_above(auth.uid(), company_id));

CREATE POLICY "time_correction_requests_select_manager" 
ON time_correction_requests FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM employees e 
    WHERE e.id = time_correction_requests.employee_id 
    AND e.manager_id IN (
      SELECT id FROM employees WHERE user_id = auth.uid() AND company_id = time_correction_requests.company_id
    )
  )
);

CREATE POLICY "time_correction_requests_insert_own" 
ON time_correction_requests FOR INSERT 
WITH CHECK (
  is_company_active(company_id) AND
  EXISTS (
    SELECT 1 FROM employees e 
    WHERE e.id = time_correction_requests.employee_id 
    AND e.user_id = auth.uid()
  )
);

CREATE POLICY "time_correction_requests_update_hr" 
ON time_correction_requests FOR UPDATE 
USING (is_active_hr_or_above(auth.uid(), company_id))
WITH CHECK (is_company_active(company_id));

CREATE POLICY "time_correction_requests_update_manager" 
ON time_correction_requests FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM employees e 
    WHERE e.id = time_correction_requests.employee_id 
    AND e.manager_id IN (
      SELECT id FROM employees WHERE user_id = auth.uid() AND company_id = time_correction_requests.company_id
    )
  )
)
WITH CHECK (is_company_active(company_id));

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_time_correction_requests_company ON time_correction_requests(company_id);
CREATE INDEX IF NOT EXISTS idx_time_correction_requests_employee ON time_correction_requests(employee_id);
CREATE INDEX IF NOT EXISTS idx_time_correction_requests_status ON time_correction_requests(status);
