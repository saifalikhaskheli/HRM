-- Create time_entry_breaks table for tracking individual breaks
CREATE TABLE public.time_entry_breaks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  time_entry_id UUID NOT NULL REFERENCES public.time_entries(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  break_start TIMESTAMP WITH TIME ZONE NOT NULL,
  break_end TIMESTAMP WITH TIME ZONE,
  duration_minutes INTEGER,
  break_type TEXT DEFAULT 'break',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add location columns for clock in/out
ALTER TABLE public.time_entries 
  ADD COLUMN IF NOT EXISTS clock_in_location JSONB,
  ADD COLUMN IF NOT EXISTS clock_out_location JSONB;

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_time_entry_breaks_time_entry ON public.time_entry_breaks(time_entry_id);
CREATE INDEX IF NOT EXISTS idx_time_entry_breaks_employee ON public.time_entry_breaks(employee_id, break_start);

-- Enable RLS
ALTER TABLE public.time_entry_breaks ENABLE ROW LEVEL SECURITY;

-- RLS Policies for time_entry_breaks
CREATE POLICY "time_entry_breaks_select_own" ON public.time_entry_breaks
  FOR SELECT USING (is_own_employee_record(auth.uid(), employee_id));

CREATE POLICY "time_entry_breaks_select_hr" ON public.time_entry_breaks
  FOR SELECT USING (is_active_hr_or_above(auth.uid(), company_id));

CREATE POLICY "time_entry_breaks_select_manager" ON public.time_entry_breaks
  FOR SELECT USING (is_manager_of_employee(auth.uid(), employee_id));

CREATE POLICY "time_entry_breaks_insert_own" ON public.time_entry_breaks
  FOR INSERT WITH CHECK (
    is_own_employee_record(auth.uid(), employee_id) 
    AND can_use_time_tracking(auth.uid(), company_id)
  );

CREATE POLICY "time_entry_breaks_update_own" ON public.time_entry_breaks
  FOR UPDATE USING (
    is_own_employee_record(auth.uid(), employee_id) 
    AND company_has_module(company_id, 'time_tracking')
  )
  WITH CHECK (can_use_time_tracking(auth.uid(), company_id));

CREATE POLICY "time_entry_breaks_delete_hr" ON public.time_entry_breaks
  FOR DELETE USING (is_active_hr_or_above(auth.uid(), company_id));

-- Trigger for updated_at
CREATE TRIGGER update_time_entry_breaks_updated_at
  BEFORE UPDATE ON public.time_entry_breaks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();