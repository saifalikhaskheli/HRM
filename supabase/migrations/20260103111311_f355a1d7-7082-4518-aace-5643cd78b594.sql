-- Create leave_balances table to track actual allocations per employee per year
CREATE TABLE public.leave_balances (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  leave_type_id UUID NOT NULL REFERENCES public.leave_types(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  allocated_days NUMERIC NOT NULL DEFAULT 0,
  used_days NUMERIC NOT NULL DEFAULT 0,
  pending_days NUMERIC NOT NULL DEFAULT 0,
  carried_over_days NUMERIC NOT NULL DEFAULT 0,
  adjustment_days NUMERIC NOT NULL DEFAULT 0,
  adjustment_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(employee_id, leave_type_id, year)
);

-- Enable RLS
ALTER TABLE public.leave_balances ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "leave_balances_select_own" ON public.leave_balances
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.employees e 
      WHERE e.id = leave_balances.employee_id 
      AND e.user_id = auth.uid()
    )
  );

CREATE POLICY "leave_balances_select_hr" ON public.leave_balances
  FOR SELECT USING (is_active_hr_or_above(auth.uid(), company_id));

CREATE POLICY "leave_balances_insert_hr" ON public.leave_balances
  FOR INSERT WITH CHECK (is_active_hr_or_above(auth.uid(), company_id) AND is_company_active(company_id));

CREATE POLICY "leave_balances_update_hr" ON public.leave_balances
  FOR UPDATE USING (is_active_hr_or_above(auth.uid(), company_id))
  WITH CHECK (is_company_active(company_id));

CREATE POLICY "leave_balances_delete_admin" ON public.leave_balances
  FOR DELETE USING (is_active_company_admin(auth.uid(), company_id));

-- Service role policy for triggers
CREATE POLICY "leave_balances_service_update" ON public.leave_balances
  FOR UPDATE USING (true) WITH CHECK (true);

-- Index for performance
CREATE INDEX idx_leave_balances_employee_year ON public.leave_balances(employee_id, year);
CREATE INDEX idx_leave_balances_company_year ON public.leave_balances(company_id, year);

-- Function to calculate remaining balance
CREATE OR REPLACE FUNCTION public.get_leave_balance(_employee_id UUID, _leave_type_id UUID, _year INTEGER DEFAULT EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER)
RETURNS NUMERIC
LANGUAGE SQL
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    allocated_days + carried_over_days + adjustment_days - used_days,
    0
  )
  FROM public.leave_balances
  WHERE employee_id = _employee_id 
    AND leave_type_id = _leave_type_id 
    AND year = _year
$$;

-- Function to check if employee has sufficient balance for a leave request
CREATE OR REPLACE FUNCTION public.check_leave_balance(_employee_id UUID, _leave_type_id UUID, _days NUMERIC, _exclude_request_id UUID DEFAULT NULL)
RETURNS TABLE(has_balance BOOLEAN, available_days NUMERIC, message TEXT)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _current_year INTEGER := EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER;
  _balance RECORD;
  _available NUMERIC;
BEGIN
  -- Get current balance
  SELECT * INTO _balance
  FROM public.leave_balances
  WHERE employee_id = _employee_id 
    AND leave_type_id = _leave_type_id 
    AND year = _current_year;
  
  IF _balance IS NULL THEN
    RETURN QUERY SELECT false, 0::NUMERIC, 'No leave balance allocated for this leave type'::TEXT;
    RETURN;
  END IF;
  
  -- Calculate available (allocated + carryover + adjustments - used - pending)
  _available := _balance.allocated_days + _balance.carried_over_days + _balance.adjustment_days 
                - _balance.used_days - _balance.pending_days;
  
  IF _available >= _days THEN
    RETURN QUERY SELECT true, _available, 'Sufficient balance'::TEXT;
  ELSE
    RETURN QUERY SELECT false, _available, 
      format('Insufficient balance. Available: %s days, Requested: %s days', _available, _days)::TEXT;
  END IF;
END;
$$;

-- Function to accrue leave balances for a company/year
CREATE OR REPLACE FUNCTION public.accrue_leave_balances(_company_id UUID, _year INTEGER DEFAULT EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER)
RETURNS TABLE(employees_processed INTEGER, balances_created INTEGER, errors TEXT[])
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _emp RECORD;
  _lt RECORD;
  _carry_over NUMERIC;
  _prev_remaining NUMERIC;
  _emp_count INTEGER := 0;
  _balance_count INTEGER := 0;
  _errors TEXT[] := ARRAY[]::TEXT[];
BEGIN
  -- Process each active employee
  FOR _emp IN 
    SELECT id FROM public.employees 
    WHERE company_id = _company_id 
    AND employment_status != 'terminated'
  LOOP
    _emp_count := _emp_count + 1;
    
    -- Process each active leave type
    FOR _lt IN 
      SELECT id, default_days, carry_over_limit 
      FROM public.leave_types 
      WHERE company_id = _company_id AND is_active = true
    LOOP
      -- Calculate carry over from previous year
      _carry_over := 0;
      IF _year > 2020 THEN
        SELECT GREATEST(0, allocated_days + carried_over_days + adjustment_days - used_days)
        INTO _prev_remaining
        FROM public.leave_balances
        WHERE employee_id = _emp.id 
          AND leave_type_id = _lt.id 
          AND year = _year - 1;
        
        IF _prev_remaining IS NOT NULL AND _lt.carry_over_limit IS NOT NULL THEN
          _carry_over := LEAST(_prev_remaining, _lt.carry_over_limit);
        END IF;
      END IF;
      
      -- Insert or update balance
      INSERT INTO public.leave_balances (
        company_id, employee_id, leave_type_id, year,
        allocated_days, carried_over_days
      ) VALUES (
        _company_id, _emp.id, _lt.id, _year,
        COALESCE(_lt.default_days, 0), _carry_over
      )
      ON CONFLICT (employee_id, leave_type_id, year) 
      DO UPDATE SET 
        allocated_days = COALESCE(_lt.default_days, 0),
        carried_over_days = EXCLUDED.carried_over_days,
        updated_at = now();
      
      _balance_count := _balance_count + 1;
    END LOOP;
  END LOOP;
  
  -- Log the accrual
  INSERT INTO public.audit_logs (
    company_id, user_id, action, table_name, metadata
  ) VALUES (
    _company_id, auth.uid(), 'create', 'leave_balances',
    jsonb_build_object('action_type', 'bulk_accrual', 'year', _year, 
                       'employees', _emp_count, 'balances', _balance_count)
  );
  
  RETURN QUERY SELECT _emp_count, _balance_count, _errors;
END;
$$;

-- Trigger function to update balance on leave request status change
CREATE OR REPLACE FUNCTION public.update_leave_balance_on_request_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _year INTEGER;
  _balance_exists BOOLEAN;
BEGIN
  _year := EXTRACT(YEAR FROM COALESCE(NEW.start_date, OLD.start_date))::INTEGER;
  
  -- Check if balance record exists
  SELECT EXISTS (
    SELECT 1 FROM public.leave_balances 
    WHERE employee_id = COALESCE(NEW.employee_id, OLD.employee_id)
      AND leave_type_id = COALESCE(NEW.leave_type_id, OLD.leave_type_id)
      AND year = _year
  ) INTO _balance_exists;
  
  -- Auto-create balance if it doesn't exist (for new requests)
  IF NOT _balance_exists AND TG_OP IN ('INSERT', 'UPDATE') THEN
    INSERT INTO public.leave_balances (
      company_id, employee_id, leave_type_id, year, allocated_days
    )
    SELECT 
      NEW.company_id, NEW.employee_id, NEW.leave_type_id, _year,
      COALESCE(lt.default_days, 0)
    FROM public.leave_types lt
    WHERE lt.id = NEW.leave_type_id
    ON CONFLICT (employee_id, leave_type_id, year) DO NOTHING;
  END IF;
  
  -- Handle INSERT (new request)
  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'pending' THEN
      UPDATE public.leave_balances
      SET pending_days = pending_days + NEW.total_days, updated_at = now()
      WHERE employee_id = NEW.employee_id 
        AND leave_type_id = NEW.leave_type_id 
        AND year = _year;
    ELSIF NEW.status = 'approved' THEN
      UPDATE public.leave_balances
      SET used_days = used_days + NEW.total_days, updated_at = now()
      WHERE employee_id = NEW.employee_id 
        AND leave_type_id = NEW.leave_type_id 
        AND year = _year;
    END IF;
    RETURN NEW;
  END IF;
  
  -- Handle UPDATE (status change)
  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    -- Remove from old status
    IF OLD.status = 'pending' THEN
      UPDATE public.leave_balances
      SET pending_days = GREATEST(0, pending_days - OLD.total_days), updated_at = now()
      WHERE employee_id = OLD.employee_id 
        AND leave_type_id = OLD.leave_type_id 
        AND year = _year;
    ELSIF OLD.status = 'approved' THEN
      UPDATE public.leave_balances
      SET used_days = GREATEST(0, used_days - OLD.total_days), updated_at = now()
      WHERE employee_id = OLD.employee_id 
        AND leave_type_id = OLD.leave_type_id 
        AND year = _year;
    END IF;
    
    -- Add to new status
    IF NEW.status = 'pending' THEN
      UPDATE public.leave_balances
      SET pending_days = pending_days + NEW.total_days, updated_at = now()
      WHERE employee_id = NEW.employee_id 
        AND leave_type_id = NEW.leave_type_id 
        AND year = _year;
    ELSIF NEW.status = 'approved' THEN
      UPDATE public.leave_balances
      SET used_days = used_days + NEW.total_days, updated_at = now()
      WHERE employee_id = NEW.employee_id 
        AND leave_type_id = NEW.leave_type_id 
        AND year = _year;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger on leave_requests
CREATE TRIGGER leave_request_balance_trigger
  AFTER INSERT OR UPDATE OF status ON public.leave_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_leave_balance_on_request_change();

-- Function to manually adjust leave balance
CREATE OR REPLACE FUNCTION public.adjust_leave_balance(
  _employee_id UUID, 
  _leave_type_id UUID, 
  _adjustment_days NUMERIC,
  _reason TEXT
)
RETURNS public.leave_balances
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _company_id UUID;
  _year INTEGER := EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER;
  _result public.leave_balances;
BEGIN
  -- Get company_id from employee
  SELECT company_id INTO _company_id FROM public.employees WHERE id = _employee_id;
  
  -- Check caller permission
  IF NOT public.is_active_hr_or_above(auth.uid(), _company_id) THEN
    RAISE EXCEPTION 'Not authorized to adjust leave balances';
  END IF;
  
  -- Ensure balance record exists
  INSERT INTO public.leave_balances (company_id, employee_id, leave_type_id, year, allocated_days)
  SELECT _company_id, _employee_id, _leave_type_id, _year, COALESCE(lt.default_days, 0)
  FROM public.leave_types lt WHERE lt.id = _leave_type_id
  ON CONFLICT (employee_id, leave_type_id, year) DO NOTHING;
  
  -- Apply adjustment
  UPDATE public.leave_balances
  SET adjustment_days = adjustment_days + _adjustment_days,
      adjustment_reason = COALESCE(adjustment_reason || E'\n', '') || 
        format('[%s] %s: %s days', now()::date, _reason, _adjustment_days),
      updated_at = now()
  WHERE employee_id = _employee_id 
    AND leave_type_id = _leave_type_id 
    AND year = _year
  RETURNING * INTO _result;
  
  -- Audit log
  INSERT INTO public.audit_logs (
    company_id, user_id, action, table_name, record_id, new_values, metadata
  ) VALUES (
    _company_id, auth.uid(), 'update', 'leave_balances', _result.id,
    jsonb_build_object('adjustment_days', _adjustment_days),
    jsonb_build_object('action_type', 'manual_adjustment', 'reason', _reason)
  );
  
  RETURN _result;
END;
$$;

-- Function to send leave notification
CREATE OR REPLACE FUNCTION public.create_leave_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _employee RECORD;
  _leave_type RECORD;
  _reviewer RECORD;
  _event_type TEXT;
  _target_user_id UUID;
  _target_employee_id UUID;
BEGIN
  -- Get employee details
  SELECT e.*, u.email as user_email INTO _employee
  FROM public.employees e
  LEFT JOIN public.profiles u ON u.id = e.user_id
  WHERE e.id = NEW.employee_id;
  
  -- Get leave type
  SELECT * INTO _leave_type FROM public.leave_types WHERE id = NEW.leave_type_id;
  
  -- Determine notification type and recipient
  IF TG_OP = 'INSERT' AND NEW.status = 'pending' THEN
    -- New request - notify HR/managers
    _event_type := 'leave_submitted';
    -- Create notification for HR (we'll let the app handle who to notify)
    INSERT INTO public.notification_events (
      company_id, user_id, employee_id, event_type, 
      notification_channels, event_data, status
    ) VALUES (
      NEW.company_id, NULL, NEW.employee_id, _event_type,
      ARRAY['email', 'in_app'],
      jsonb_build_object(
        'leave_request_id', NEW.id,
        'employee_name', _employee.first_name || ' ' || _employee.last_name,
        'leave_type', _leave_type.name,
        'start_date', NEW.start_date,
        'end_date', NEW.end_date,
        'total_days', NEW.total_days,
        'reason', NEW.reason
      ),
      'pending'
    );
    
  ELSIF TG_OP = 'UPDATE' AND OLD.status = 'pending' AND NEW.status = 'approved' THEN
    -- Approved - notify employee
    _event_type := 'leave_approved';
    INSERT INTO public.notification_events (
      company_id, user_id, employee_id, event_type,
      notification_channels, event_data, status
    ) VALUES (
      NEW.company_id, _employee.user_id, NEW.employee_id, _event_type,
      ARRAY['email', 'in_app'],
      jsonb_build_object(
        'leave_request_id', NEW.id,
        'leave_type', _leave_type.name,
        'start_date', NEW.start_date,
        'end_date', NEW.end_date,
        'total_days', NEW.total_days,
        'reviewed_by', NEW.reviewed_by,
        'review_notes', NEW.review_notes
      ),
      'pending'
    );
    
  ELSIF TG_OP = 'UPDATE' AND OLD.status = 'pending' AND NEW.status = 'rejected' THEN
    -- Rejected - notify employee
    _event_type := 'leave_rejected';
    INSERT INTO public.notification_events (
      company_id, user_id, employee_id, event_type,
      notification_channels, event_data, status
    ) VALUES (
      NEW.company_id, _employee.user_id, NEW.employee_id, _event_type,
      ARRAY['email', 'in_app'],
      jsonb_build_object(
        'leave_request_id', NEW.id,
        'leave_type', _leave_type.name,
        'start_date', NEW.start_date,
        'end_date', NEW.end_date,
        'total_days', NEW.total_days,
        'reviewed_by', NEW.reviewed_by,
        'review_notes', NEW.review_notes
      ),
      'pending'
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create notification trigger on leave_requests
CREATE TRIGGER leave_request_notification_trigger
  AFTER INSERT OR UPDATE OF status ON public.leave_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.create_leave_notification();