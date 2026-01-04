
-- =============================================
-- COMPREHENSIVE RLS POLICIES FOR HR SAAS
-- With company active checks, role-based access
-- =============================================

-- =============================================
-- DROP EXISTING POLICIES
-- =============================================

DROP POLICY IF EXISTS "Plans are viewable by everyone" ON public.plans;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Company members can view their companies" ON public.companies;
DROP POLICY IF EXISTS "Company admins can update their companies" ON public.companies;
DROP POLICY IF EXISTS "Authenticated users can create companies" ON public.companies;
DROP POLICY IF EXISTS "Company admins can view subscriptions" ON public.company_subscriptions;
DROP POLICY IF EXISTS "Company admins can manage subscriptions" ON public.company_subscriptions;
DROP POLICY IF EXISTS "Company members can view company users" ON public.company_users;
DROP POLICY IF EXISTS "Company admins can manage company users" ON public.company_users;
DROP POLICY IF EXISTS "Company members can view departments" ON public.departments;
DROP POLICY IF EXISTS "HR can manage departments" ON public.departments;
DROP POLICY IF EXISTS "Company members can view employees" ON public.employees;
DROP POLICY IF EXISTS "HR can manage employees" ON public.employees;
DROP POLICY IF EXISTS "Company members can view leave types" ON public.leave_types;
DROP POLICY IF EXISTS "HR can manage leave types" ON public.leave_types;
DROP POLICY IF EXISTS "Employees can view own leave requests" ON public.leave_requests;
DROP POLICY IF EXISTS "Employees can create own leave requests" ON public.leave_requests;
DROP POLICY IF EXISTS "HR can manage all leave requests" ON public.leave_requests;
DROP POLICY IF EXISTS "Employees can view own time entries" ON public.time_entries;
DROP POLICY IF EXISTS "Employees can manage own time entries" ON public.time_entries;
DROP POLICY IF EXISTS "HR can manage all time entries" ON public.time_entries;
DROP POLICY IF EXISTS "Company members can view document types" ON public.document_types;
DROP POLICY IF EXISTS "HR can manage document types" ON public.document_types;
DROP POLICY IF EXISTS "Employees can view own documents" ON public.employee_documents;
DROP POLICY IF EXISTS "HR can manage all documents" ON public.employee_documents;
DROP POLICY IF EXISTS "Open jobs are publicly viewable" ON public.jobs;
DROP POLICY IF EXISTS "HR can manage jobs" ON public.jobs;
DROP POLICY IF EXISTS "HR can view candidates" ON public.candidates;
DROP POLICY IF EXISTS "Anyone can apply" ON public.candidates;
DROP POLICY IF EXISTS "HR can manage candidates" ON public.candidates;
DROP POLICY IF EXISTS "Employees can view own reviews" ON public.performance_reviews;
DROP POLICY IF EXISTS "HR can manage reviews" ON public.performance_reviews;
DROP POLICY IF EXISTS "Admins can view payroll runs" ON public.payroll_runs;
DROP POLICY IF EXISTS "Admins can manage payroll runs" ON public.payroll_runs;
DROP POLICY IF EXISTS "Employees can view own payroll entries" ON public.payroll_entries;
DROP POLICY IF EXISTS "Admins can manage payroll entries" ON public.payroll_entries;
DROP POLICY IF EXISTS "Company admins can view audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Company admins can view security events" ON public.security_events;
DROP POLICY IF EXISTS "Company admins can view support access" ON public.support_access;
DROP POLICY IF EXISTS "Company admins can manage support access" ON public.support_access;

-- =============================================
-- ENHANCED HELPER FUNCTIONS
-- =============================================

-- Check if a company is active
CREATE OR REPLACE FUNCTION public.is_company_active(_company_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT COALESCE(
        (SELECT is_active FROM public.companies WHERE id = _company_id),
        false
    )
$$;

-- Check if user is member of an active company
CREATE OR REPLACE FUNCTION public.is_active_company_member(_user_id UUID, _company_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.company_users cu
        JOIN public.companies c ON c.id = cu.company_id
        WHERE cu.user_id = _user_id
          AND cu.company_id = _company_id
          AND cu.is_active = true
          AND c.is_active = true
    )
$$;

-- Check if user is admin of an active company
CREATE OR REPLACE FUNCTION public.is_active_company_admin(_user_id UUID, _company_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.company_users cu
        JOIN public.companies c ON c.id = cu.company_id
        WHERE cu.user_id = _user_id
          AND cu.company_id = _company_id
          AND cu.role IN ('super_admin', 'company_admin')
          AND cu.is_active = true
          AND c.is_active = true
    )
$$;

-- Check if user is HR or above in an active company
CREATE OR REPLACE FUNCTION public.is_active_hr_or_above(_user_id UUID, _company_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.company_users cu
        JOIN public.companies c ON c.id = cu.company_id
        WHERE cu.user_id = _user_id
          AND cu.company_id = _company_id
          AND cu.role IN ('super_admin', 'company_admin', 'hr_manager')
          AND cu.is_active = true
          AND c.is_active = true
    )
$$;

-- Check if user is manager or above in an active company
CREATE OR REPLACE FUNCTION public.is_active_manager_or_above(_user_id UUID, _company_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.company_users cu
        JOIN public.companies c ON c.id = cu.company_id
        WHERE cu.user_id = _user_id
          AND cu.company_id = _company_id
          AND cu.role IN ('super_admin', 'company_admin', 'hr_manager', 'manager')
          AND cu.is_active = true
          AND c.is_active = true
    )
$$;

-- Get employee ID for current user in a company
CREATE OR REPLACE FUNCTION public.get_user_employee_id(_user_id UUID, _company_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT id FROM public.employees 
    WHERE user_id = _user_id 
      AND company_id = _company_id
    LIMIT 1
$$;

-- Check if user owns this employee record
CREATE OR REPLACE FUNCTION public.is_own_employee_record(_user_id UUID, _employee_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.employees
        WHERE id = _employee_id
          AND user_id = _user_id
    )
$$;

-- Check if user is manager of an employee
CREATE OR REPLACE FUNCTION public.is_manager_of_employee(_user_id UUID, _employee_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 
        FROM public.employees e
        JOIN public.employees mgr ON mgr.id = e.manager_id
        WHERE e.id = _employee_id
          AND mgr.user_id = _user_id
    )
$$;

-- Check if support access is valid (explicit and time-limited)
CREATE OR REPLACE FUNCTION public.has_valid_support_access(_user_id UUID, _company_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.support_access
        WHERE company_id = _company_id
          AND support_user_id = _user_id
          AND starts_at <= now()
          AND expires_at > now()
          AND revoked_at IS NULL
    )
$$;

-- =============================================
-- PLANS POLICIES (Public read)
-- =============================================

CREATE POLICY "plans_select_public"
ON public.plans FOR SELECT
USING (is_active = true);

-- =============================================
-- PROFILES POLICIES
-- =============================================

CREATE POLICY "profiles_select_own"
ON public.profiles FOR SELECT
TO authenticated
USING (id = auth.uid());

CREATE POLICY "profiles_insert_own"
ON public.profiles FOR INSERT
TO authenticated
WITH CHECK (id = auth.uid());

CREATE POLICY "profiles_update_own"
ON public.profiles FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- =============================================
-- COMPANIES POLICIES
-- =============================================

-- Select: Members can view their active companies
CREATE POLICY "companies_select_member"
ON public.companies FOR SELECT
TO authenticated
USING (public.is_company_member(auth.uid(), id));

-- Insert: Any authenticated user can create a company
CREATE POLICY "companies_insert_authenticated"
ON public.companies FOR INSERT
TO authenticated
WITH CHECK (true);

-- Update: Only admins can update, company must be active
CREATE POLICY "companies_update_admin"
ON public.companies FOR UPDATE
TO authenticated
USING (public.is_active_company_admin(auth.uid(), id))
WITH CHECK (public.is_active_company_admin(auth.uid(), id));

-- Delete: Only super_admin can delete
CREATE POLICY "companies_delete_super_admin"
ON public.companies FOR DELETE
TO authenticated
USING (public.has_company_role(auth.uid(), id, 'super_admin'));

-- =============================================
-- COMPANY SUBSCRIPTIONS POLICIES
-- =============================================

CREATE POLICY "subscriptions_select_admin"
ON public.company_subscriptions FOR SELECT
TO authenticated
USING (public.is_active_company_admin(auth.uid(), company_id));

CREATE POLICY "subscriptions_insert_admin"
ON public.company_subscriptions FOR INSERT
TO authenticated
WITH CHECK (
    public.is_active_company_admin(auth.uid(), company_id)
    AND public.is_company_active(company_id)
);

CREATE POLICY "subscriptions_update_admin"
ON public.company_subscriptions FOR UPDATE
TO authenticated
USING (public.is_active_company_admin(auth.uid(), company_id))
WITH CHECK (public.is_company_active(company_id));

CREATE POLICY "subscriptions_delete_admin"
ON public.company_subscriptions FOR DELETE
TO authenticated
USING (public.is_active_company_admin(auth.uid(), company_id));

-- =============================================
-- COMPANY USERS POLICIES
-- =============================================

CREATE POLICY "company_users_select_member"
ON public.company_users FOR SELECT
TO authenticated
USING (public.is_active_company_member(auth.uid(), company_id));

CREATE POLICY "company_users_insert_admin"
ON public.company_users FOR INSERT
TO authenticated
WITH CHECK (
    public.is_active_company_admin(auth.uid(), company_id)
    AND public.is_company_active(company_id)
);

CREATE POLICY "company_users_update_admin"
ON public.company_users FOR UPDATE
TO authenticated
USING (public.is_active_company_admin(auth.uid(), company_id))
WITH CHECK (public.is_company_active(company_id));

CREATE POLICY "company_users_delete_admin"
ON public.company_users FOR DELETE
TO authenticated
USING (public.is_active_company_admin(auth.uid(), company_id));

-- Allow first user to join as admin (company creator)
CREATE POLICY "company_users_insert_first"
ON public.company_users FOR INSERT
TO authenticated
WITH CHECK (
    user_id = auth.uid()
    AND role IN ('super_admin', 'company_admin')
    AND NOT EXISTS (
        SELECT 1 FROM public.company_users WHERE company_id = company_users.company_id
    )
);

-- =============================================
-- DEPARTMENTS POLICIES
-- =============================================

CREATE POLICY "departments_select_member"
ON public.departments FOR SELECT
TO authenticated
USING (public.is_active_company_member(auth.uid(), company_id));

CREATE POLICY "departments_insert_hr"
ON public.departments FOR INSERT
TO authenticated
WITH CHECK (
    public.is_active_hr_or_above(auth.uid(), company_id)
    AND public.is_company_active(company_id)
);

CREATE POLICY "departments_update_hr"
ON public.departments FOR UPDATE
TO authenticated
USING (public.is_active_hr_or_above(auth.uid(), company_id))
WITH CHECK (public.is_company_active(company_id));

CREATE POLICY "departments_delete_admin"
ON public.departments FOR DELETE
TO authenticated
USING (public.is_active_company_admin(auth.uid(), company_id));

-- =============================================
-- EMPLOYEES POLICIES
-- =============================================

-- Employees can view their own record
CREATE POLICY "employees_select_own"
ON public.employees FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Managers can view their direct reports
CREATE POLICY "employees_select_manager"
ON public.employees FOR SELECT
TO authenticated
USING (public.is_manager_of_employee(auth.uid(), id));

-- HR/Admin can view all employees in their company
CREATE POLICY "employees_select_hr"
ON public.employees FOR SELECT
TO authenticated
USING (public.is_active_hr_or_above(auth.uid(), company_id));

-- HR can insert employees
CREATE POLICY "employees_insert_hr"
ON public.employees FOR INSERT
TO authenticated
WITH CHECK (
    public.is_active_hr_or_above(auth.uid(), company_id)
    AND public.is_company_active(company_id)
);

-- Employees can update limited fields of their own record
CREATE POLICY "employees_update_own"
ON public.employees FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (
    user_id = auth.uid()
    AND public.is_company_active(company_id)
);

-- HR can update any employee
CREATE POLICY "employees_update_hr"
ON public.employees FOR UPDATE
TO authenticated
USING (public.is_active_hr_or_above(auth.uid(), company_id))
WITH CHECK (public.is_company_active(company_id));

-- Only admin can delete employees
CREATE POLICY "employees_delete_admin"
ON public.employees FOR DELETE
TO authenticated
USING (public.is_active_company_admin(auth.uid(), company_id));

-- =============================================
-- LEAVE TYPES POLICIES
-- =============================================

CREATE POLICY "leave_types_select_member"
ON public.leave_types FOR SELECT
TO authenticated
USING (public.is_active_company_member(auth.uid(), company_id));

CREATE POLICY "leave_types_insert_hr"
ON public.leave_types FOR INSERT
TO authenticated
WITH CHECK (
    public.is_active_hr_or_above(auth.uid(), company_id)
    AND public.is_company_active(company_id)
);

CREATE POLICY "leave_types_update_hr"
ON public.leave_types FOR UPDATE
TO authenticated
USING (public.is_active_hr_or_above(auth.uid(), company_id))
WITH CHECK (public.is_company_active(company_id));

CREATE POLICY "leave_types_delete_admin"
ON public.leave_types FOR DELETE
TO authenticated
USING (public.is_active_company_admin(auth.uid(), company_id));

-- =============================================
-- LEAVE REQUESTS POLICIES
-- =============================================

-- Employees can view their own leave requests
CREATE POLICY "leave_requests_select_own"
ON public.leave_requests FOR SELECT
TO authenticated
USING (
    public.is_own_employee_record(auth.uid(), employee_id)
);

-- Managers can view their team's leave requests
CREATE POLICY "leave_requests_select_manager"
ON public.leave_requests FOR SELECT
TO authenticated
USING (public.is_manager_of_employee(auth.uid(), employee_id));

-- HR/Admin can view all
CREATE POLICY "leave_requests_select_hr"
ON public.leave_requests FOR SELECT
TO authenticated
USING (public.is_active_hr_or_above(auth.uid(), company_id));

-- Employees can create their own leave requests
CREATE POLICY "leave_requests_insert_own"
ON public.leave_requests FOR INSERT
TO authenticated
WITH CHECK (
    public.is_own_employee_record(auth.uid(), employee_id)
    AND public.is_company_active(company_id)
);

-- Employees can update their own pending requests (cancel)
CREATE POLICY "leave_requests_update_own"
ON public.leave_requests FOR UPDATE
TO authenticated
USING (
    public.is_own_employee_record(auth.uid(), employee_id)
    AND status = 'pending'
)
WITH CHECK (public.is_company_active(company_id));

-- Managers can approve/reject direct reports' requests
CREATE POLICY "leave_requests_update_manager"
ON public.leave_requests FOR UPDATE
TO authenticated
USING (public.is_manager_of_employee(auth.uid(), employee_id))
WITH CHECK (public.is_company_active(company_id));

-- HR can manage all leave requests
CREATE POLICY "leave_requests_update_hr"
ON public.leave_requests FOR UPDATE
TO authenticated
USING (public.is_active_hr_or_above(auth.uid(), company_id))
WITH CHECK (public.is_company_active(company_id));

CREATE POLICY "leave_requests_delete_hr"
ON public.leave_requests FOR DELETE
TO authenticated
USING (public.is_active_hr_or_above(auth.uid(), company_id));

-- =============================================
-- TIME ENTRIES POLICIES
-- =============================================

-- Employees can view their own time entries
CREATE POLICY "time_entries_select_own"
ON public.time_entries FOR SELECT
TO authenticated
USING (public.is_own_employee_record(auth.uid(), employee_id));

-- Managers can view their team's time entries
CREATE POLICY "time_entries_select_manager"
ON public.time_entries FOR SELECT
TO authenticated
USING (public.is_manager_of_employee(auth.uid(), employee_id));

-- HR/Admin can view all
CREATE POLICY "time_entries_select_hr"
ON public.time_entries FOR SELECT
TO authenticated
USING (public.is_active_hr_or_above(auth.uid(), company_id));

-- Employees can create their own time entries
CREATE POLICY "time_entries_insert_own"
ON public.time_entries FOR INSERT
TO authenticated
WITH CHECK (
    public.is_own_employee_record(auth.uid(), employee_id)
    AND public.is_company_active(company_id)
);

-- Employees can update their own non-approved entries
CREATE POLICY "time_entries_update_own"
ON public.time_entries FOR UPDATE
TO authenticated
USING (
    public.is_own_employee_record(auth.uid(), employee_id)
    AND is_approved = false
)
WITH CHECK (public.is_company_active(company_id));

-- Managers can approve/update their team's entries
CREATE POLICY "time_entries_update_manager"
ON public.time_entries FOR UPDATE
TO authenticated
USING (public.is_manager_of_employee(auth.uid(), employee_id))
WITH CHECK (public.is_company_active(company_id));

-- HR can manage all time entries
CREATE POLICY "time_entries_all_hr"
ON public.time_entries FOR ALL
TO authenticated
USING (public.is_active_hr_or_above(auth.uid(), company_id))
WITH CHECK (public.is_company_active(company_id));

-- =============================================
-- DOCUMENT TYPES POLICIES
-- =============================================

CREATE POLICY "document_types_select_member"
ON public.document_types FOR SELECT
TO authenticated
USING (public.is_active_company_member(auth.uid(), company_id));

CREATE POLICY "document_types_insert_hr"
ON public.document_types FOR INSERT
TO authenticated
WITH CHECK (
    public.is_active_hr_or_above(auth.uid(), company_id)
    AND public.is_company_active(company_id)
);

CREATE POLICY "document_types_update_hr"
ON public.document_types FOR UPDATE
TO authenticated
USING (public.is_active_hr_or_above(auth.uid(), company_id))
WITH CHECK (public.is_company_active(company_id));

CREATE POLICY "document_types_delete_admin"
ON public.document_types FOR DELETE
TO authenticated
USING (public.is_active_company_admin(auth.uid(), company_id));

-- =============================================
-- EMPLOYEE DOCUMENTS POLICIES
-- =============================================

-- Employees can view their own documents
CREATE POLICY "employee_documents_select_own"
ON public.employee_documents FOR SELECT
TO authenticated
USING (public.is_own_employee_record(auth.uid(), employee_id));

-- HR can view all documents
CREATE POLICY "employee_documents_select_hr"
ON public.employee_documents FOR SELECT
TO authenticated
USING (public.is_active_hr_or_above(auth.uid(), company_id));

-- Employees can upload their own documents
CREATE POLICY "employee_documents_insert_own"
ON public.employee_documents FOR INSERT
TO authenticated
WITH CHECK (
    public.is_own_employee_record(auth.uid(), employee_id)
    AND public.is_company_active(company_id)
);

-- HR can upload documents for anyone
CREATE POLICY "employee_documents_insert_hr"
ON public.employee_documents FOR INSERT
TO authenticated
WITH CHECK (
    public.is_active_hr_or_above(auth.uid(), company_id)
    AND public.is_company_active(company_id)
);

-- HR can manage all documents
CREATE POLICY "employee_documents_update_hr"
ON public.employee_documents FOR UPDATE
TO authenticated
USING (public.is_active_hr_or_above(auth.uid(), company_id))
WITH CHECK (public.is_company_active(company_id));

CREATE POLICY "employee_documents_delete_hr"
ON public.employee_documents FOR DELETE
TO authenticated
USING (public.is_active_hr_or_above(auth.uid(), company_id));

-- =============================================
-- JOBS POLICIES
-- =============================================

-- Open jobs are publicly viewable
CREATE POLICY "jobs_select_public"
ON public.jobs FOR SELECT
USING (status = 'open');

-- Company members can view all jobs in their company
CREATE POLICY "jobs_select_member"
ON public.jobs FOR SELECT
TO authenticated
USING (public.is_active_company_member(auth.uid(), company_id));

CREATE POLICY "jobs_insert_hr"
ON public.jobs FOR INSERT
TO authenticated
WITH CHECK (
    public.is_active_hr_or_above(auth.uid(), company_id)
    AND public.is_company_active(company_id)
);

CREATE POLICY "jobs_update_hr"
ON public.jobs FOR UPDATE
TO authenticated
USING (public.is_active_hr_or_above(auth.uid(), company_id))
WITH CHECK (public.is_company_active(company_id));

CREATE POLICY "jobs_delete_hr"
ON public.jobs FOR DELETE
TO authenticated
USING (public.is_active_hr_or_above(auth.uid(), company_id));

-- =============================================
-- CANDIDATES POLICIES
-- =============================================

-- Anyone can apply (insert only basic info)
CREATE POLICY "candidates_insert_public"
ON public.candidates FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.jobs 
        WHERE id = job_id AND status = 'open'
    )
);

-- HR can view all candidates in their company
CREATE POLICY "candidates_select_hr"
ON public.candidates FOR SELECT
TO authenticated
USING (public.is_active_hr_or_above(auth.uid(), company_id));

-- Hiring managers can view candidates for their jobs
CREATE POLICY "candidates_select_hiring_manager"
ON public.candidates FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.jobs j
        JOIN public.employees e ON e.id = j.hiring_manager_id
        WHERE j.id = job_id AND e.user_id = auth.uid()
    )
);

CREATE POLICY "candidates_update_hr"
ON public.candidates FOR UPDATE
TO authenticated
USING (public.is_active_hr_or_above(auth.uid(), company_id))
WITH CHECK (public.is_company_active(company_id));

CREATE POLICY "candidates_delete_hr"
ON public.candidates FOR DELETE
TO authenticated
USING (public.is_active_hr_or_above(auth.uid(), company_id));

-- =============================================
-- PERFORMANCE REVIEWS POLICIES
-- =============================================

-- Employees can view their own reviews (completed ones)
CREATE POLICY "performance_reviews_select_own"
ON public.performance_reviews FOR SELECT
TO authenticated
USING (
    public.is_own_employee_record(auth.uid(), employee_id)
    AND status IN ('completed', 'acknowledged')
);

-- Reviewers can view reviews they're conducting
CREATE POLICY "performance_reviews_select_reviewer"
ON public.performance_reviews FOR SELECT
TO authenticated
USING (public.is_own_employee_record(auth.uid(), reviewer_id));

-- HR/Admin can view all reviews
CREATE POLICY "performance_reviews_select_hr"
ON public.performance_reviews FOR SELECT
TO authenticated
USING (public.is_active_hr_or_above(auth.uid(), company_id));

-- HR can create reviews
CREATE POLICY "performance_reviews_insert_hr"
ON public.performance_reviews FOR INSERT
TO authenticated
WITH CHECK (
    public.is_active_hr_or_above(auth.uid(), company_id)
    AND public.is_company_active(company_id)
);

-- Reviewers can update reviews they're conducting
CREATE POLICY "performance_reviews_update_reviewer"
ON public.performance_reviews FOR UPDATE
TO authenticated
USING (
    public.is_own_employee_record(auth.uid(), reviewer_id)
    AND status IN ('draft', 'in_progress')
)
WITH CHECK (public.is_company_active(company_id));

-- Employees can acknowledge their completed reviews
CREATE POLICY "performance_reviews_update_acknowledge"
ON public.performance_reviews FOR UPDATE
TO authenticated
USING (
    public.is_own_employee_record(auth.uid(), employee_id)
    AND status = 'completed'
)
WITH CHECK (
    status = 'acknowledged'
    AND public.is_company_active(company_id)
);

-- HR can manage all reviews
CREATE POLICY "performance_reviews_update_hr"
ON public.performance_reviews FOR UPDATE
TO authenticated
USING (public.is_active_hr_or_above(auth.uid(), company_id))
WITH CHECK (public.is_company_active(company_id));

CREATE POLICY "performance_reviews_delete_admin"
ON public.performance_reviews FOR DELETE
TO authenticated
USING (public.is_active_company_admin(auth.uid(), company_id));

-- =============================================
-- PAYROLL RUNS POLICIES (Admin Only)
-- =============================================

CREATE POLICY "payroll_runs_select_admin"
ON public.payroll_runs FOR SELECT
TO authenticated
USING (public.is_active_company_admin(auth.uid(), company_id));

CREATE POLICY "payroll_runs_insert_admin"
ON public.payroll_runs FOR INSERT
TO authenticated
WITH CHECK (
    public.is_active_company_admin(auth.uid(), company_id)
    AND public.is_company_active(company_id)
);

CREATE POLICY "payroll_runs_update_admin"
ON public.payroll_runs FOR UPDATE
TO authenticated
USING (public.is_active_company_admin(auth.uid(), company_id))
WITH CHECK (public.is_company_active(company_id));

CREATE POLICY "payroll_runs_delete_admin"
ON public.payroll_runs FOR DELETE
TO authenticated
USING (
    public.is_active_company_admin(auth.uid(), company_id)
    AND status = 'draft'
);

-- =============================================
-- PAYROLL ENTRIES POLICIES (Admin Only for Write)
-- =============================================

-- Employees can view their own payroll entries
CREATE POLICY "payroll_entries_select_own"
ON public.payroll_entries FOR SELECT
TO authenticated
USING (public.is_own_employee_record(auth.uid(), employee_id));

-- Admin can view all payroll entries
CREATE POLICY "payroll_entries_select_admin"
ON public.payroll_entries FOR SELECT
TO authenticated
USING (public.is_active_company_admin(auth.uid(), company_id));

CREATE POLICY "payroll_entries_insert_admin"
ON public.payroll_entries FOR INSERT
TO authenticated
WITH CHECK (
    public.is_active_company_admin(auth.uid(), company_id)
    AND public.is_company_active(company_id)
);

CREATE POLICY "payroll_entries_update_admin"
ON public.payroll_entries FOR UPDATE
TO authenticated
USING (public.is_active_company_admin(auth.uid(), company_id))
WITH CHECK (public.is_company_active(company_id));

CREATE POLICY "payroll_entries_delete_admin"
ON public.payroll_entries FOR DELETE
TO authenticated
USING (
    public.is_active_company_admin(auth.uid(), company_id)
    AND EXISTS (
        SELECT 1 FROM public.payroll_runs pr
        WHERE pr.id = payroll_run_id AND pr.status = 'draft'
    )
);

-- =============================================
-- AUDIT LOGS POLICIES (INSERT ONLY - Immutable)
-- =============================================

-- Admins can view audit logs (read only)
CREATE POLICY "audit_logs_select_admin"
ON public.audit_logs FOR SELECT
TO authenticated
USING (public.is_active_company_admin(auth.uid(), company_id));

-- Support users with valid access can view
CREATE POLICY "audit_logs_select_support"
ON public.audit_logs FOR SELECT
TO authenticated
USING (public.has_valid_support_access(auth.uid(), company_id));

-- System can insert audit logs (via service role or triggers)
CREATE POLICY "audit_logs_insert_authenticated"
ON public.audit_logs FOR INSERT
TO authenticated
WITH CHECK (
    user_id = auth.uid()
    AND (company_id IS NULL OR public.is_active_company_member(auth.uid(), company_id))
);

-- NO UPDATE OR DELETE policies - audit logs are immutable

-- =============================================
-- SECURITY EVENTS POLICIES
-- =============================================

-- Admins can view security events (read only)
CREATE POLICY "security_events_select_admin"
ON public.security_events FOR SELECT
TO authenticated
USING (public.is_active_company_admin(auth.uid(), company_id));

-- Support users with valid access can view
CREATE POLICY "security_events_select_support"
ON public.security_events FOR SELECT
TO authenticated
USING (public.has_valid_support_access(auth.uid(), company_id));

-- System can insert security events
CREATE POLICY "security_events_insert_authenticated"
ON public.security_events FOR INSERT
TO authenticated
WITH CHECK (
    user_id = auth.uid()
    OR public.is_active_company_admin(auth.uid(), company_id)
);

-- Only admins can resolve security events
CREATE POLICY "security_events_update_admin"
ON public.security_events FOR UPDATE
TO authenticated
USING (public.is_active_company_admin(auth.uid(), company_id))
WITH CHECK (public.is_company_active(company_id));

-- NO DELETE - security events are preserved

-- =============================================
-- SUPPORT ACCESS POLICIES (Explicit & Time-Limited)
-- =============================================

-- Admins can view support access grants
CREATE POLICY "support_access_select_admin"
ON public.support_access FOR SELECT
TO authenticated
USING (public.is_active_company_admin(auth.uid(), company_id));

-- Support users can view their own access
CREATE POLICY "support_access_select_own"
ON public.support_access FOR SELECT
TO authenticated
USING (support_user_id = auth.uid());

-- Only admins can grant support access
CREATE POLICY "support_access_insert_admin"
ON public.support_access FOR INSERT
TO authenticated
WITH CHECK (
    public.is_active_company_admin(auth.uid(), company_id)
    AND granted_by = auth.uid()
    AND expires_at > now()
    AND expires_at <= (now() + interval '30 days')
    AND public.is_company_active(company_id)
);

-- Admins can update (revoke) support access
CREATE POLICY "support_access_update_admin"
ON public.support_access FOR UPDATE
TO authenticated
USING (public.is_active_company_admin(auth.uid(), company_id))
WITH CHECK (public.is_company_active(company_id));

-- No delete - support access records are preserved for audit
