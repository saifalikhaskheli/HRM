-- ============================================================
-- PHASE 1-3: PROFILE AUTH ENHANCEMENT + EMPLOYEE ID GENERATION
-- ============================================================

-- 1. Extend profiles table with enterprise auth fields
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS is_first_login boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS password_changed_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS failed_login_attempts integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS locked_until timestamp with time zone,
  ADD COLUMN IF NOT EXISTS password_expires_at timestamp with time zone;

-- 2. Add created_by to employees for audit trail
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id);

-- 3. Add shift and scheduling context fields to employees
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS shift_schedule_type text DEFAULT 'fixed',
  ADD COLUMN IF NOT EXISTS shift_start_time time,
  ADD COLUMN IF NOT EXISTS shift_end_time time,
  ADD COLUMN IF NOT EXISTS weekly_off_days text[] DEFAULT '{}'::text[];

-- 4. Add allowances and deductions JSON fields for payroll context
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS allowances jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS deductions jsonb DEFAULT '{}'::jsonb;

-- ============================================================
-- PHASE 6: DOCUMENT OCR METADATA
-- ============================================================

-- 5. Extend employee_documents with OCR fields
ALTER TABLE public.employee_documents
  ADD COLUMN IF NOT EXISTS ocr_text text,
  ADD COLUMN IF NOT EXISTS ocr_extracted_data jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS ocr_processed boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS ocr_processed_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS expiry_notification_sent boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS expiry_notification_sent_at timestamp with time zone;

-- ============================================================
-- PHASE 8: COMPANY SETTINGS TABLE
-- ============================================================

-- 6. Create company_settings table for tenant-specific configuration
CREATE TABLE IF NOT EXISTS public.company_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  key text NOT NULL,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  description text,
  is_public boolean DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(company_id, key)
);

-- Enable RLS on company_settings
ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;

-- RLS policies for company_settings
CREATE POLICY "company_settings_select_member"
  ON public.company_settings FOR SELECT
  USING (is_active_company_member(auth.uid(), company_id));

CREATE POLICY "company_settings_insert_admin"
  ON public.company_settings FOR INSERT
  WITH CHECK (is_active_company_admin(auth.uid(), company_id) AND is_company_active(company_id));

CREATE POLICY "company_settings_update_admin"
  ON public.company_settings FOR UPDATE
  USING (is_active_company_admin(auth.uid(), company_id))
  WITH CHECK (is_company_active(company_id));

CREATE POLICY "company_settings_delete_admin"
  ON public.company_settings FOR DELETE
  USING (is_active_company_admin(auth.uid(), company_id));

CREATE POLICY "company_settings_select_platform"
  ON public.company_settings FOR SELECT
  USING (is_platform_admin(auth.uid()));

-- ============================================================
-- PHASE 3: EMPLOYEE ID GENERATION FUNCTION
-- ============================================================

-- 7. Create function to generate employee IDs based on company format
CREATE OR REPLACE FUNCTION public.generate_employee_number(_company_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _format text;
  _prefix text;
  _next_seq integer;
  _result text;
  _padding integer;
BEGIN
  -- Get company's employee ID format settings
  SELECT 
    COALESCE(value->>'prefix', 'EMP'),
    COALESCE((value->>'padding')::integer, 4)
  INTO _prefix, _padding
  FROM public.company_settings
  WHERE company_id = _company_id AND key = 'employee_id_format';
  
  -- Fallback defaults
  IF _prefix IS NULL THEN
    _prefix := 'EMP';
    _padding := 4;
  END IF;
  
  -- Get next sequence number (max + 1)
  SELECT COALESCE(MAX(
    CASE 
      WHEN employee_number ~ ('^' || _prefix || '[0-9]+$')
      THEN SUBSTRING(employee_number FROM LENGTH(_prefix) + 1)::integer
      ELSE 0
    END
  ), 0) + 1
  INTO _next_seq
  FROM public.employees
  WHERE company_id = _company_id;
  
  -- Generate formatted ID
  _result := _prefix || LPAD(_next_seq::text, _padding, '0');
  
  RETURN _result;
END;
$$;

-- ============================================================
-- PHASE 1: PASSWORD LIFECYCLE LOGGING
-- ============================================================

-- 8. Create function to log password changes
CREATE OR REPLACE FUNCTION public.log_password_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Update password_changed_at and reset flags
  IF NEW.password_changed_at IS DISTINCT FROM OLD.password_changed_at THEN
    NEW.is_first_login := false;
    NEW.failed_login_attempts := 0;
    NEW.locked_until := NULL;
    
    -- Log to security events (will be handled by separate insert)
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for password change logging
DROP TRIGGER IF EXISTS on_password_change ON public.profiles;
CREATE TRIGGER on_password_change
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.log_password_change();

-- ============================================================
-- PHASE 1: FAILED LOGIN DETECTION
-- ============================================================

-- 9. Create function to record failed login attempts
CREATE OR REPLACE FUNCTION public.record_failed_login(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _max_attempts integer := 5;
  _lockout_minutes integer := 30;
  _current_attempts integer;
BEGIN
  -- Get current attempts
  SELECT COALESCE(failed_login_attempts, 0) + 1 INTO _current_attempts
  FROM public.profiles
  WHERE id = _user_id;
  
  -- Update attempts and potentially lock
  UPDATE public.profiles
  SET 
    failed_login_attempts = _current_attempts,
    locked_until = CASE 
      WHEN _current_attempts >= _max_attempts 
      THEN now() + (_lockout_minutes || ' minutes')::interval
      ELSE locked_until
    END
  WHERE id = _user_id;
  
  -- Log security event
  IF _current_attempts >= _max_attempts THEN
    PERFORM public.log_security_event(
      NULL, -- No company context for auth events
      _user_id,
      'account_locked',
      'Account locked after ' || _max_attempts || ' failed attempts',
      'high'
    );
  END IF;
END;
$$;

-- 10. Create function to reset login attempts on success
CREATE OR REPLACE FUNCTION public.record_successful_login(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET 
    failed_login_attempts = 0,
    locked_until = NULL,
    last_login_at = now()
  WHERE id = _user_id;
END;
$$;

-- 11. Create function to check if account is locked
CREATE OR REPLACE FUNCTION public.is_account_locked(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = _user_id
      AND locked_until IS NOT NULL
      AND locked_until > now()
  )
$$;

-- ============================================================
-- PHASE 7: NOTIFICATION EVENTS TABLE (EVENT-BASED)
-- ============================================================

-- 12. Create notification_events table for event-based notifications
CREATE TABLE IF NOT EXISTS public.notification_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id uuid,
  employee_id uuid REFERENCES public.employees(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  event_data jsonb DEFAULT '{}'::jsonb,
  notification_channels text[] DEFAULT '{email}'::text[],
  status text DEFAULT 'pending',
  scheduled_at timestamp with time zone DEFAULT now(),
  sent_at timestamp with time zone,
  error_message text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.notification_events ENABLE ROW LEVEL SECURITY;

-- RLS policies for notification_events
CREATE POLICY "notification_events_insert_service"
  ON public.notification_events FOR INSERT
  WITH CHECK (true);

CREATE POLICY "notification_events_select_admin"
  ON public.notification_events FOR SELECT
  USING (company_id IS NOT NULL AND is_active_company_admin(auth.uid(), company_id));

CREATE POLICY "notification_events_select_own"
  ON public.notification_events FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "notification_events_select_platform"
  ON public.notification_events FOR SELECT
  USING (is_platform_admin(auth.uid()));

CREATE POLICY "notification_events_update_service"
  ON public.notification_events FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- ============================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================

-- Indexes for company_settings
CREATE INDEX IF NOT EXISTS idx_company_settings_company_key 
  ON public.company_settings(company_id, key);

-- Indexes for notification_events
CREATE INDEX IF NOT EXISTS idx_notification_events_company 
  ON public.notification_events(company_id);
CREATE INDEX IF NOT EXISTS idx_notification_events_user 
  ON public.notification_events(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_events_status 
  ON public.notification_events(status) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_notification_events_scheduled 
  ON public.notification_events(scheduled_at) WHERE status = 'pending';

-- Indexes for OCR documents
CREATE INDEX IF NOT EXISTS idx_documents_ocr_pending 
  ON public.employee_documents(company_id) 
  WHERE ocr_processed = false AND deleted_at IS NULL;

-- Index for document expiry notifications
CREATE INDEX IF NOT EXISTS idx_documents_expiry_reminder 
  ON public.employee_documents(expiry_date, company_id) 
  WHERE expiry_notification_sent = false AND deleted_at IS NULL;

-- ============================================================
-- UPDATED_AT TRIGGER FOR COMPANY_SETTINGS
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_company_settings_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_company_settings_updated_at ON public.company_settings;
CREATE TRIGGER update_company_settings_updated_at
  BEFORE UPDATE ON public.company_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_company_settings_updated_at();

-- ============================================================
-- HELPER FUNCTIONS FOR OCR ACCESS
-- ============================================================

-- 13. Function to check if company can use OCR
CREATE OR REPLACE FUNCTION public.company_has_ocr(_company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.company_subscriptions cs
    JOIN public.plans p ON p.id = cs.plan_id
    WHERE cs.company_id = _company_id
      AND cs.status IN ('active', 'trialing')
      AND (
        p.features->'documents'->>'ocr_enabled' = 'true'
        OR p.features->>'modules' = 'all'
      )
  )
$$;

-- ============================================================
-- INITIAL COMPANY SETTINGS SEED
-- ============================================================

-- 14. Function to initialize default company settings
CREATE OR REPLACE FUNCTION public.initialize_company_settings(_company_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Employee ID format
  INSERT INTO public.company_settings (company_id, key, value, description)
  VALUES (
    _company_id, 
    'employee_id_format', 
    '{"prefix": "EMP", "padding": 4, "auto_generate": true}'::jsonb,
    'Format for auto-generating employee IDs'
  ) ON CONFLICT (company_id, key) DO NOTHING;
  
  -- Notification preferences
  INSERT INTO public.company_settings (company_id, key, value, description)
  VALUES (
    _company_id, 
    'notification_preferences', 
    '{"document_expiry_days": [30, 7, 1], "send_onboarding_email": true}'::jsonb,
    'Company notification settings'
  ) ON CONFLICT (company_id, key) DO NOTHING;
  
  -- Security settings
  INSERT INTO public.company_settings (company_id, key, value, description)
  VALUES (
    _company_id, 
    'security', 
    '{"require_password_change_first_login": true, "password_expiry_days": null, "max_failed_attempts": 5, "lockout_duration_minutes": 30}'::jsonb,
    'Company security settings'
  ) ON CONFLICT (company_id, key) DO NOTHING;
  
  -- Shift defaults
  INSERT INTO public.company_settings (company_id, key, value, description)
  VALUES (
    _company_id, 
    'shift_defaults', 
    '{"default_start_time": "09:00", "default_end_time": "18:00", "default_weekly_off": ["saturday", "sunday"]}'::jsonb,
    'Default shift settings for new employees'
  ) ON CONFLICT (company_id, key) DO NOTHING;
END;
$$;

-- 15. Trigger to auto-initialize settings for new companies
CREATE OR REPLACE FUNCTION public.auto_initialize_company_settings()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.initialize_company_settings(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_company_created_init_settings ON public.companies;
CREATE TRIGGER on_company_created_init_settings
  AFTER INSERT ON public.companies
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_initialize_company_settings();