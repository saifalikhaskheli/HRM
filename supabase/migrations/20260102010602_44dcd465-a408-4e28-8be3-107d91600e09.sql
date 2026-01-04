-- Create salary_history table to track salary changes over time
CREATE TABLE public.salary_history (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    base_salary NUMERIC(12, 2) NOT NULL,
    salary_currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    salary_structure JSONB DEFAULT NULL, -- For storing components like HRA, DA, etc.
    effective_from DATE NOT NULL,
    effective_to DATE DEFAULT NULL, -- NULL means currently active
    reason TEXT DEFAULT NULL, -- e.g., 'Initial Salary', 'Annual Increment', 'Promotion'
    created_by UUID DEFAULT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add indexes
CREATE INDEX idx_salary_history_employee ON public.salary_history(employee_id);
CREATE INDEX idx_salary_history_company ON public.salary_history(company_id);
CREATE INDEX idx_salary_history_effective ON public.salary_history(effective_from, effective_to);

-- Enable RLS
ALTER TABLE public.salary_history ENABLE ROW LEVEL SECURITY;

-- Policy: HR/Admin can read all salary history for their company
CREATE POLICY "HR and Admin can view salary history" 
ON public.salary_history 
FOR SELECT 
USING (
    public.is_active_hr_or_above(auth.uid(), company_id)
);

-- Policy: Employees can view their own salary history
CREATE POLICY "Employees can view own salary history" 
ON public.salary_history 
FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM public.employees e 
        WHERE e.id = employee_id 
        AND e.user_id = auth.uid()
    )
);

-- Policy: Only HR/Admin can insert salary history
CREATE POLICY "HR and Admin can insert salary history" 
ON public.salary_history 
FOR INSERT 
WITH CHECK (
    public.is_active_hr_or_above(auth.uid(), company_id)
);

-- Policy: Only HR/Admin can update salary history
CREATE POLICY "HR and Admin can update salary history" 
ON public.salary_history 
FOR UPDATE 
USING (
    public.is_active_hr_or_above(auth.uid(), company_id)
);

-- Trigger to auto-update updated_at
CREATE TRIGGER update_salary_history_updated_at
BEFORE UPDATE ON public.salary_history
FOR EACH ROW
EXECUTE FUNCTION public.update_company_settings_updated_at();