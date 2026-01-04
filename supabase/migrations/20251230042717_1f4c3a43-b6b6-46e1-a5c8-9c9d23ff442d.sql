-- ============================================
-- PRODUCTION HARDENING: INDEXES & OPTIMIZATIONS
-- ============================================

-- Performance indexes for frequently queried columns

-- Employees table indexes
CREATE INDEX IF NOT EXISTS idx_employees_company_id ON public.employees(company_id);
CREATE INDEX IF NOT EXISTS idx_employees_user_id ON public.employees(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_employees_department_id ON public.employees(department_id) WHERE department_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_employees_manager_id ON public.employees(manager_id) WHERE manager_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_employees_employment_status ON public.employees(company_id, employment_status);
CREATE INDEX IF NOT EXISTS idx_employees_email ON public.employees(email);
CREATE INDEX IF NOT EXISTS idx_employees_employee_number ON public.employees(company_id, employee_number);

-- Company users indexes
CREATE INDEX IF NOT EXISTS idx_company_users_user_id ON public.company_users(user_id);
CREATE INDEX IF NOT EXISTS idx_company_users_company_id ON public.company_users(company_id);
CREATE INDEX IF NOT EXISTS idx_company_users_role ON public.company_users(company_id, role);
CREATE INDEX IF NOT EXISTS idx_company_users_primary ON public.company_users(user_id, is_primary) WHERE is_primary = true;
CREATE INDEX IF NOT EXISTS idx_company_users_active ON public.company_users(company_id, is_active) WHERE is_active = true;

-- Company subscriptions indexes
CREATE INDEX IF NOT EXISTS idx_company_subscriptions_company_id ON public.company_subscriptions(company_id);
CREATE INDEX IF NOT EXISTS idx_company_subscriptions_status ON public.company_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_company_subscriptions_period_end ON public.company_subscriptions(current_period_end);

-- Departments indexes
CREATE INDEX IF NOT EXISTS idx_departments_company_id ON public.departments(company_id);
CREATE INDEX IF NOT EXISTS idx_departments_parent_id ON public.departments(parent_id) WHERE parent_id IS NOT NULL;

-- Leave requests indexes
CREATE INDEX IF NOT EXISTS idx_leave_requests_company_id ON public.leave_requests(company_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_employee_id ON public.leave_requests(employee_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_status ON public.leave_requests(company_id, status);
CREATE INDEX IF NOT EXISTS idx_leave_requests_dates ON public.leave_requests(start_date, end_date);

-- Time entries indexes
CREATE INDEX IF NOT EXISTS idx_time_entries_company_id ON public.time_entries(company_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_employee_id ON public.time_entries(employee_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_date ON public.time_entries(date);
CREATE INDEX IF NOT EXISTS idx_time_entries_employee_date ON public.time_entries(employee_id, date);

-- Performance reviews indexes
CREATE INDEX IF NOT EXISTS idx_performance_reviews_company_id ON public.performance_reviews(company_id);
CREATE INDEX IF NOT EXISTS idx_performance_reviews_employee_id ON public.performance_reviews(employee_id);
CREATE INDEX IF NOT EXISTS idx_performance_reviews_reviewer_id ON public.performance_reviews(reviewer_id);
CREATE INDEX IF NOT EXISTS idx_performance_reviews_status ON public.performance_reviews(company_id, status);

-- Jobs indexes
CREATE INDEX IF NOT EXISTS idx_jobs_company_id ON public.jobs(company_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON public.jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_department_id ON public.jobs(department_id) WHERE department_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_jobs_slug ON public.jobs(slug);

-- Candidates indexes
CREATE INDEX IF NOT EXISTS idx_candidates_company_id ON public.candidates(company_id);
CREATE INDEX IF NOT EXISTS idx_candidates_job_id ON public.candidates(job_id);
CREATE INDEX IF NOT EXISTS idx_candidates_status ON public.candidates(status);
CREATE INDEX IF NOT EXISTS idx_candidates_email ON public.candidates(email);

-- Audit logs indexes (for compliance queries)
CREATE INDEX IF NOT EXISTS idx_audit_logs_company_id ON public.audit_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_table_action ON public.audit_logs(table_name, action);

-- Security events indexes
CREATE INDEX IF NOT EXISTS idx_security_events_company_id ON public.security_events(company_id);
CREATE INDEX IF NOT EXISTS idx_security_events_user_id ON public.security_events(user_id);
CREATE INDEX IF NOT EXISTS idx_security_events_created_at ON public.security_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_events_type ON public.security_events(event_type);

-- Payroll indexes
CREATE INDEX IF NOT EXISTS idx_payroll_runs_company_id ON public.payroll_runs(company_id);
CREATE INDEX IF NOT EXISTS idx_payroll_runs_status ON public.payroll_runs(company_id, status);
CREATE INDEX IF NOT EXISTS idx_payroll_entries_payroll_run_id ON public.payroll_entries(payroll_run_id);
CREATE INDEX IF NOT EXISTS idx_payroll_entries_employee_id ON public.payroll_entries(employee_id);

-- Document indexes
CREATE INDEX IF NOT EXISTS idx_employee_documents_company_id ON public.employee_documents(company_id);
CREATE INDEX IF NOT EXISTS idx_employee_documents_employee_id ON public.employee_documents(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_documents_type_id ON public.employee_documents(document_type_id);
CREATE INDEX IF NOT EXISTS idx_employee_documents_expiry ON public.employee_documents(expiry_date) WHERE expiry_date IS NOT NULL;

-- Support access indexes
CREATE INDEX IF NOT EXISTS idx_support_access_company_id ON public.support_access(company_id);
CREATE INDEX IF NOT EXISTS idx_support_access_expires ON public.support_access(expires_at) WHERE revoked_at IS NULL;

-- Plans indexes
CREATE INDEX IF NOT EXISTS idx_plans_active ON public.plans(is_active, sort_order);

-- Companies indexes
CREATE INDEX IF NOT EXISTS idx_companies_slug ON public.companies(slug);
CREATE INDEX IF NOT EXISTS idx_companies_active ON public.companies(is_active);

-- Profiles indexes
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);

-- ============================================
-- Add unique constraints for data integrity
-- ============================================

-- Ensure employee numbers are unique per company
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_employee_number 
  ON public.employees(company_id, employee_number);

-- Ensure department codes are unique per company
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_department_code 
  ON public.departments(company_id, code) WHERE code IS NOT NULL;

-- Ensure leave type codes are unique per company
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_leave_type_code 
  ON public.leave_types(company_id, code);

-- Ensure document type codes are unique per company
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_document_type_code 
  ON public.document_types(company_id, code);

-- Ensure job slugs are unique per company
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_job_slug 
  ON public.jobs(company_id, slug);

-- ============================================
-- Add check constraint for data validation
-- ============================================

-- Ensure positive salaries
ALTER TABLE public.employees 
  DROP CONSTRAINT IF EXISTS check_salary_positive;
ALTER TABLE public.employees 
  ADD CONSTRAINT check_salary_positive CHECK (salary IS NULL OR salary >= 0);

-- Ensure valid rating range for candidates
ALTER TABLE public.candidates 
  DROP CONSTRAINT IF EXISTS check_rating_range;
ALTER TABLE public.candidates 
  ADD CONSTRAINT check_rating_range CHECK (rating IS NULL OR (rating >= 1 AND rating <= 5));

-- Ensure valid overall rating for performance reviews
ALTER TABLE public.performance_reviews 
  DROP CONSTRAINT IF EXISTS check_overall_rating_range;
ALTER TABLE public.performance_reviews 
  ADD CONSTRAINT check_overall_rating_range CHECK (overall_rating IS NULL OR (overall_rating >= 1 AND overall_rating <= 5));

-- Ensure positive pay amounts
ALTER TABLE public.payroll_entries 
  DROP CONSTRAINT IF EXISTS check_positive_pay;
ALTER TABLE public.payroll_entries 
  ADD CONSTRAINT check_positive_pay CHECK (base_salary >= 0 AND gross_pay >= 0 AND net_pay >= 0);

-- Ensure valid leave dates
ALTER TABLE public.leave_requests 
  DROP CONSTRAINT IF EXISTS check_leave_dates;
ALTER TABLE public.leave_requests 
  ADD CONSTRAINT check_leave_dates CHECK (end_date >= start_date);

-- Ensure valid review period
ALTER TABLE public.performance_reviews 
  DROP CONSTRAINT IF EXISTS check_review_period;
ALTER TABLE public.performance_reviews 
  ADD CONSTRAINT check_review_period CHECK (review_period_end >= review_period_start);

-- Ensure valid payroll period
ALTER TABLE public.payroll_runs 
  DROP CONSTRAINT IF EXISTS check_payroll_period;
ALTER TABLE public.payroll_runs 
  ADD CONSTRAINT check_payroll_period CHECK (period_end >= period_start);

-- ============================================
-- Optimize RPC functions
-- ============================================

-- Add index hints for commonly used functions
COMMENT ON FUNCTION public.is_active_company_member IS 'Uses idx_company_users_active index';
COMMENT ON FUNCTION public.is_active_company_admin IS 'Uses idx_company_users_role index';
COMMENT ON FUNCTION public.company_has_module IS 'Uses idx_company_subscriptions_company_id index';