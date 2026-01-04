-- =============================================
-- PHASE 1: SHIFT MANAGEMENT TABLES
-- =============================================

-- SHIFTS TABLE (Company-level shift templates)
CREATE TABLE public.shifts (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    break_duration_minutes INTEGER NOT NULL DEFAULT 0,
    grace_period_minutes INTEGER NOT NULL DEFAULT 15,
    min_hours_full_day NUMERIC(4,2) NOT NULL DEFAULT 8.0,
    min_hours_half_day NUMERIC(4,2) NOT NULL DEFAULT 4.0,
    overtime_after_minutes INTEGER DEFAULT NULL,
    applicable_days TEXT[] NOT NULL DEFAULT ARRAY['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
    is_default BOOLEAN NOT NULL DEFAULT false,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    created_by UUID REFERENCES auth.users(id),
    CONSTRAINT shifts_company_name_unique UNIQUE (company_id, name)
);

-- EMPLOYEE SHIFT ASSIGNMENTS TABLE
CREATE TABLE public.employee_shift_assignments (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    shift_id UUID NOT NULL REFERENCES public.shifts(id) ON DELETE RESTRICT,
    effective_from DATE NOT NULL,
    effective_to DATE DEFAULT NULL,
    is_temporary BOOLEAN NOT NULL DEFAULT false,
    reason TEXT,
    assigned_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- ATTENDANCE SUMMARIES TABLE (For payroll integration)
CREATE TABLE public.attendance_summaries (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    total_working_days INTEGER NOT NULL DEFAULT 0,
    days_present INTEGER NOT NULL DEFAULT 0,
    days_late INTEGER NOT NULL DEFAULT 0,
    half_day_absents INTEGER NOT NULL DEFAULT 0,
    full_day_absents INTEGER NOT NULL DEFAULT 0,
    total_working_hours NUMERIC(8,2) NOT NULL DEFAULT 0,
    overtime_hours NUMERIC(8,2) NOT NULL DEFAULT 0,
    calculated_from TIMESTAMP WITH TIME ZONE,
    calculated_to TIMESTAMP WITH TIME ZONE,
    is_locked BOOLEAN NOT NULL DEFAULT false,
    locked_at TIMESTAMP WITH TIME ZONE,
    locked_by UUID REFERENCES auth.users(id),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    CONSTRAINT attendance_summaries_unique UNIQUE (company_id, employee_id, period_start, period_end)
);

-- =============================================
-- INDEXES
-- =============================================
CREATE INDEX idx_shifts_company ON public.shifts(company_id);
CREATE INDEX idx_shifts_active ON public.shifts(company_id, is_active);
CREATE INDEX idx_shift_assignments_employee ON public.employee_shift_assignments(employee_id);
CREATE INDEX idx_shift_assignments_effective ON public.employee_shift_assignments(employee_id, effective_from, effective_to);
CREATE INDEX idx_attendance_summaries_employee ON public.attendance_summaries(employee_id);
CREATE INDEX idx_attendance_summaries_period ON public.attendance_summaries(company_id, period_start, period_end);

-- =============================================
-- HELPER FUNCTIONS
-- =============================================

-- Get employee's active shift for a specific date
CREATE OR REPLACE FUNCTION public.get_employee_shift_for_date(_employee_id UUID, _date DATE)
RETURNS UUID
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
    SELECT shift_id
    FROM public.employee_shift_assignments
    WHERE employee_id = _employee_id
      AND effective_from <= _date
      AND (effective_to IS NULL OR effective_to >= _date)
    ORDER BY effective_from DESC
    LIMIT 1
$$;

-- Check for overlapping shift assignments (prevents double-booking)
CREATE OR REPLACE FUNCTION public.check_shift_assignment_overlap()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM public.employee_shift_assignments
        WHERE employee_id = NEW.employee_id
          AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
          AND effective_from <= COALESCE(NEW.effective_to, '9999-12-31'::date)
          AND COALESCE(effective_to, '9999-12-31'::date) >= NEW.effective_from
    ) THEN
        RAISE EXCEPTION 'Employee already has an active shift assignment for this period';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER check_shift_overlap
    BEFORE INSERT OR UPDATE ON public.employee_shift_assignments
    FOR EACH ROW
    EXECUTE FUNCTION public.check_shift_assignment_overlap();

-- Updated at trigger for shifts
CREATE TRIGGER update_shifts_updated_at
    BEFORE UPDATE ON public.shifts
    FOR EACH ROW
    EXECUTE FUNCTION public.update_company_settings_updated_at();

CREATE TRIGGER update_shift_assignments_updated_at
    BEFORE UPDATE ON public.employee_shift_assignments
    FOR EACH ROW
    EXECUTE FUNCTION public.update_company_settings_updated_at();

CREATE TRIGGER update_attendance_summaries_updated_at
    BEFORE UPDATE ON public.attendance_summaries
    FOR EACH ROW
    EXECUTE FUNCTION public.update_company_settings_updated_at();

-- =============================================
-- RLS POLICIES
-- =============================================

ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_shift_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_summaries ENABLE ROW LEVEL SECURITY;

-- SHIFTS POLICIES
CREATE POLICY "shifts_select_member"
    ON public.shifts FOR SELECT
    USING (is_active_company_member(auth.uid(), company_id));

CREATE POLICY "shifts_insert_hr"
    ON public.shifts FOR INSERT
    WITH CHECK (is_active_hr_or_above(auth.uid(), company_id) AND is_company_active(company_id));

CREATE POLICY "shifts_update_hr"
    ON public.shifts FOR UPDATE
    USING (is_active_hr_or_above(auth.uid(), company_id))
    WITH CHECK (is_company_active(company_id));

CREATE POLICY "shifts_delete_admin"
    ON public.shifts FOR DELETE
    USING (is_active_company_admin(auth.uid(), company_id));

-- SHIFT ASSIGNMENTS POLICIES
CREATE POLICY "shift_assignments_select_hr"
    ON public.employee_shift_assignments FOR SELECT
    USING (is_active_hr_or_above(auth.uid(), company_id));

CREATE POLICY "shift_assignments_select_own"
    ON public.employee_shift_assignments FOR SELECT
    USING (EXISTS (SELECT 1 FROM public.employees WHERE id = employee_id AND user_id = auth.uid()));

CREATE POLICY "shift_assignments_insert_hr"
    ON public.employee_shift_assignments FOR INSERT
    WITH CHECK (is_active_hr_or_above(auth.uid(), company_id) AND is_company_active(company_id));

CREATE POLICY "shift_assignments_update_hr"
    ON public.employee_shift_assignments FOR UPDATE
    USING (is_active_hr_or_above(auth.uid(), company_id))
    WITH CHECK (is_company_active(company_id));

CREATE POLICY "shift_assignments_delete_admin"
    ON public.employee_shift_assignments FOR DELETE
    USING (is_active_company_admin(auth.uid(), company_id));

-- ATTENDANCE SUMMARIES POLICIES
CREATE POLICY "attendance_summaries_select_hr"
    ON public.attendance_summaries FOR SELECT
    USING (is_active_hr_or_above(auth.uid(), company_id));

CREATE POLICY "attendance_summaries_select_own"
    ON public.attendance_summaries FOR SELECT
    USING (EXISTS (SELECT 1 FROM public.employees WHERE id = employee_id AND user_id = auth.uid()));

CREATE POLICY "attendance_summaries_insert_hr"
    ON public.attendance_summaries FOR INSERT
    WITH CHECK (is_active_hr_or_above(auth.uid(), company_id) AND is_company_active(company_id));

CREATE POLICY "attendance_summaries_update_hr"
    ON public.attendance_summaries FOR UPDATE
    USING (is_active_hr_or_above(auth.uid(), company_id) AND NOT is_locked)
    WITH CHECK (is_company_active(company_id));

CREATE POLICY "attendance_summaries_delete_admin"
    ON public.attendance_summaries FOR DELETE
    USING (is_active_company_admin(auth.uid(), company_id) AND NOT is_locked);

-- =============================================
-- INSERT NEW PERMISSIONS
-- =============================================

INSERT INTO public.permissions (module, action, name, description) VALUES
    ('shifts', 'read', 'View Shifts', 'View shift configurations'),
    ('shifts', 'create', 'Create Shifts', 'Create new shift templates'),
    ('shifts', 'update', 'Update Shifts', 'Modify shift configurations'),
    ('shifts', 'delete', 'Delete Shifts', 'Remove shift templates'),
    ('shifts', 'manage', 'Manage Shift Assignments', 'Assign/reassign employee shifts'),
    ('attendance', 'read', 'View Attendance', 'View attendance summaries'),
    ('attendance', 'create', 'Generate Attendance', 'Generate attendance summaries'),
    ('attendance', 'update', 'Update Attendance', 'Modify attendance records'),
    ('attendance', 'lock', 'Lock Attendance', 'Lock attendance for payroll'),
    ('attendance', 'export', 'Export Attendance', 'Export attendance reports')
ON CONFLICT DO NOTHING;