-- Drop the restrictive update policy
DROP POLICY IF EXISTS time_entries_update_own ON time_entries;

-- Create a new policy that allows employees to update their own entries
-- They can update clock_in, clock_out, and break_minutes regardless of approval status
-- But they cannot change is_approved, approved_by, or approved_at
CREATE POLICY "time_entries_update_own" ON time_entries
FOR UPDATE
USING (
  is_own_employee_record(auth.uid(), employee_id) 
  AND company_has_module(company_id, 'time_tracking')
)
WITH CHECK (
  can_use_time_tracking(auth.uid(), company_id)
);