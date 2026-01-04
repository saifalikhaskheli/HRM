-- ================================================================
-- ATTENDANCE → PAYROLL AUTOMATION
-- ================================================================

-- Add columns to attendance_summaries for leave integration
ALTER TABLE public.attendance_summaries 
ADD COLUMN IF NOT EXISTS paid_leave_days NUMERIC(4,1) DEFAULT 0,
ADD COLUMN IF NOT EXISTS unpaid_leave_days NUMERIC(4,1) DEFAULT 0,
ADD COLUMN IF NOT EXISTS late_minutes INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS payroll_run_id UUID REFERENCES public.payroll_runs(id) ON DELETE SET NULL;

-- Add index for payroll lookups
CREATE INDEX IF NOT EXISTS idx_attendance_summaries_payroll 
ON public.attendance_summaries(payroll_run_id);

CREATE INDEX IF NOT EXISTS idx_attendance_summaries_period 
ON public.attendance_summaries(company_id, period_start, period_end);

-- ================================================================
-- FUNCTION: Generate attendance summaries for a period
-- Aggregates time entries and leave data into attendance_summaries
-- ================================================================
CREATE OR REPLACE FUNCTION public.generate_attendance_summary(
    _company_id UUID,
    _period_start DATE,
    _period_end DATE
)
RETURNS TABLE(
    employee_id UUID,
    days_present INTEGER,
    days_late INTEGER,
    full_day_absents INTEGER,
    half_day_absents INTEGER,
    overtime_hours NUMERIC,
    total_working_hours NUMERIC,
    paid_leave_days NUMERIC,
    unpaid_leave_days NUMERIC,
    late_minutes INTEGER,
    summary_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    _working_days INTEGER;
    _emp RECORD;
    _summary_id UUID;
BEGIN
    -- Calculate working days (excluding weekends) in the period
    SELECT COUNT(*)::INTEGER INTO _working_days
    FROM generate_series(_period_start, _period_end, '1 day'::INTERVAL) AS d
    WHERE EXTRACT(DOW FROM d) NOT IN (0, 6); -- Exclude Sunday (0) and Saturday (6)

    -- Process each active employee
    FOR _emp IN 
        SELECT e.id as emp_id
        FROM public.employees e
        WHERE e.company_id = _company_id
          AND e.employment_status IN ('active', 'on_leave', 'probation')
    LOOP
        -- Aggregate time entries
        WITH time_stats AS (
            SELECT 
                COALESCE(COUNT(CASE WHEN te.total_hours > 0 THEN 1 END), 0)::INTEGER as days_present,
                COALESCE(COUNT(CASE WHEN te.late_minutes > 0 THEN 1 END), 0)::INTEGER as days_late,
                COALESCE(SUM(te.overtime_hours), 0)::NUMERIC as overtime_hours,
                COALESCE(SUM(te.total_hours), 0)::NUMERIC as total_working_hours,
                COALESCE(SUM(te.late_minutes), 0)::INTEGER as late_minutes
            FROM public.time_entries te
            WHERE te.employee_id = _emp.emp_id
              AND te.date >= _period_start
              AND te.date <= _period_end
        ),
        -- Aggregate approved leave
        leave_stats AS (
            SELECT 
                COALESCE(SUM(CASE WHEN lt.is_paid = true THEN lr.total_days ELSE 0 END), 0)::NUMERIC as paid_leave_days,
                COALESCE(SUM(CASE WHEN lt.is_paid = false THEN lr.total_days ELSE 0 END), 0)::NUMERIC as unpaid_leave_days
            FROM public.leave_requests lr
            JOIN public.leave_types lt ON lt.id = lr.leave_type_id
            WHERE lr.employee_id = _emp.emp_id
              AND lr.status = 'approved'
              AND lr.start_date <= _period_end
              AND lr.end_date >= _period_start
        )
        SELECT 
            ts.days_present,
            ts.days_late,
            ts.overtime_hours,
            ts.total_working_hours,
            ts.late_minutes,
            ls.paid_leave_days,
            ls.unpaid_leave_days
        INTO 
            days_present,
            days_late,
            overtime_hours,
            total_working_hours,
            late_minutes,
            paid_leave_days,
            unpaid_leave_days
        FROM time_stats ts, leave_stats ls;

        -- Calculate absents (working days - present - leave)
        full_day_absents := GREATEST(0, _working_days - days_present - paid_leave_days::INTEGER - unpaid_leave_days::INTEGER);
        half_day_absents := 0; -- Can be refined based on half-day logic

        employee_id := _emp.emp_id;

        -- Upsert attendance summary
        INSERT INTO public.attendance_summaries (
            company_id,
            employee_id,
            period_start,
            period_end,
            days_present,
            days_late,
            full_day_absents,
            half_day_absents,
            overtime_hours,
            total_working_hours,
            total_working_days,
            paid_leave_days,
            unpaid_leave_days,
            late_minutes,
            calculated_from,
            calculated_to
        ) VALUES (
            _company_id,
            _emp.emp_id,
            _period_start,
            _period_end,
            days_present,
            days_late,
            full_day_absents,
            half_day_absents,
            overtime_hours,
            total_working_hours,
            _working_days,
            paid_leave_days,
            unpaid_leave_days,
            late_minutes,
            NOW()::TIMESTAMPTZ,
            NOW()::TIMESTAMPTZ
        )
        ON CONFLICT (employee_id, period_start, period_end) 
        DO UPDATE SET
            days_present = EXCLUDED.days_present,
            days_late = EXCLUDED.days_late,
            full_day_absents = EXCLUDED.full_day_absents,
            half_day_absents = EXCLUDED.half_day_absents,
            overtime_hours = EXCLUDED.overtime_hours,
            total_working_hours = EXCLUDED.total_working_hours,
            total_working_days = EXCLUDED.total_working_days,
            paid_leave_days = EXCLUDED.paid_leave_days,
            unpaid_leave_days = EXCLUDED.unpaid_leave_days,
            late_minutes = EXCLUDED.late_minutes,
            calculated_to = NOW(),
            updated_at = NOW()
        WHERE NOT public.attendance_summaries.is_locked
        RETURNING id INTO _summary_id;

        summary_id := _summary_id;

        RETURN NEXT;
    END LOOP;
END;
$$;

-- ================================================================
-- FUNCTION: Get attendance summary for an employee and period
-- ================================================================
CREATE OR REPLACE FUNCTION public.get_attendance_summary(
    _employee_id UUID,
    _period_start DATE,
    _period_end DATE
)
RETURNS public.attendance_summaries
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT *
    FROM public.attendance_summaries
    WHERE employee_id = _employee_id
      AND period_start = _period_start
      AND period_end = _period_end
    LIMIT 1;
$$;

-- ================================================================
-- FUNCTION: Lock attendance summaries for a payroll run
-- ================================================================
CREATE OR REPLACE FUNCTION public.lock_attendance_for_payroll(
    _payroll_run_id UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    _count INTEGER;
    _period_start DATE;
    _period_end DATE;
    _company_id UUID;
    _locker_id UUID;
BEGIN
    -- Get payroll run details
    SELECT period_start, period_end, company_id
    INTO _period_start, _period_end, _company_id
    FROM public.payroll_runs
    WHERE id = _payroll_run_id;

    IF _company_id IS NULL THEN
        RAISE EXCEPTION 'Payroll run not found';
    END IF;

    -- Get current employee ID for audit
    SELECT public.get_current_employee(_company_id) INTO _locker_id;

    -- Lock all summaries for this period
    UPDATE public.attendance_summaries
    SET is_locked = true,
        locked_at = NOW(),
        locked_by = _locker_id,
        payroll_run_id = _payroll_run_id
    WHERE company_id = _company_id
      AND period_start = _period_start
      AND period_end = _period_end
      AND NOT is_locked;

    GET DIAGNOSTICS _count = ROW_COUNT;
    RETURN _count;
END;
$$;

-- ================================================================
-- FUNCTION: Calculate payroll entry from attendance
-- Returns calculated salary components based on attendance data
-- ================================================================
CREATE OR REPLACE FUNCTION public.calculate_payroll_from_attendance(
    _employee_id UUID,
    _period_start DATE,
    _period_end DATE
)
RETURNS TABLE(
    base_salary NUMERIC,
    daily_rate NUMERIC,
    days_worked INTEGER,
    days_absent INTEGER,
    unpaid_leave_days NUMERIC,
    overtime_hours NUMERIC,
    overtime_pay NUMERIC,
    deductions NUMERIC,
    prorated_salary NUMERIC
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    _emp RECORD;
    _summary RECORD;
    _working_days INTEGER;
    _overtime_rate NUMERIC := 1.5; -- 1.5x for overtime
BEGIN
    -- Get employee salary info
    SELECT e.salary, e.company_id
    INTO _emp
    FROM public.employees e
    WHERE e.id = _employee_id;

    IF _emp.salary IS NULL THEN
        base_salary := 0;
        daily_rate := 0;
        days_worked := 0;
        days_absent := 0;
        unpaid_leave_days := 0;
        overtime_hours := 0;
        overtime_pay := 0;
        deductions := 0;
        prorated_salary := 0;
        RETURN NEXT;
        RETURN;
    END IF;

    -- Get or generate attendance summary
    SELECT * INTO _summary
    FROM public.attendance_summaries
    WHERE employee_id = _employee_id
      AND period_start = _period_start
      AND period_end = _period_end;

    -- Calculate working days in period
    SELECT COUNT(*)::INTEGER INTO _working_days
    FROM generate_series(_period_start, _period_end, '1 day'::INTERVAL) AS d
    WHERE EXTRACT(DOW FROM d) NOT IN (0, 6);

    base_salary := COALESCE(_emp.salary, 0);
    daily_rate := CASE WHEN _working_days > 0 THEN base_salary / _working_days ELSE 0 END;
    days_worked := COALESCE(_summary.days_present, 0);
    days_absent := COALESCE(_summary.full_day_absents, 0);
    unpaid_leave_days := COALESCE(_summary.unpaid_leave_days, 0);
    overtime_hours := COALESCE(_summary.overtime_hours, 0);
    
    -- Calculate overtime pay (hourly rate = daily_rate / 8 hours)
    overtime_pay := CASE 
        WHEN daily_rate > 0 THEN (daily_rate / 8) * overtime_hours * _overtime_rate
        ELSE 0
    END;
    
    -- Calculate deductions for unpaid leave
    deductions := daily_rate * unpaid_leave_days;
    
    -- Calculate prorated salary
    prorated_salary := base_salary - deductions + overtime_pay;

    RETURN NEXT;
END;
$$;

-- ================================================================
-- Add unique constraint for summary per employee per period
-- ================================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'attendance_summaries_employee_period_unique'
    ) THEN
        ALTER TABLE public.attendance_summaries 
        ADD CONSTRAINT attendance_summaries_employee_period_unique 
        UNIQUE (employee_id, period_start, period_end);
    END IF;
EXCEPTION WHEN duplicate_object THEN
    NULL;
END $$;

-- ================================================================
-- Grant permissions
-- ================================================================
GRANT EXECUTE ON FUNCTION public.generate_attendance_summary TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_attendance_summary TO authenticated;
GRANT EXECUTE ON FUNCTION public.lock_attendance_for_payroll TO authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_payroll_from_attendance TO authenticated;