-- =============================================
-- PHASE 1: CORE ENHANCEMENTS MIGRATION (Fixed)
-- =============================================

-- 1. Leave Approval Configuration (per company)
CREATE TABLE IF NOT EXISTS public.leave_approval_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  approval_chain TEXT[] NOT NULL DEFAULT ARRAY['manager', 'hr']::TEXT[],
  hr_self_approval_enabled BOOLEAN DEFAULT false,
  manager_self_approval_enabled BOOLEAN DEFAULT false,
  auto_approve_if_no_manager BOOLEAN DEFAULT false,
  skip_hr_for_less_than_days INTEGER DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id)
);

-- 2. Leave Request Days (row-based daily selection)
CREATE TABLE IF NOT EXISTS public.leave_request_days (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  leave_request_id UUID NOT NULL REFERENCES leave_requests(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  day_type TEXT NOT NULL DEFAULT 'full' CHECK (day_type IN ('full', 'first_half', 'second_half')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(leave_request_id, date)
);

-- 3. Leave Approval History (multi-level approval tracking)
CREATE TABLE IF NOT EXISTS public.leave_approval_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  leave_request_id UUID NOT NULL REFERENCES leave_requests(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  approver_id UUID REFERENCES employees(id) ON DELETE SET NULL,
  approver_role TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('approved', 'rejected', 'requested_clarification', 'forwarded')),
  comments TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Add approval workflow columns to leave_requests
ALTER TABLE public.leave_requests 
  ADD COLUMN IF NOT EXISTS current_approval_level INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS approval_status JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS requires_hr_approval BOOLEAN DEFAULT true;

-- 5. Time Correction Requests (separate from time entries)
CREATE TABLE IF NOT EXISTS public.time_correction_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  original_entry_id UUID REFERENCES time_entries(id) ON DELETE SET NULL,
  correction_date DATE NOT NULL,
  requested_clock_in TIMESTAMPTZ,
  requested_clock_out TIMESTAMPTZ,
  requested_break_minutes INTEGER DEFAULT 0,
  reason TEXT NOT NULL,
  supporting_document_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'clarification_needed')),
  reviewed_by UUID REFERENCES employees(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. Add original values tracking to time_entries
ALTER TABLE public.time_entries
  ADD COLUMN IF NOT EXISTS is_corrected BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS correction_id UUID REFERENCES time_correction_requests(id),
  ADD COLUMN IF NOT EXISTS original_clock_in TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS original_clock_out TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS corrected_by UUID REFERENCES employees(id),
  ADD COLUMN IF NOT EXISTS corrected_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS correction_reason TEXT;

-- 7. Bulk Attendance Import
CREATE TABLE IF NOT EXISTS public.attendance_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  imported_by UUID REFERENCES employees(id) ON DELETE SET NULL,
  file_name TEXT NOT NULL,
  file_url TEXT,
  total_records INTEGER DEFAULT 0,
  processed_records INTEGER DEFAULT 0,
  failed_records INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  error_log JSONB DEFAULT '[]'::jsonb,
  mapping_config JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- 8. Document Type Restrictions
ALTER TABLE public.document_types
  ADD COLUMN IF NOT EXISTS allowed_for_employee_upload BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS allowed_mime_types TEXT[] DEFAULT ARRAY['application/pdf', 'image/jpeg', 'image/png']::TEXT[],
  ADD COLUMN IF NOT EXISTS max_file_size_mb INTEGER DEFAULT 10;

-- 9. Candidate Portal Auth Configuration
CREATE TABLE IF NOT EXISTS public.candidate_auth_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE UNIQUE,
  auth_enabled BOOLEAN DEFAULT true,
  auth_methods TEXT[] DEFAULT ARRAY['email']::TEXT[],
  require_login_to_apply BOOLEAN DEFAULT true,
  social_login_enabled BOOLEAN DEFAULT false,
  google_enabled BOOLEAN DEFAULT false,
  linkedin_enabled BOOLEAN DEFAULT false,
  magic_link_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 10. Candidate Users (separate from company users)
CREATE TABLE IF NOT EXISTS public.candidate_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  email TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  phone TEXT,
  linkedin_url TEXT,
  resume_url TEXT,
  profile_data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(email)
);

-- 11. Link candidates to candidate users
ALTER TABLE public.candidates
  ADD COLUMN IF NOT EXISTS candidate_user_id UUID REFERENCES candidate_users(id) ON DELETE SET NULL;

-- 12. Job Application Custom Fields
CREATE TABLE IF NOT EXISTS public.job_custom_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  field_name TEXT NOT NULL,
  field_type TEXT NOT NULL CHECK (field_type IN ('text', 'textarea', 'select', 'multiselect', 'number', 'date', 'file', 'checkbox')),
  field_label TEXT NOT NULL,
  placeholder TEXT,
  options JSONB DEFAULT '[]'::jsonb,
  is_required BOOLEAN DEFAULT false,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 13. Performance Review States
ALTER TABLE public.performance_reviews
  ADD COLUMN IF NOT EXISTS lifecycle_state TEXT DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS self_review_completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS manager_review_completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS acknowledged_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS acknowledged_by UUID REFERENCES employees(id);

-- 14. Goals table (create if not exists)
CREATE TABLE IF NOT EXISTS public.goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  target_date DATE,
  progress_percentage INTEGER DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
  status TEXT DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'at_risk', 'completed', 'cancelled')),
  progress_notes JSONB DEFAULT '[]'::jsonb,
  last_progress_update TIMESTAMPTZ,
  review_id UUID REFERENCES performance_reviews(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================
-- RLS POLICIES
-- =============================================

-- Leave Approval Config RLS
ALTER TABLE public.leave_approval_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "leave_approval_config_select_member" ON public.leave_approval_config
  FOR SELECT USING (is_active_company_member(auth.uid(), company_id));

CREATE POLICY "leave_approval_config_insert_admin" ON public.leave_approval_config
  FOR INSERT WITH CHECK (is_active_company_admin(auth.uid(), company_id));

CREATE POLICY "leave_approval_config_update_admin" ON public.leave_approval_config
  FOR UPDATE USING (is_active_company_admin(auth.uid(), company_id));

CREATE POLICY "leave_approval_config_delete_admin" ON public.leave_approval_config
  FOR DELETE USING (is_active_company_admin(auth.uid(), company_id));

-- Leave Request Days RLS
ALTER TABLE public.leave_request_days ENABLE ROW LEVEL SECURITY;

CREATE POLICY "leave_request_days_select_member" ON public.leave_request_days
  FOR SELECT USING (is_active_company_member(auth.uid(), company_id));

CREATE POLICY "leave_request_days_insert_member" ON public.leave_request_days
  FOR INSERT WITH CHECK (is_active_company_member(auth.uid(), company_id) AND is_company_active(company_id));

CREATE POLICY "leave_request_days_delete_hr" ON public.leave_request_days
  FOR DELETE USING (is_active_hr_or_above(auth.uid(), company_id));

-- Leave Approval History RLS
ALTER TABLE public.leave_approval_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "leave_approval_history_select_member" ON public.leave_approval_history
  FOR SELECT USING (is_active_company_member(auth.uid(), company_id));

CREATE POLICY "leave_approval_history_insert_member" ON public.leave_approval_history
  FOR INSERT WITH CHECK (is_active_company_member(auth.uid(), company_id));

-- Time Correction Requests RLS
ALTER TABLE public.time_correction_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "time_correction_select_own" ON public.time_correction_requests
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM employees WHERE id = employee_id AND user_id = auth.uid())
  );

CREATE POLICY "time_correction_select_hr" ON public.time_correction_requests
  FOR SELECT USING (is_active_hr_or_above(auth.uid(), company_id));

CREATE POLICY "time_correction_insert_own" ON public.time_correction_requests
  FOR INSERT WITH CHECK (
    is_company_active(company_id) AND
    EXISTS (SELECT 1 FROM employees WHERE id = employee_id AND user_id = auth.uid())
  );

CREATE POLICY "time_correction_update_hr" ON public.time_correction_requests
  FOR UPDATE USING (is_active_hr_or_above(auth.uid(), company_id));

CREATE POLICY "time_correction_delete_hr" ON public.time_correction_requests
  FOR DELETE USING (is_active_hr_or_above(auth.uid(), company_id));

-- Attendance Imports RLS
ALTER TABLE public.attendance_imports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "attendance_imports_select_hr" ON public.attendance_imports
  FOR SELECT USING (is_active_hr_or_above(auth.uid(), company_id));

CREATE POLICY "attendance_imports_insert_hr" ON public.attendance_imports
  FOR INSERT WITH CHECK (is_active_hr_or_above(auth.uid(), company_id) AND is_company_active(company_id));

CREATE POLICY "attendance_imports_update_hr" ON public.attendance_imports
  FOR UPDATE USING (is_active_hr_or_above(auth.uid(), company_id));

-- Candidate Auth Config RLS
ALTER TABLE public.candidate_auth_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "candidate_auth_config_select_public" ON public.candidate_auth_config
  FOR SELECT USING (true);

CREATE POLICY "candidate_auth_config_insert_admin" ON public.candidate_auth_config
  FOR INSERT WITH CHECK (is_active_company_admin(auth.uid(), company_id));

CREATE POLICY "candidate_auth_config_update_admin" ON public.candidate_auth_config
  FOR UPDATE USING (is_active_company_admin(auth.uid(), company_id));

-- Candidate Users RLS
ALTER TABLE public.candidate_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "candidate_users_select_own" ON public.candidate_users
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "candidate_users_insert_own" ON public.candidate_users
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "candidate_users_update_own" ON public.candidate_users
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "candidate_users_select_hr" ON public.candidate_users
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM candidates c
      JOIN company_users cu ON cu.company_id = c.company_id
      WHERE c.candidate_user_id = candidate_users.id
      AND cu.user_id = auth.uid()
      AND is_active_hr_or_above(auth.uid(), c.company_id)
    )
  );

-- Job Custom Fields RLS
ALTER TABLE public.job_custom_fields ENABLE ROW LEVEL SECURITY;

CREATE POLICY "job_custom_fields_select_public" ON public.job_custom_fields
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM jobs WHERE id = job_id AND status = 'open')
    OR can_use_recruitment(auth.uid(), company_id)
  );

CREATE POLICY "job_custom_fields_insert_hr" ON public.job_custom_fields
  FOR INSERT WITH CHECK (can_use_recruitment(auth.uid(), company_id));

CREATE POLICY "job_custom_fields_update_hr" ON public.job_custom_fields
  FOR UPDATE USING (can_use_recruitment(auth.uid(), company_id));

CREATE POLICY "job_custom_fields_delete_hr" ON public.job_custom_fields
  FOR DELETE USING (can_use_recruitment(auth.uid(), company_id));

-- Goals RLS
ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "goals_select_own" ON public.goals
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM employees WHERE id = employee_id AND user_id = auth.uid())
  );

CREATE POLICY "goals_select_hr" ON public.goals
  FOR SELECT USING (is_active_hr_or_above(auth.uid(), company_id));

CREATE POLICY "goals_select_manager" ON public.goals
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM employees e 
      WHERE e.id = goals.employee_id 
      AND EXISTS (SELECT 1 FROM employees mgr WHERE mgr.id = e.manager_id AND mgr.user_id = auth.uid())
    )
  );

CREATE POLICY "goals_insert_member" ON public.goals
  FOR INSERT WITH CHECK (
    is_company_active(company_id) AND
    (is_active_hr_or_above(auth.uid(), company_id) OR EXISTS (SELECT 1 FROM employees WHERE id = employee_id AND user_id = auth.uid()))
  );

CREATE POLICY "goals_update_member" ON public.goals
  FOR UPDATE USING (
    is_active_hr_or_above(auth.uid(), company_id) OR EXISTS (SELECT 1 FROM employees WHERE id = employee_id AND user_id = auth.uid())
  );

CREATE POLICY "goals_delete_hr" ON public.goals
  FOR DELETE USING (is_active_hr_or_above(auth.uid(), company_id));

-- =============================================
-- FIX EXPENSE CATEGORIES RLS (allow HR/Admin to create)
-- =============================================

DROP POLICY IF EXISTS expense_categories_insert_admin ON public.expense_categories;
DROP POLICY IF EXISTS expense_categories_insert_hr ON public.expense_categories;

CREATE POLICY "expense_categories_insert_hr" ON public.expense_categories
  FOR INSERT WITH CHECK (is_active_hr_or_above(auth.uid(), company_id) AND is_company_active(company_id));

-- =============================================
-- TRIGGER FOR UPDATED_AT
-- =============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers
DROP TRIGGER IF EXISTS update_leave_approval_config_updated_at ON leave_approval_config;
CREATE TRIGGER update_leave_approval_config_updated_at
  BEFORE UPDATE ON leave_approval_config
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_time_correction_requests_updated_at ON time_correction_requests;
CREATE TRIGGER update_time_correction_requests_updated_at
  BEFORE UPDATE ON time_correction_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_candidate_auth_config_updated_at ON candidate_auth_config;
CREATE TRIGGER update_candidate_auth_config_updated_at
  BEFORE UPDATE ON candidate_auth_config
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_candidate_users_updated_at ON candidate_users;
CREATE TRIGGER update_candidate_users_updated_at
  BEFORE UPDATE ON candidate_users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_goals_updated_at ON goals;
CREATE TRIGGER update_goals_updated_at
  BEFORE UPDATE ON goals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- INDEXES FOR PERFORMANCE
-- =============================================

CREATE INDEX IF NOT EXISTS idx_leave_request_days_request ON leave_request_days(leave_request_id);
CREATE INDEX IF NOT EXISTS idx_leave_request_days_date ON leave_request_days(date);
CREATE INDEX IF NOT EXISTS idx_leave_approval_history_request ON leave_approval_history(leave_request_id);
CREATE INDEX IF NOT EXISTS idx_time_correction_requests_employee ON time_correction_requests(employee_id);
CREATE INDEX IF NOT EXISTS idx_time_correction_requests_status ON time_correction_requests(status);
CREATE INDEX IF NOT EXISTS idx_job_custom_fields_job ON job_custom_fields(job_id);
CREATE INDEX IF NOT EXISTS idx_candidates_user ON candidates(candidate_user_id);
CREATE INDEX IF NOT EXISTS idx_goals_employee ON goals(employee_id);
CREATE INDEX IF NOT EXISTS idx_goals_status ON goals(status);