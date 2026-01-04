
-- =============================================
-- PLAN-BASED FEATURE ENFORCEMENT
-- Database-level module access control
-- =============================================

-- =============================================
-- HELPER FUNCTIONS FOR MODULE ACCESS
-- =============================================

-- Check if company has access to a specific module
CREATE OR REPLACE FUNCTION public.company_has_module(_company_id UUID, _module TEXT)
RETURNS BOOLEAN
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
              -- Check if 'all' modules enabled (enterprise)
              p.features->>'modules' = 'all'
              OR p.features->'modules' ? _module
              OR (
                  p.features->'modules' IS NOT NULL 
                  AND jsonb_typeof(p.features->'modules') = 'array'
                  AND _module = ANY(
                      SELECT jsonb_array_elements_text(p.features->'modules')
                  )
              )
          )
    )
$$;

-- Check if company has active subscription
CREATE OR REPLACE FUNCTION public.company_has_active_subscription(_company_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 
        FROM public.company_subscriptions
        WHERE company_id = _company_id
          AND status IN ('active', 'trialing')
          AND current_period_end > now()
    )
$$;

-- Check if company can add more employees (plan limit)
CREATE OR REPLACE FUNCTION public.company_can_add_employee(_company_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT COALESCE(
        (
            SELECT 
                p.max_employees IS NULL -- unlimited
                OR (
                    SELECT COUNT(*) FROM public.employees 
                    WHERE company_id = _company_id 
                    AND employment_status != 'terminated'
                ) < p.max_employees
            FROM public.company_subscriptions cs
            JOIN public.plans p ON p.id = cs.plan_id
            WHERE cs.company_id = _company_id
              AND cs.status IN ('active', 'trialing')
        ),
        false
    )
$$;

-- Combined check: company active + has subscription + has module
CREATE OR REPLACE FUNCTION public.can_use_module(_user_id UUID, _company_id UUID, _module TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT 
        public.is_company_active(_company_id)
        AND public.is_active_company_member(_user_id, _company_id)
        AND public.company_has_module(_company_id, _module)
$$;

-- Check for payroll module access (admin only + module enabled)
CREATE OR REPLACE FUNCTION public.can_use_payroll(_user_id UUID, _company_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT 
        public.is_active_company_admin(_user_id, _company_id)
        AND public.company_has_module(_company_id, 'payroll')
$$;

-- Check for recruitment module access
CREATE OR REPLACE FUNCTION public.can_use_recruitment(_user_id UUID, _company_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT 
        public.is_active_hr_or_above(_user_id, _company_id)
        AND public.company_has_module(_company_id, 'recruitment')
$$;

-- Check for time tracking module access
CREATE OR REPLACE FUNCTION public.can_use_time_tracking(_user_id UUID, _company_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT 
        public.is_active_company_member(_user_id, _company_id)
        AND public.company_has_module(_company_id, 'time_tracking')
$$;

-- Check for performance module access
CREATE OR REPLACE FUNCTION public.can_use_performance(_user_id UUID, _company_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT 
        public.is_active_company_member(_user_id, _company_id)
        AND public.company_has_module(_company_id, 'performance')
$$;

-- Check for leave management module access
CREATE OR REPLACE FUNCTION public.can_use_leave(_user_id UUID, _company_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT 
        public.is_active_company_member(_user_id, _company_id)
        AND public.company_has_module(_company_id, 'leave')
$$;

-- Check for documents module access
CREATE OR REPLACE FUNCTION public.can_use_documents(_user_id UUID, _company_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT 
        public.is_active_company_member(_user_id, _company_id)
        AND public.company_has_module(_company_id, 'documents')
$$;

-- =============================================
-- UPDATE RLS POLICIES FOR MODULE ENFORCEMENT
-- =============================================

-- =============================================
-- PAYROLL RUNS - Require payroll module
-- =============================================

DROP POLICY IF EXISTS "payroll_runs_select_admin" ON public.payroll_runs;
DROP POLICY IF EXISTS "payroll_runs_insert_admin" ON public.payroll_runs;
DROP POLICY IF EXISTS "payroll_runs_update_admin" ON public.payroll_runs;
DROP POLICY IF EXISTS "payroll_runs_delete_admin" ON public.payroll_runs;

CREATE POLICY "payroll_runs_select"
ON public.payroll_runs FOR SELECT
TO authenticated
USING (public.can_use_payroll(auth.uid(), company_id));

CREATE POLICY "payroll_runs_insert"
ON public.payroll_runs FOR INSERT
TO authenticated
WITH CHECK (public.can_use_payroll(auth.uid(), company_id));

CREATE POLICY "payroll_runs_update"
ON public.payroll_runs FOR UPDATE
TO authenticated
USING (public.can_use_payroll(auth.uid(), company_id))
WITH CHECK (public.can_use_payroll(auth.uid(), company_id));

CREATE POLICY "payroll_runs_delete"
ON public.payroll_runs FOR DELETE
TO authenticated
USING (
    public.can_use_payroll(auth.uid(), company_id)
    AND status = 'draft'
);

-- =============================================
-- PAYROLL ENTRIES - Require payroll module
-- =============================================

DROP POLICY IF EXISTS "payroll_entries_select_own" ON public.payroll_entries;
DROP POLICY IF EXISTS "payroll_entries_select_admin" ON public.payroll_entries;
DROP POLICY IF EXISTS "payroll_entries_insert_admin" ON public.payroll_entries;
DROP POLICY IF EXISTS "payroll_entries_update_admin" ON public.payroll_entries;
DROP POLICY IF EXISTS "payroll_entries_delete_admin" ON public.payroll_entries;

-- Employees can view their own entries if company has payroll module
CREATE POLICY "payroll_entries_select_own"
ON public.payroll_entries FOR SELECT
TO authenticated
USING (
    public.is_own_employee_record(auth.uid(), employee_id)
    AND public.company_has_module(company_id, 'payroll')
);

CREATE POLICY "payroll_entries_select_admin"
ON public.payroll_entries FOR SELECT
TO authenticated
USING (public.can_use_payroll(auth.uid(), company_id));

CREATE POLICY "payroll_entries_insert"
ON public.payroll_entries FOR INSERT
TO authenticated
WITH CHECK (public.can_use_payroll(auth.uid(), company_id));

CREATE POLICY "payroll_entries_update"
ON public.payroll_entries FOR UPDATE
TO authenticated
USING (public.can_use_payroll(auth.uid(), company_id))
WITH CHECK (public.can_use_payroll(auth.uid(), company_id));

CREATE POLICY "payroll_entries_delete"
ON public.payroll_entries FOR DELETE
TO authenticated
USING (
    public.can_use_payroll(auth.uid(), company_id)
    AND EXISTS (
        SELECT 1 FROM public.payroll_runs pr
        WHERE pr.id = payroll_run_id AND pr.status = 'draft'
    )
);

-- =============================================
-- JOBS - Require recruitment module for writes
-- =============================================

DROP POLICY IF EXISTS "jobs_insert_hr" ON public.jobs;
DROP POLICY IF EXISTS "jobs_update_hr" ON public.jobs;
DROP POLICY IF EXISTS "jobs_delete_hr" ON public.jobs;

CREATE POLICY "jobs_insert"
ON public.jobs FOR INSERT
TO authenticated
WITH CHECK (public.can_use_recruitment(auth.uid(), company_id));

CREATE POLICY "jobs_update"
ON public.jobs FOR UPDATE
TO authenticated
USING (public.can_use_recruitment(auth.uid(), company_id))
WITH CHECK (public.can_use_recruitment(auth.uid(), company_id));

CREATE POLICY "jobs_delete"
ON public.jobs FOR DELETE
TO authenticated
USING (public.can_use_recruitment(auth.uid(), company_id));

-- =============================================
-- CANDIDATES - Require recruitment module for management
-- =============================================

DROP POLICY IF EXISTS "candidates_select_hr" ON public.candidates;
DROP POLICY IF EXISTS "candidates_select_hiring_manager" ON public.candidates;
DROP POLICY IF EXISTS "candidates_update_hr" ON public.candidates;
DROP POLICY IF EXISTS "candidates_delete_hr" ON public.candidates;

CREATE POLICY "candidates_select_hr"
ON public.candidates FOR SELECT
TO authenticated
USING (public.can_use_recruitment(auth.uid(), company_id));

CREATE POLICY "candidates_select_hiring_manager"
ON public.candidates FOR SELECT
TO authenticated
USING (
    public.company_has_module(company_id, 'recruitment')
    AND EXISTS (
        SELECT 1 FROM public.jobs j
        JOIN public.employees e ON e.id = j.hiring_manager_id
        WHERE j.id = job_id AND e.user_id = auth.uid()
    )
);

CREATE POLICY "candidates_update"
ON public.candidates FOR UPDATE
TO authenticated
USING (public.can_use_recruitment(auth.uid(), company_id))
WITH CHECK (public.can_use_recruitment(auth.uid(), company_id));

CREATE POLICY "candidates_delete"
ON public.candidates FOR DELETE
TO authenticated
USING (public.can_use_recruitment(auth.uid(), company_id));

-- =============================================
-- TIME ENTRIES - Require time_tracking module
-- =============================================

DROP POLICY IF EXISTS "time_entries_select_own" ON public.time_entries;
DROP POLICY IF EXISTS "time_entries_select_manager" ON public.time_entries;
DROP POLICY IF EXISTS "time_entries_select_hr" ON public.time_entries;
DROP POLICY IF EXISTS "time_entries_insert_own" ON public.time_entries;
DROP POLICY IF EXISTS "time_entries_update_own" ON public.time_entries;
DROP POLICY IF EXISTS "time_entries_update_manager" ON public.time_entries;
DROP POLICY IF EXISTS "time_entries_all_hr" ON public.time_entries;

CREATE POLICY "time_entries_select_own"
ON public.time_entries FOR SELECT
TO authenticated
USING (
    public.is_own_employee_record(auth.uid(), employee_id)
    AND public.company_has_module(company_id, 'time_tracking')
);

CREATE POLICY "time_entries_select_manager"
ON public.time_entries FOR SELECT
TO authenticated
USING (
    public.is_manager_of_employee(auth.uid(), employee_id)
    AND public.company_has_module(company_id, 'time_tracking')
);

CREATE POLICY "time_entries_select_hr"
ON public.time_entries FOR SELECT
TO authenticated
USING (
    public.is_active_hr_or_above(auth.uid(), company_id)
    AND public.company_has_module(company_id, 'time_tracking')
);

CREATE POLICY "time_entries_insert_own"
ON public.time_entries FOR INSERT
TO authenticated
WITH CHECK (
    public.is_own_employee_record(auth.uid(), employee_id)
    AND public.can_use_time_tracking(auth.uid(), company_id)
);

CREATE POLICY "time_entries_update_own"
ON public.time_entries FOR UPDATE
TO authenticated
USING (
    public.is_own_employee_record(auth.uid(), employee_id)
    AND is_approved = false
    AND public.company_has_module(company_id, 'time_tracking')
)
WITH CHECK (public.can_use_time_tracking(auth.uid(), company_id));

CREATE POLICY "time_entries_update_manager"
ON public.time_entries FOR UPDATE
TO authenticated
USING (
    public.is_manager_of_employee(auth.uid(), employee_id)
    AND public.company_has_module(company_id, 'time_tracking')
)
WITH CHECK (public.can_use_time_tracking(auth.uid(), company_id));

CREATE POLICY "time_entries_all_hr"
ON public.time_entries FOR ALL
TO authenticated
USING (
    public.is_active_hr_or_above(auth.uid(), company_id)
    AND public.company_has_module(company_id, 'time_tracking')
)
WITH CHECK (public.can_use_time_tracking(auth.uid(), company_id));

-- =============================================
-- PERFORMANCE REVIEWS - Require performance module
-- =============================================

DROP POLICY IF EXISTS "performance_reviews_select_own" ON public.performance_reviews;
DROP POLICY IF EXISTS "performance_reviews_select_reviewer" ON public.performance_reviews;
DROP POLICY IF EXISTS "performance_reviews_select_hr" ON public.performance_reviews;
DROP POLICY IF EXISTS "performance_reviews_insert_hr" ON public.performance_reviews;
DROP POLICY IF EXISTS "performance_reviews_update_reviewer" ON public.performance_reviews;
DROP POLICY IF EXISTS "performance_reviews_update_acknowledge" ON public.performance_reviews;
DROP POLICY IF EXISTS "performance_reviews_update_hr" ON public.performance_reviews;
DROP POLICY IF EXISTS "performance_reviews_delete_admin" ON public.performance_reviews;

CREATE POLICY "performance_reviews_select_own"
ON public.performance_reviews FOR SELECT
TO authenticated
USING (
    public.is_own_employee_record(auth.uid(), employee_id)
    AND status IN ('completed', 'acknowledged')
    AND public.company_has_module(company_id, 'performance')
);

CREATE POLICY "performance_reviews_select_reviewer"
ON public.performance_reviews FOR SELECT
TO authenticated
USING (
    public.is_own_employee_record(auth.uid(), reviewer_id)
    AND public.company_has_module(company_id, 'performance')
);

CREATE POLICY "performance_reviews_select_hr"
ON public.performance_reviews FOR SELECT
TO authenticated
USING (
    public.is_active_hr_or_above(auth.uid(), company_id)
    AND public.company_has_module(company_id, 'performance')
);

CREATE POLICY "performance_reviews_insert"
ON public.performance_reviews FOR INSERT
TO authenticated
WITH CHECK (
    public.is_active_hr_or_above(auth.uid(), company_id)
    AND public.can_use_performance(auth.uid(), company_id)
);

CREATE POLICY "performance_reviews_update_reviewer"
ON public.performance_reviews FOR UPDATE
TO authenticated
USING (
    public.is_own_employee_record(auth.uid(), reviewer_id)
    AND status IN ('draft', 'in_progress')
    AND public.company_has_module(company_id, 'performance')
)
WITH CHECK (public.can_use_performance(auth.uid(), company_id));

CREATE POLICY "performance_reviews_update_acknowledge"
ON public.performance_reviews FOR UPDATE
TO authenticated
USING (
    public.is_own_employee_record(auth.uid(), employee_id)
    AND status = 'completed'
    AND public.company_has_module(company_id, 'performance')
)
WITH CHECK (
    status = 'acknowledged'
    AND public.can_use_performance(auth.uid(), company_id)
);

CREATE POLICY "performance_reviews_update_hr"
ON public.performance_reviews FOR UPDATE
TO authenticated
USING (
    public.is_active_hr_or_above(auth.uid(), company_id)
    AND public.company_has_module(company_id, 'performance')
)
WITH CHECK (public.can_use_performance(auth.uid(), company_id));

CREATE POLICY "performance_reviews_delete"
ON public.performance_reviews FOR DELETE
TO authenticated
USING (
    public.is_active_company_admin(auth.uid(), company_id)
    AND public.company_has_module(company_id, 'performance')
);

-- =============================================
-- LEAVE REQUESTS - Require leave module
-- =============================================

DROP POLICY IF EXISTS "leave_requests_select_own" ON public.leave_requests;
DROP POLICY IF EXISTS "leave_requests_select_manager" ON public.leave_requests;
DROP POLICY IF EXISTS "leave_requests_select_hr" ON public.leave_requests;
DROP POLICY IF EXISTS "leave_requests_insert_own" ON public.leave_requests;
DROP POLICY IF EXISTS "leave_requests_update_own" ON public.leave_requests;
DROP POLICY IF EXISTS "leave_requests_update_manager" ON public.leave_requests;
DROP POLICY IF EXISTS "leave_requests_update_hr" ON public.leave_requests;
DROP POLICY IF EXISTS "leave_requests_delete_hr" ON public.leave_requests;

CREATE POLICY "leave_requests_select_own"
ON public.leave_requests FOR SELECT
TO authenticated
USING (
    public.is_own_employee_record(auth.uid(), employee_id)
    AND public.company_has_module(company_id, 'leave')
);

CREATE POLICY "leave_requests_select_manager"
ON public.leave_requests FOR SELECT
TO authenticated
USING (
    public.is_manager_of_employee(auth.uid(), employee_id)
    AND public.company_has_module(company_id, 'leave')
);

CREATE POLICY "leave_requests_select_hr"
ON public.leave_requests FOR SELECT
TO authenticated
USING (
    public.is_active_hr_or_above(auth.uid(), company_id)
    AND public.company_has_module(company_id, 'leave')
);

CREATE POLICY "leave_requests_insert_own"
ON public.leave_requests FOR INSERT
TO authenticated
WITH CHECK (
    public.is_own_employee_record(auth.uid(), employee_id)
    AND public.can_use_leave(auth.uid(), company_id)
);

CREATE POLICY "leave_requests_update_own"
ON public.leave_requests FOR UPDATE
TO authenticated
USING (
    public.is_own_employee_record(auth.uid(), employee_id)
    AND status = 'pending'
    AND public.company_has_module(company_id, 'leave')
)
WITH CHECK (public.can_use_leave(auth.uid(), company_id));

CREATE POLICY "leave_requests_update_manager"
ON public.leave_requests FOR UPDATE
TO authenticated
USING (
    public.is_manager_of_employee(auth.uid(), employee_id)
    AND public.company_has_module(company_id, 'leave')
)
WITH CHECK (public.can_use_leave(auth.uid(), company_id));

CREATE POLICY "leave_requests_update_hr"
ON public.leave_requests FOR UPDATE
TO authenticated
USING (
    public.is_active_hr_or_above(auth.uid(), company_id)
    AND public.company_has_module(company_id, 'leave')
)
WITH CHECK (public.can_use_leave(auth.uid(), company_id));

CREATE POLICY "leave_requests_delete_hr"
ON public.leave_requests FOR DELETE
TO authenticated
USING (
    public.is_active_hr_or_above(auth.uid(), company_id)
    AND public.company_has_module(company_id, 'leave')
);

-- =============================================
-- LEAVE TYPES - Require leave module
-- =============================================

DROP POLICY IF EXISTS "leave_types_insert_hr" ON public.leave_types;
DROP POLICY IF EXISTS "leave_types_update_hr" ON public.leave_types;
DROP POLICY IF EXISTS "leave_types_delete_admin" ON public.leave_types;

CREATE POLICY "leave_types_insert"
ON public.leave_types FOR INSERT
TO authenticated
WITH CHECK (
    public.is_active_hr_or_above(auth.uid(), company_id)
    AND public.can_use_leave(auth.uid(), company_id)
);

CREATE POLICY "leave_types_update"
ON public.leave_types FOR UPDATE
TO authenticated
USING (
    public.is_active_hr_or_above(auth.uid(), company_id)
    AND public.company_has_module(company_id, 'leave')
)
WITH CHECK (public.can_use_leave(auth.uid(), company_id));

CREATE POLICY "leave_types_delete"
ON public.leave_types FOR DELETE
TO authenticated
USING (
    public.is_active_company_admin(auth.uid(), company_id)
    AND public.company_has_module(company_id, 'leave')
);

-- =============================================
-- EMPLOYEE DOCUMENTS - Require documents module
-- =============================================

DROP POLICY IF EXISTS "employee_documents_insert_own" ON public.employee_documents;
DROP POLICY IF EXISTS "employee_documents_insert_hr" ON public.employee_documents;
DROP POLICY IF EXISTS "employee_documents_update_hr" ON public.employee_documents;
DROP POLICY IF EXISTS "employee_documents_delete_hr" ON public.employee_documents;

CREATE POLICY "employee_documents_insert_own"
ON public.employee_documents FOR INSERT
TO authenticated
WITH CHECK (
    public.is_own_employee_record(auth.uid(), employee_id)
    AND public.can_use_documents(auth.uid(), company_id)
);

CREATE POLICY "employee_documents_insert_hr"
ON public.employee_documents FOR INSERT
TO authenticated
WITH CHECK (
    public.is_active_hr_or_above(auth.uid(), company_id)
    AND public.can_use_documents(auth.uid(), company_id)
);

CREATE POLICY "employee_documents_update"
ON public.employee_documents FOR UPDATE
TO authenticated
USING (
    public.is_active_hr_or_above(auth.uid(), company_id)
    AND public.company_has_module(company_id, 'documents')
)
WITH CHECK (public.can_use_documents(auth.uid(), company_id));

CREATE POLICY "employee_documents_delete"
ON public.employee_documents FOR DELETE
TO authenticated
USING (
    public.is_active_hr_or_above(auth.uid(), company_id)
    AND public.company_has_module(company_id, 'documents')
);

-- =============================================
-- EMPLOYEES - Enforce plan limits
-- =============================================

DROP POLICY IF EXISTS "employees_insert_hr" ON public.employees;

CREATE POLICY "employees_insert"
ON public.employees FOR INSERT
TO authenticated
WITH CHECK (
    public.is_active_hr_or_above(auth.uid(), company_id)
    AND public.is_company_active(company_id)
    AND public.company_can_add_employee(company_id)
);

-- =============================================
-- UPDATE PLANS WITH PROPER MODULE STRUCTURE
-- =============================================

UPDATE public.plans SET features = '{"modules": ["employees", "directory"], "support": "community"}'::jsonb WHERE name = 'Free';
UPDATE public.plans SET features = '{"modules": ["employees", "directory", "leave", "time_tracking"], "support": "email"}'::jsonb WHERE name = 'Basic';
UPDATE public.plans SET features = '{"modules": ["employees", "directory", "leave", "time_tracking", "documents", "recruitment", "performance"], "support": "priority"}'::jsonb WHERE name = 'Pro';
UPDATE public.plans SET features = '{"modules": "all", "support": "dedicated", "sso": true, "api": true, "audit": true}'::jsonb WHERE name = 'Enterprise';
