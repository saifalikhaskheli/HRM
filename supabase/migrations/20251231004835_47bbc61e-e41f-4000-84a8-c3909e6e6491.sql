-- Add unique constraint for employee_id and date combination
-- This ensures an employee can only have one time entry per day
-- Required for the upsert operation in clock-in functionality

ALTER TABLE public.time_entries
ADD CONSTRAINT time_entries_employee_date_unique 
UNIQUE (employee_id, date);