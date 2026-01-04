-- =============================================
-- COMPREHENSIVE MIGRATION: Role Templates, Avatars, Email Templates, Link User to Employee
-- =============================================

-- 1. ROLE TEMPLATES TABLE (platform-defined roles that companies can adopt)
CREATE TABLE public.role_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  display_name text NOT NULL,
  description text,
  base_role public.app_role NOT NULL,
  is_system boolean DEFAULT true,
  plan_tier text DEFAULT 'basic',
  permissions_config jsonb DEFAULT '{}'::jsonb,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS on role_templates
ALTER TABLE public.role_templates ENABLE ROW LEVEL SECURITY;

-- Platform admins can manage, all authenticated can read
CREATE POLICY "role_templates_select_authenticated" ON public.role_templates
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "role_templates_insert_platform" ON public.role_templates
  FOR INSERT WITH CHECK (is_platform_admin(auth.uid()));

CREATE POLICY "role_templates_update_platform" ON public.role_templates
  FOR UPDATE USING (is_platform_admin(auth.uid()));

CREATE POLICY "role_templates_delete_platform" ON public.role_templates
  FOR DELETE USING (is_platform_admin(auth.uid()) AND NOT is_system);

-- 2. COMPANY ROLES TABLE (templates adopted by companies with customizations)
CREATE TABLE public.company_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  template_id uuid REFERENCES public.role_templates(id) ON DELETE SET NULL,
  custom_name text,
  description text,
  permission_overrides jsonb DEFAULT '{}'::jsonb,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(company_id, template_id)
);

-- Enable RLS on company_roles
ALTER TABLE public.company_roles ENABLE ROW LEVEL SECURITY;

-- Company members can read, admins can manage
CREATE POLICY "company_roles_select_member" ON public.company_roles
  FOR SELECT USING (is_active_company_member(auth.uid(), company_id));

CREATE POLICY "company_roles_insert_admin" ON public.company_roles
  FOR INSERT WITH CHECK (is_active_company_admin(auth.uid(), company_id) AND is_company_active(company_id));

CREATE POLICY "company_roles_update_admin" ON public.company_roles
  FOR UPDATE USING (is_active_company_admin(auth.uid(), company_id))
  WITH CHECK (is_company_active(company_id));

CREATE POLICY "company_roles_delete_admin" ON public.company_roles
  FOR DELETE USING (is_active_company_admin(auth.uid(), company_id));

-- 3. PRE-POPULATE ROLE TEMPLATES
INSERT INTO public.role_templates (name, display_name, description, base_role, is_system, plan_tier, sort_order, permissions_config) VALUES
  ('finance_manager', 'Finance Manager', 'Manages payroll, expenses, and financial reports', 'hr_manager', true, 'basic', 1, '{"payroll": {"read": true, "create": true, "update": true, "delete": false}, "expenses": {"read": true, "create": true, "update": true, "delete": true}}'),
  ('payroll_officer', 'Payroll Officer', 'Processes payroll and manages compensation', 'hr_manager', true, 'basic', 2, '{"payroll": {"read": true, "create": true, "update": true, "delete": false}}'),
  ('recruiter', 'Recruiter', 'Manages job postings and candidate pipeline', 'hr_manager', true, 'basic', 3, '{"recruitment": {"read": true, "create": true, "update": true, "delete": true}}'),
  ('team_lead', 'Team Lead', 'Leads a team with limited HR access', 'manager', true, 'basic', 4, '{"employees": {"read": true, "create": false, "update": false, "delete": false}, "leave": {"read": true, "create": true, "update": true, "delete": false}}'),
  ('department_head', 'Department Head', 'Manages an entire department', 'manager', true, 'pro', 5, '{"employees": {"read": true, "create": false, "update": true, "delete": false}, "leave": {"read": true, "create": true, "update": true, "delete": true}}'),
  ('shift_supervisor', 'Shift Supervisor', 'Manages shift schedules and attendance', 'manager', true, 'pro', 6, '{"time": {"read": true, "create": true, "update": true, "delete": false}, "shifts": {"read": true, "create": true, "update": true, "delete": false}}'),
  ('hr_assistant', 'HR Assistant', 'Supports HR operations with limited access', 'manager', true, 'pro', 7, '{"employees": {"read": true, "create": true, "update": false, "delete": false}, "documents": {"read": true, "create": true, "update": false, "delete": false}}'),
  ('executive', 'Executive', 'Senior leadership with broad read access', 'manager', true, 'enterprise', 8, '{"employees": {"read": true}, "payroll": {"read": true}, "analytics": {"read": true}}'),
  ('intern', 'Intern', 'Limited access for temporary staff', 'employee', true, 'basic', 9, '{}'),
  ('contractor', 'Contractor', 'External contractor with limited access', 'employee', true, 'basic', 10, '{}');

-- 4. LINK USER TO EMPLOYEE RPC FUNCTION
CREATE OR REPLACE FUNCTION public.link_user_to_employee(
  _user_id uuid,
  _employee_id uuid,
  _company_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _caller_role text;
BEGIN
  -- Check if caller is HR or admin
  SELECT role INTO _caller_role
  FROM company_users
  WHERE user_id = auth.uid() AND company_id = _company_id AND is_active = true;
  
  IF _caller_role NOT IN ('super_admin', 'company_admin', 'hr_manager') THEN
    RAISE EXCEPTION 'Only HR or admin can link users to employees';
  END IF;
  
  -- Check employee exists and is not already linked
  IF NOT EXISTS (
    SELECT 1 FROM employees 
    WHERE id = _employee_id 
    AND company_id = _company_id 
    AND user_id IS NULL
  ) THEN
    RAISE EXCEPTION 'Employee not found or already linked';
  END IF;
  
  -- Check user exists and has company access
  IF NOT EXISTS (
    SELECT 1 FROM company_users 
    WHERE user_id = _user_id AND company_id = _company_id
  ) THEN
    RAISE EXCEPTION 'User not found in company';
  END IF;
  
  -- Link the user to employee
  UPDATE employees 
  SET user_id = _user_id, updated_at = now()
  WHERE id = _employee_id AND company_id = _company_id;
  
  RETURN FOUND;
END;
$$;

-- 5. AVATARS STORAGE BUCKET
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('avatars', 'avatars', true, 2097152, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
ON CONFLICT (id) DO NOTHING;

-- Storage policies for avatars
CREATE POLICY "avatars_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');

CREATE POLICY "avatars_authenticated_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'avatars' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "avatars_owner_update" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'avatars' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "avatars_owner_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'avatars' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- 6. COMPANY EMAIL TEMPLATES TABLE
CREATE TABLE public.company_email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  template_type text NOT NULL,
  display_name text NOT NULL,
  description text,
  is_enabled boolean DEFAULT true,
  sender_email text,
  sender_name text,
  subject_template text,
  html_template text,
  plain_text_template text,
  variables jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(company_id, template_type)
);

-- Enable RLS
ALTER TABLE public.company_email_templates ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "email_templates_select_admin" ON public.company_email_templates
  FOR SELECT USING (is_active_company_admin(auth.uid(), company_id));

CREATE POLICY "email_templates_insert_admin" ON public.company_email_templates
  FOR INSERT WITH CHECK (is_active_company_admin(auth.uid(), company_id));

CREATE POLICY "email_templates_update_admin" ON public.company_email_templates
  FOR UPDATE USING (is_active_company_admin(auth.uid(), company_id))
  WITH CHECK (is_company_active(company_id));

CREATE POLICY "email_templates_delete_admin" ON public.company_email_templates
  FOR DELETE USING (is_active_company_admin(auth.uid(), company_id));

-- 7. ADD AVATAR_URL TO PROFILES IF NOT EXISTS
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'profiles' 
    AND column_name = 'avatar_url'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN avatar_url text;
  END IF;
END $$;

-- 8. RLS POLICY FOR PROFILES TO UPDATE OWN AVATAR
CREATE POLICY "profiles_update_own_avatar" ON public.profiles
  FOR UPDATE USING (id = auth.uid())
  WITH CHECK (id = auth.uid());