-- Phase 1: Work Schedules table for defining expected work hours
CREATE TABLE public.work_schedules (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    employee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE,
    day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6), -- 0=Sunday, 6=Saturday
    expected_start TIME NOT NULL DEFAULT '09:00:00',
    expected_end TIME NOT NULL DEFAULT '18:00:00',
    expected_hours NUMERIC(4,2) NOT NULL DEFAULT 8.0,
    break_minutes INTEGER NOT NULL DEFAULT 60,
    is_working_day BOOLEAN NOT NULL DEFAULT true,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(company_id, employee_id, day_of_week)
);

-- Enable RLS
ALTER TABLE public.work_schedules ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "work_schedules_select_member" ON public.work_schedules
    FOR SELECT USING (is_active_company_member(auth.uid(), company_id));

CREATE POLICY "work_schedules_insert_hr" ON public.work_schedules
    FOR INSERT WITH CHECK (is_active_hr_or_above(auth.uid(), company_id) AND is_company_active(company_id));

CREATE POLICY "work_schedules_update_hr" ON public.work_schedules
    FOR UPDATE USING (is_active_hr_or_above(auth.uid(), company_id))
    WITH CHECK (is_company_active(company_id));

CREATE POLICY "work_schedules_delete_admin" ON public.work_schedules
    FOR DELETE USING (is_active_company_admin(auth.uid(), company_id));

-- Add attendance calculation fields to time_entries if not exists
ALTER TABLE public.time_entries 
    ADD COLUMN IF NOT EXISTS late_minutes INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS under_time_minutes INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS attendance_status TEXT DEFAULT 'present' CHECK (attendance_status IN ('present', 'late', 'absent', 'half_day', 'on_leave'));

-- Updated at trigger
CREATE TRIGGER update_work_schedules_updated_at
    BEFORE UPDATE ON public.work_schedules
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Index for faster lookups
CREATE INDEX idx_work_schedules_company_employee ON public.work_schedules(company_id, employee_id);
CREATE INDEX idx_time_entries_attendance_status ON public.time_entries(attendance_status);

-- Phase 3: Office Expenses Module
CREATE TABLE public.expense_categories (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    code TEXT NOT NULL,
    description TEXT,
    budget_limit NUMERIC(12,2),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(company_id, code)
);

CREATE TABLE public.expenses (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES public.expense_categories(id) ON DELETE RESTRICT,
    amount NUMERIC(12,2) NOT NULL,
    currency TEXT NOT NULL DEFAULT 'USD',
    expense_date DATE NOT NULL,
    description TEXT NOT NULL,
    receipt_url TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'reimbursed')),
    approved_by UUID REFERENCES public.employees(id),
    approved_at TIMESTAMP WITH TIME ZONE,
    rejection_reason TEXT,
    reimbursed_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on expense tables
ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

-- Expense categories policies
CREATE POLICY "expense_categories_select_member" ON public.expense_categories
    FOR SELECT USING (is_active_company_member(auth.uid(), company_id));

CREATE POLICY "expense_categories_insert_admin" ON public.expense_categories
    FOR INSERT WITH CHECK (is_active_company_admin(auth.uid(), company_id) AND is_company_active(company_id));

CREATE POLICY "expense_categories_update_admin" ON public.expense_categories
    FOR UPDATE USING (is_active_company_admin(auth.uid(), company_id))
    WITH CHECK (is_company_active(company_id));

CREATE POLICY "expense_categories_delete_admin" ON public.expense_categories
    FOR DELETE USING (is_active_company_admin(auth.uid(), company_id));

-- Expenses policies
CREATE POLICY "expenses_select_own" ON public.expenses
    FOR SELECT USING (is_own_employee_record(auth.uid(), employee_id));

CREATE POLICY "expenses_select_hr" ON public.expenses
    FOR SELECT USING (is_active_hr_or_above(auth.uid(), company_id));

CREATE POLICY "expenses_insert_own" ON public.expenses
    FOR INSERT WITH CHECK (is_own_employee_record(auth.uid(), employee_id) AND is_company_active(company_id));

CREATE POLICY "expenses_update_own_pending" ON public.expenses
    FOR UPDATE USING (is_own_employee_record(auth.uid(), employee_id) AND status = 'pending')
    WITH CHECK (is_company_active(company_id));

CREATE POLICY "expenses_update_hr" ON public.expenses
    FOR UPDATE USING (is_active_hr_or_above(auth.uid(), company_id))
    WITH CHECK (is_company_active(company_id));

CREATE POLICY "expenses_delete_own_pending" ON public.expenses
    FOR DELETE USING (is_own_employee_record(auth.uid(), employee_id) AND status = 'pending');

CREATE POLICY "expenses_delete_admin" ON public.expenses
    FOR DELETE USING (is_active_company_admin(auth.uid(), company_id));

-- Triggers for updated_at
CREATE TRIGGER update_expense_categories_updated_at
    BEFORE UPDATE ON public.expense_categories
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_expenses_updated_at
    BEFORE UPDATE ON public.expenses
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Indexes
CREATE INDEX idx_expenses_company_status ON public.expenses(company_id, status);
CREATE INDEX idx_expenses_employee ON public.expenses(employee_id);
CREATE INDEX idx_expense_categories_company ON public.expense_categories(company_id);

-- Phase 4: Employee Education & Experience
CREATE TABLE public.employee_education (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    institution TEXT NOT NULL,
    degree TEXT NOT NULL,
    field_of_study TEXT,
    start_date DATE,
    end_date DATE,
    grade TEXT,
    is_current BOOLEAN DEFAULT false,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.employee_experience (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    company_name TEXT NOT NULL,
    job_title TEXT NOT NULL,
    location TEXT,
    start_date DATE NOT NULL,
    end_date DATE,
    is_current BOOLEAN DEFAULT false,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.employee_education ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_experience ENABLE ROW LEVEL SECURITY;

-- Education policies
CREATE POLICY "employee_education_select_own" ON public.employee_education
    FOR SELECT USING (is_own_employee_record(auth.uid(), employee_id));

CREATE POLICY "employee_education_select_hr" ON public.employee_education
    FOR SELECT USING (is_active_hr_or_above(auth.uid(), company_id));

CREATE POLICY "employee_education_insert_hr" ON public.employee_education
    FOR INSERT WITH CHECK (is_active_hr_or_above(auth.uid(), company_id) AND is_company_active(company_id));

CREATE POLICY "employee_education_insert_own" ON public.employee_education
    FOR INSERT WITH CHECK (is_own_employee_record(auth.uid(), employee_id) AND is_company_active(company_id));

CREATE POLICY "employee_education_update_hr" ON public.employee_education
    FOR UPDATE USING (is_active_hr_or_above(auth.uid(), company_id))
    WITH CHECK (is_company_active(company_id));

CREATE POLICY "employee_education_update_own" ON public.employee_education
    FOR UPDATE USING (is_own_employee_record(auth.uid(), employee_id))
    WITH CHECK (is_company_active(company_id));

CREATE POLICY "employee_education_delete_hr" ON public.employee_education
    FOR DELETE USING (is_active_hr_or_above(auth.uid(), company_id));

-- Experience policies
CREATE POLICY "employee_experience_select_own" ON public.employee_experience
    FOR SELECT USING (is_own_employee_record(auth.uid(), employee_id));

CREATE POLICY "employee_experience_select_hr" ON public.employee_experience
    FOR SELECT USING (is_active_hr_or_above(auth.uid(), company_id));

CREATE POLICY "employee_experience_insert_hr" ON public.employee_experience
    FOR INSERT WITH CHECK (is_active_hr_or_above(auth.uid(), company_id) AND is_company_active(company_id));

CREATE POLICY "employee_experience_insert_own" ON public.employee_experience
    FOR INSERT WITH CHECK (is_own_employee_record(auth.uid(), employee_id) AND is_company_active(company_id));

CREATE POLICY "employee_experience_update_hr" ON public.employee_experience
    FOR UPDATE USING (is_active_hr_or_above(auth.uid(), company_id))
    WITH CHECK (is_company_active(company_id));

CREATE POLICY "employee_experience_update_own" ON public.employee_experience
    FOR UPDATE USING (is_own_employee_record(auth.uid(), employee_id))
    WITH CHECK (is_company_active(company_id));

CREATE POLICY "employee_experience_delete_hr" ON public.employee_experience
    FOR DELETE USING (is_active_hr_or_above(auth.uid(), company_id));

-- Triggers
CREATE TRIGGER update_employee_education_updated_at
    BEFORE UPDATE ON public.employee_education
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_employee_experience_updated_at
    BEFORE UPDATE ON public.employee_experience
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Indexes
CREATE INDEX idx_employee_education_employee ON public.employee_education(employee_id);
CREATE INDEX idx_employee_experience_employee ON public.employee_experience(employee_id);

-- Add PF and attendance fields to payroll_entries
ALTER TABLE public.payroll_entries
    ADD COLUMN IF NOT EXISTS pf_deduction NUMERIC(12,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS days_present INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS days_absent INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS days_late INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS total_late_minutes INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS half_days INTEGER DEFAULT 0;

-- Add PF settings to company settings
ALTER TABLE public.companies
    ADD COLUMN IF NOT EXISTS pf_enabled BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS pf_employee_rate NUMERIC(5,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS pf_employer_rate NUMERIC(5,2) DEFAULT 0;