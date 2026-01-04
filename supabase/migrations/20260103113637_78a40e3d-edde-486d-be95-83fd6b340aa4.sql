-- =============================================
-- AUTOMATION MODULE: Performance Cycles, Trial Cron, Document Expiry
-- =============================================

-- 1. PERFORMANCE CYCLES AUTOMATION
-- =============================================

-- Table to store review cycle configurations
CREATE TABLE IF NOT EXISTS public.review_cycles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    cycle_type TEXT NOT NULL DEFAULT 'annual', -- annual, quarterly, monthly, custom
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    review_period_start DATE NOT NULL,
    review_period_end DATE NOT NULL,
    reminder_days INTEGER[] DEFAULT ARRAY[14, 7, 3, 1],
    escalation_days INTEGER DEFAULT 7, -- days after deadline to escalate
    auto_create_reviews BOOLEAN DEFAULT true,
    status TEXT NOT NULL DEFAULT 'draft', -- draft, active, completed, canceled
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.review_cycles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company users can view their review cycles"
ON public.review_cycles FOR SELECT
USING (public.validate_tenant_access(company_id));

CREATE POLICY "Admins can manage review cycles"
ON public.review_cycles FOR ALL
USING (public.is_active_company_admin(auth.uid(), company_id));

-- Track review reminder/escalation history
CREATE TABLE IF NOT EXISTS public.review_reminders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    review_id UUID NOT NULL REFERENCES public.performance_reviews(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    reminder_type TEXT NOT NULL, -- reminder, escalation
    days_remaining INTEGER,
    sent_to UUID NOT NULL, -- user_id
    sent_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.review_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company users can view reminders"
ON public.review_reminders FOR SELECT
USING (public.validate_tenant_access(company_id));

-- Function to auto-create reviews for a cycle
CREATE OR REPLACE FUNCTION public.create_reviews_for_cycle(_cycle_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    _cycle RECORD;
    _employee RECORD;
    _count INTEGER := 0;
BEGIN
    -- Get cycle info
    SELECT * INTO _cycle FROM review_cycles WHERE id = _cycle_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Review cycle not found';
    END IF;
    
    -- Create reviews for active employees with managers
    FOR _employee IN
        SELECT e.id, e.manager_id, e.company_id
        FROM employees e
        WHERE e.company_id = _cycle.company_id
          AND e.employment_status = 'active'
          AND e.manager_id IS NOT NULL
          AND NOT EXISTS (
              SELECT 1 FROM performance_reviews pr
              WHERE pr.employee_id = e.id
                AND pr.review_period_start = _cycle.review_period_start
                AND pr.review_period_end = _cycle.review_period_end
          )
    LOOP
        INSERT INTO performance_reviews (
            company_id,
            employee_id,
            reviewer_id,
            review_period_start,
            review_period_end,
            status,
            metadata
        ) VALUES (
            _employee.company_id,
            _employee.id,
            _employee.manager_id,
            _cycle.review_period_start,
            _cycle.review_period_end,
            'draft',
            jsonb_build_object('cycle_id', _cycle_id)
        );
        _count := _count + 1;
    END LOOP;
    
    RETURN _count;
END;
$$;

-- Function to get pending reviews needing reminders
CREATE OR REPLACE FUNCTION public.get_reviews_needing_reminders()
RETURNS TABLE (
    review_id UUID,
    company_id UUID,
    reviewer_id UUID,
    reviewer_user_id UUID,
    reviewer_email TEXT,
    reviewer_name TEXT,
    employee_name TEXT,
    review_period_end DATE,
    days_until_due INTEGER,
    status TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT 
        pr.id as review_id,
        pr.company_id,
        pr.reviewer_id,
        reviewer.user_id as reviewer_user_id,
        reviewer.email as reviewer_email,
        reviewer.first_name || ' ' || reviewer.last_name as reviewer_name,
        emp.first_name || ' ' || emp.last_name as employee_name,
        pr.review_period_end,
        (pr.review_period_end - CURRENT_DATE)::INTEGER as days_until_due,
        pr.status::TEXT
    FROM performance_reviews pr
    JOIN employees reviewer ON reviewer.id = pr.reviewer_id
    JOIN employees emp ON emp.id = pr.employee_id
    WHERE pr.status IN ('draft', 'in_progress')
      AND pr.review_period_end >= CURRENT_DATE
      AND (pr.review_period_end - CURRENT_DATE) IN (14, 7, 3, 1)
      AND reviewer.user_id IS NOT NULL
$$;

-- Function to get overdue reviews needing escalation
CREATE OR REPLACE FUNCTION public.get_reviews_needing_escalation(_escalation_days INTEGER DEFAULT 7)
RETURNS TABLE (
    review_id UUID,
    company_id UUID,
    reviewer_id UUID,
    employee_id UUID,
    manager_of_reviewer UUID,
    days_overdue INTEGER
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT 
        pr.id as review_id,
        pr.company_id,
        pr.reviewer_id,
        pr.employee_id,
        reviewer.manager_id as manager_of_reviewer,
        (CURRENT_DATE - pr.review_period_end)::INTEGER as days_overdue
    FROM performance_reviews pr
    JOIN employees reviewer ON reviewer.id = pr.reviewer_id
    WHERE pr.status IN ('draft', 'in_progress')
      AND pr.review_period_end < CURRENT_DATE
      AND (CURRENT_DATE - pr.review_period_end) >= _escalation_days
      AND reviewer.manager_id IS NOT NULL
$$;


-- 2. TRIAL & SUBSCRIPTION CRON
-- =============================================

-- Trial email logs table (if not exists from previous migration)
CREATE TABLE IF NOT EXISTS public.trial_email_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    email_type TEXT NOT NULL,
    recipient_email TEXT NOT NULL,
    days_remaining INTEGER,
    sent_date DATE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_trial_email_logs_lookup 
ON public.trial_email_logs(company_id, email_type, sent_date);

ALTER TABLE public.trial_email_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform admins can view trial email logs"
ON public.trial_email_logs FOR SELECT
USING (public.is_platform_admin(auth.uid()));

-- Function to get companies with expiring trials
CREATE OR REPLACE FUNCTION public.get_expiring_trials(_days_threshold INTEGER DEFAULT 7)
RETURNS TABLE (
    company_id UUID,
    company_name TEXT,
    trial_ends_at TIMESTAMPTZ,
    days_remaining INTEGER,
    admin_emails TEXT[]
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT 
        cs.company_id,
        c.name as company_name,
        cs.trial_ends_at,
        GREATEST(0, EXTRACT(DAY FROM cs.trial_ends_at - now())::INTEGER) as days_remaining,
        ARRAY_AGG(DISTINCT p.email) FILTER (WHERE p.email IS NOT NULL) as admin_emails
    FROM company_subscriptions cs
    JOIN companies c ON c.id = cs.company_id
    LEFT JOIN company_users cu ON cu.company_id = cs.company_id 
        AND cu.is_active = true 
        AND cu.role IN ('super_admin', 'company_admin')
    LEFT JOIN profiles p ON p.id = cu.user_id
    WHERE cs.status = 'trialing'
      AND cs.trial_ends_at IS NOT NULL
      AND cs.trial_ends_at <= now() + (_days_threshold || ' days')::INTERVAL
      AND cs.trial_ends_at > now()
      AND c.is_active = true
    GROUP BY cs.company_id, c.name, cs.trial_ends_at
$$;

-- Function to transition expired trials and optionally freeze
CREATE OR REPLACE FUNCTION public.process_expired_trials(_freeze_after_days INTEGER DEFAULT 0)
RETURNS TABLE (
    company_id UUID,
    company_name TEXT,
    action_taken TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    _record RECORD;
BEGIN
    FOR _record IN
        SELECT 
            cs.company_id,
            c.name as company_name,
            cs.trial_ends_at,
            EXTRACT(DAY FROM now() - cs.trial_ends_at)::INTEGER as days_expired
        FROM company_subscriptions cs
        JOIN companies c ON c.id = cs.company_id
        WHERE cs.status = 'trialing'
          AND cs.trial_ends_at IS NOT NULL
          AND cs.trial_ends_at < now()
    LOOP
        -- Update subscription status
        UPDATE company_subscriptions
        SET status = 'trial_expired', updated_at = now()
        WHERE company_subscriptions.company_id = _record.company_id;
        
        -- Log billing event
        INSERT INTO billing_logs (company_id, event_type, metadata)
        VALUES (_record.company_id, 'trial_expired', jsonb_build_object(
            'trial_ended_at', _record.trial_ends_at,
            'days_expired', _record.days_expired,
            'auto_processed', true
        ));
        
        -- Optionally freeze if past grace period
        IF _freeze_after_days > 0 AND _record.days_expired >= _freeze_after_days THEN
            UPDATE companies
            SET is_active = false, updated_at = now()
            WHERE id = _record.company_id;
            
            company_id := _record.company_id;
            company_name := _record.company_name;
            action_taken := 'frozen';
            RETURN NEXT;
        ELSE
            company_id := _record.company_id;
            company_name := _record.company_name;
            action_taken := 'trial_expired';
            RETURN NEXT;
        END IF;
    END LOOP;
END;
$$;


-- 3. DOCUMENT EXPIRY ALERTS
-- =============================================

-- Track document expiry notifications
CREATE TABLE IF NOT EXISTS public.document_expiry_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES public.employee_documents(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    notification_type TEXT NOT NULL, -- expiring_soon, expired
    days_until_expiry INTEGER,
    sent_to UUID NOT NULL, -- user_id
    sent_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_doc_expiry_notif_lookup 
ON public.document_expiry_notifications(document_id, notification_type, sent_at);

ALTER TABLE public.document_expiry_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company users can view document notifications"
ON public.document_expiry_notifications FOR SELECT
USING (public.validate_tenant_access(company_id));

-- Function to get documents expiring soon
CREATE OR REPLACE FUNCTION public.get_expiring_documents(_days_threshold INTEGER DEFAULT 30)
RETURNS TABLE (
    document_id UUID,
    company_id UUID,
    employee_id UUID,
    employee_user_id UUID,
    employee_email TEXT,
    employee_name TEXT,
    document_title TEXT,
    document_type_name TEXT,
    expiry_date DATE,
    days_until_expiry INTEGER,
    manager_user_id UUID,
    manager_email TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT 
        ed.id as document_id,
        ed.company_id,
        ed.employee_id,
        e.user_id as employee_user_id,
        e.email as employee_email,
        e.first_name || ' ' || e.last_name as employee_name,
        ed.title as document_title,
        dt.name as document_type_name,
        ed.expiry_date,
        (ed.expiry_date - CURRENT_DATE)::INTEGER as days_until_expiry,
        mgr.user_id as manager_user_id,
        mgr.email as manager_email
    FROM employee_documents ed
    JOIN employees e ON e.id = ed.employee_id
    JOIN document_types dt ON dt.id = ed.document_type_id
    LEFT JOIN employees mgr ON mgr.id = e.manager_id
    WHERE ed.expiry_date IS NOT NULL
      AND ed.deleted_at IS NULL
      AND ed.expiry_date <= CURRENT_DATE + _days_threshold
      AND ed.expiry_date >= CURRENT_DATE
      AND e.employment_status = 'active'
      AND ed.verification_status != 'expired'
$$;

-- Function to get expired documents
CREATE OR REPLACE FUNCTION public.get_expired_documents()
RETURNS TABLE (
    document_id UUID,
    company_id UUID,
    employee_id UUID,
    document_title TEXT,
    document_type_name TEXT,
    expiry_date DATE,
    days_expired INTEGER
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT 
        ed.id as document_id,
        ed.company_id,
        ed.employee_id,
        ed.title as document_title,
        dt.name as document_type_name,
        ed.expiry_date,
        (CURRENT_DATE - ed.expiry_date)::INTEGER as days_expired
    FROM employee_documents ed
    JOIN employees e ON e.id = ed.employee_id
    JOIN document_types dt ON dt.id = ed.document_type_id
    WHERE ed.expiry_date IS NOT NULL
      AND ed.deleted_at IS NULL
      AND ed.expiry_date < CURRENT_DATE
      AND ed.verification_status != 'expired'
      AND e.employment_status = 'active'
$$;

-- Function to auto-expire documents and update status
CREATE OR REPLACE FUNCTION public.process_expired_documents()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    _count INTEGER;
BEGIN
    WITH updated AS (
        UPDATE employee_documents
        SET verification_status = 'expired',
            updated_at = now()
        WHERE expiry_date IS NOT NULL
          AND expiry_date < CURRENT_DATE
          AND deleted_at IS NULL
          AND verification_status != 'expired'
        RETURNING id
    )
    SELECT COUNT(*) INTO _count FROM updated;
    
    RETURN _count;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.create_reviews_for_cycle(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_reviews_needing_reminders() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_reviews_needing_escalation(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_expiring_trials(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.process_expired_trials(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_expiring_documents(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_expired_documents() TO authenticated;
GRANT EXECUTE ON FUNCTION public.process_expired_documents() TO authenticated;