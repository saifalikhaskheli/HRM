-- Create employment_history table for tracking promotions and designation changes
CREATE TABLE public.employment_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  job_title TEXT NOT NULL,
  department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
  effective_from DATE NOT NULL,
  effective_to DATE,
  change_type TEXT NOT NULL DEFAULT 'promotion', -- 'initial', 'promotion', 'lateral', 'demotion', 'department_transfer'
  reason TEXT,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add indexes for better query performance
CREATE INDEX idx_employment_history_employee ON public.employment_history(employee_id);
CREATE INDEX idx_employment_history_company ON public.employment_history(company_id);
CREATE INDEX idx_employment_history_effective_from ON public.employment_history(effective_from);

-- Enable Row Level Security
ALTER TABLE public.employment_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Company users can view employment history for their company
CREATE POLICY "Company users can view employment history" 
ON public.employment_history 
FOR SELECT 
USING (
  company_id IN (
    SELECT company_id FROM public.company_users 
    WHERE user_id = auth.uid() AND is_active = true
  )
);

-- Only HR+ can insert employment history
CREATE POLICY "HR can insert employment history" 
ON public.employment_history 
FOR INSERT 
WITH CHECK (
  company_id IN (
    SELECT cu.company_id FROM public.company_users cu
    WHERE cu.user_id = auth.uid() 
    AND cu.is_active = true 
    AND cu.role IN ('super_admin', 'company_admin', 'hr_manager')
  )
);

-- Only HR+ can update employment history (only current records)
CREATE POLICY "HR can update employment history" 
ON public.employment_history 
FOR UPDATE 
USING (
  company_id IN (
    SELECT cu.company_id FROM public.company_users cu
    WHERE cu.user_id = auth.uid() 
    AND cu.is_active = true 
    AND cu.role IN ('super_admin', 'company_admin', 'hr_manager')
  )
  AND effective_to IS NULL -- Only allow updating current records
);

-- Create trigger for updated_at
CREATE TRIGGER update_employment_history_updated_at
BEFORE UPDATE ON public.employment_history
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();