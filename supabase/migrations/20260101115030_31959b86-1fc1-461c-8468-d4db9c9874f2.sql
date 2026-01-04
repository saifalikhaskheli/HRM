-- =====================================================
-- ADVANCED PERMISSION SYSTEM
-- Extension of existing role-based access control
-- =====================================================

-- Create permission action enum
CREATE TYPE public.permission_action AS ENUM (
    'read',
    'create',
    'update',
    'delete',
    'approve',
    'process',
    'verify',
    'export',
    'manage'
);

-- Create permission module enum (mirrors existing modules)
CREATE TYPE public.permission_module AS ENUM (
    'dashboard',
    'employees',
    'departments',
    'leave',
    'time_tracking',
    'documents',
    'recruitment',
    'performance',
    'payroll',
    'expenses',
    'compliance',
    'audit',
    'integrations',
    'settings',
    'users'
);

-- =====================================================
-- PERMISSIONS TABLE - Defines all available permissions
-- =====================================================
CREATE TABLE public.permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    module permission_module NOT NULL,
    action permission_action NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(module, action)
);

-- Insert all module permissions
INSERT INTO public.permissions (module, action, name, description) VALUES
-- Dashboard
('dashboard', 'read', 'View Dashboard', 'Access personal dashboard'),

-- Employees
('employees', 'read', 'View Employees', 'View employee records'),
('employees', 'create', 'Create Employees', 'Add new employees'),
('employees', 'update', 'Update Employees', 'Edit employee information'),
('employees', 'delete', 'Delete Employees', 'Remove employee records'),
('employees', 'export', 'Export Employees', 'Export employee data'),

-- Departments
('departments', 'read', 'View Departments', 'View department structure'),
('departments', 'create', 'Create Departments', 'Add new departments'),
('departments', 'update', 'Update Departments', 'Edit department info'),
('departments', 'delete', 'Delete Departments', 'Remove departments'),

-- Leave
('leave', 'read', 'View Leave', 'View leave requests'),
('leave', 'create', 'Request Leave', 'Submit leave requests'),
('leave', 'update', 'Update Leave', 'Modify leave requests'),
('leave', 'delete', 'Cancel Leave', 'Cancel leave requests'),
('leave', 'approve', 'Approve Leave', 'Approve/reject leave requests'),

-- Time Tracking
('time_tracking', 'read', 'View Time', 'View time entries'),
('time_tracking', 'create', 'Clock In/Out', 'Create time entries'),
('time_tracking', 'update', 'Update Time', 'Edit time entries'),
('time_tracking', 'delete', 'Delete Time', 'Remove time entries'),
('time_tracking', 'approve', 'Approve Time', 'Approve time corrections'),

-- Documents
('documents', 'read', 'View Documents', 'View employee documents'),
('documents', 'create', 'Upload Documents', 'Upload new documents'),
('documents', 'update', 'Update Documents', 'Edit document info'),
('documents', 'delete', 'Delete Documents', 'Remove documents'),
('documents', 'verify', 'Verify Documents', 'Verify document authenticity'),

-- Recruitment
('recruitment', 'read', 'View Recruitment', 'View jobs and candidates'),
('recruitment', 'create', 'Create Jobs', 'Post new job openings'),
('recruitment', 'update', 'Update Recruitment', 'Edit jobs and candidates'),
('recruitment', 'delete', 'Delete Recruitment', 'Remove jobs and candidates'),
('recruitment', 'approve', 'Manage Offers', 'Create and send offers'),

-- Performance
('performance', 'read', 'View Performance', 'View performance reviews'),
('performance', 'create', 'Create Reviews', 'Create performance reviews'),
('performance', 'update', 'Update Reviews', 'Edit performance reviews'),
('performance', 'delete', 'Delete Reviews', 'Remove performance reviews'),
('performance', 'approve', 'Finalize Reviews', 'Complete performance reviews'),

-- Payroll
('payroll', 'read', 'View Payroll', 'View payroll runs'),
('payroll', 'create', 'Create Payroll', 'Create payroll runs'),
('payroll', 'update', 'Update Payroll', 'Edit payroll entries'),
('payroll', 'delete', 'Delete Payroll', 'Remove payroll runs'),
('payroll', 'process', 'Process Payroll', 'Run and finalize payroll'),
('payroll', 'approve', 'Approve Payroll', 'Approve payroll for processing'),

-- Expenses
('expenses', 'read', 'View Expenses', 'View expense claims'),
('expenses', 'create', 'Submit Expenses', 'Submit expense claims'),
('expenses', 'update', 'Update Expenses', 'Edit expense claims'),
('expenses', 'delete', 'Delete Expenses', 'Remove expense claims'),
('expenses', 'approve', 'Approve Expenses', 'Approve/reject expenses'),

-- Compliance
('compliance', 'read', 'View Compliance', 'View compliance status'),
('compliance', 'manage', 'Manage Compliance', 'Configure compliance settings'),

-- Audit
('audit', 'read', 'View Audit Logs', 'Access audit trails'),
('audit', 'export', 'Export Audit Logs', 'Export audit data'),

-- Integrations
('integrations', 'read', 'View Integrations', 'View connected services'),
('integrations', 'manage', 'Manage Integrations', 'Configure integrations'),

-- Settings
('settings', 'read', 'View Settings', 'View company settings'),
('settings', 'update', 'Update Settings', 'Modify company settings'),

-- Users
('users', 'read', 'View Users', 'View user accounts'),
('users', 'create', 'Invite Users', 'Invite new users'),
('users', 'update', 'Update Users', 'Edit user roles and permissions'),
('users', 'delete', 'Remove Users', 'Remove user access');

-- =====================================================
-- ROLE PERMISSIONS - Default permissions per role
-- =====================================================
CREATE TABLE public.role_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    role app_role NOT NULL,
    permission_id UUID NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID REFERENCES auth.users(id),
    UNIQUE(company_id, role, permission_id)
);

-- =====================================================
-- USER PERMISSIONS - Explicit overrides per user
-- =====================================================
CREATE TABLE public.user_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    permission_id UUID NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
    granted BOOLEAN NOT NULL DEFAULT true, -- true = allow, false = deny
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID REFERENCES auth.users(id),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(company_id, user_id, permission_id)
);

-- Add indexes for performance
CREATE INDEX idx_role_permissions_company ON public.role_permissions(company_id);
CREATE INDEX idx_role_permissions_role ON public.role_permissions(role);
CREATE INDEX idx_user_permissions_company ON public.user_permissions(company_id);
CREATE INDEX idx_user_permissions_user ON public.user_permissions(user_id);

-- =====================================================
-- PERMISSION RESOLUTION FUNCTION
-- Priority: Explicit user permission > Role permission > Deny
-- =====================================================
CREATE OR REPLACE FUNCTION public.has_permission(
    _user_id UUID,
    _company_id UUID,
    _module permission_module,
    _action permission_action
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    _permission_id UUID;
    _explicit_grant BOOLEAN;
    _role app_role;
    _has_role_permission BOOLEAN;
BEGIN
    -- Get permission ID
    SELECT id INTO _permission_id
    FROM public.permissions
    WHERE module = _module AND action = _action;
    
    IF _permission_id IS NULL THEN
        RETURN false;
    END IF;
    
    -- Check for explicit user permission (highest priority)
    SELECT granted INTO _explicit_grant
    FROM public.user_permissions
    WHERE user_id = _user_id
      AND company_id = _company_id
      AND permission_id = _permission_id;
    
    -- If explicit permission exists, return it
    IF _explicit_grant IS NOT NULL THEN
        RETURN _explicit_grant;
    END IF;
    
    -- Get user's role
    SELECT role INTO _role
    FROM public.company_users
    WHERE user_id = _user_id
      AND company_id = _company_id
      AND is_active = true;
    
    IF _role IS NULL THEN
        RETURN false;
    END IF;
    
    -- Super admin has all permissions
    IF _role = 'super_admin' THEN
        RETURN true;
    END IF;
    
    -- Check role permission
    SELECT EXISTS (
        SELECT 1
        FROM public.role_permissions
        WHERE company_id = _company_id
          AND role = _role
          AND permission_id = _permission_id
    ) INTO _has_role_permission;
    
    RETURN _has_role_permission;
END;
$$;

-- =====================================================
-- GET USER PERMISSIONS FUNCTION
-- Returns all permissions for a user with source info
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_user_permissions(_user_id UUID, _company_id UUID)
RETURNS TABLE (
    permission_id UUID,
    module permission_module,
    action permission_action,
    name TEXT,
    has_permission BOOLEAN,
    source TEXT -- 'explicit_allow', 'explicit_deny', 'role', 'super_admin', 'none'
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    _role app_role;
BEGIN
    -- Get user's role
    SELECT role INTO _role
    FROM public.company_users
    WHERE user_id = _user_id
      AND company_id = _company_id
      AND is_active = true;
    
    RETURN QUERY
    SELECT 
        p.id as permission_id,
        p.module,
        p.action,
        p.name,
        CASE 
            -- Super admin gets everything
            WHEN _role = 'super_admin' THEN true
            -- Explicit user permission takes priority
            WHEN up.granted IS NOT NULL THEN up.granted
            -- Check role permission
            WHEN rp.id IS NOT NULL THEN true
            -- Default deny
            ELSE false
        END as has_permission,
        CASE 
            WHEN _role = 'super_admin' THEN 'super_admin'
            WHEN up.granted = true THEN 'explicit_allow'
            WHEN up.granted = false THEN 'explicit_deny'
            WHEN rp.id IS NOT NULL THEN 'role'
            ELSE 'none'
        END as source
    FROM public.permissions p
    LEFT JOIN public.user_permissions up 
        ON up.permission_id = p.id 
        AND up.user_id = _user_id 
        AND up.company_id = _company_id
    LEFT JOIN public.role_permissions rp 
        ON rp.permission_id = p.id 
        AND rp.role = _role 
        AND rp.company_id = _company_id
    ORDER BY p.module, p.action;
END;
$$;

-- =====================================================
-- GET ROLE DEFAULT PERMISSIONS
-- Returns configured permissions for a role
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_role_permissions(_company_id UUID, _role app_role)
RETURNS TABLE (
    permission_id UUID,
    module permission_module,
    action permission_action,
    name TEXT,
    is_granted BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT 
        p.id as permission_id,
        p.module,
        p.action,
        p.name,
        rp.id IS NOT NULL as is_granted
    FROM public.permissions p
    LEFT JOIN public.role_permissions rp 
        ON rp.permission_id = p.id 
        AND rp.role = _role 
        AND rp.company_id = _company_id
    ORDER BY p.module, p.action;
$$;

-- =====================================================
-- SET ROLE PERMISSION
-- =====================================================
CREATE OR REPLACE FUNCTION public.set_role_permission(
    _company_id UUID,
    _role app_role,
    _module permission_module,
    _action permission_action,
    _grant BOOLEAN
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    _permission_id UUID;
BEGIN
    -- Check caller has permission to manage users
    IF NOT public.is_active_company_admin(auth.uid(), _company_id) THEN
        RAISE EXCEPTION 'Not authorized to manage permissions';
    END IF;
    
    -- Prevent modifying super_admin permissions
    IF _role = 'super_admin' THEN
        RAISE EXCEPTION 'Cannot modify super_admin permissions';
    END IF;
    
    -- Get permission ID
    SELECT id INTO _permission_id
    FROM public.permissions
    WHERE module = _module AND action = _action;
    
    IF _permission_id IS NULL THEN
        RAISE EXCEPTION 'Invalid permission';
    END IF;
    
    IF _grant THEN
        -- Grant permission
        INSERT INTO public.role_permissions (company_id, role, permission_id, created_by)
        VALUES (_company_id, _role, _permission_id, auth.uid())
        ON CONFLICT (company_id, role, permission_id) DO NOTHING;
    ELSE
        -- Revoke permission
        DELETE FROM public.role_permissions
        WHERE company_id = _company_id
          AND role = _role
          AND permission_id = _permission_id;
    END IF;
    
    RETURN true;
END;
$$;

-- =====================================================
-- SET USER PERMISSION OVERRIDE
-- =====================================================
CREATE OR REPLACE FUNCTION public.set_user_permission(
    _company_id UUID,
    _target_user_id UUID,
    _module permission_module,
    _action permission_action,
    _granted BOOLEAN -- NULL to remove override
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    _permission_id UUID;
    _target_role app_role;
    _caller_role app_role;
BEGIN
    -- Check caller has permission to manage users
    IF NOT public.is_active_company_admin(auth.uid(), _company_id) THEN
        RAISE EXCEPTION 'Not authorized to manage permissions';
    END IF;
    
    -- Get target user's role
    SELECT role INTO _target_role
    FROM public.company_users
    WHERE user_id = _target_user_id
      AND company_id = _company_id
      AND is_active = true;
    
    IF _target_role IS NULL THEN
        RAISE EXCEPTION 'Target user not found in company';
    END IF;
    
    -- Prevent modifying super_admin permissions
    IF _target_role = 'super_admin' THEN
        RAISE EXCEPTION 'Cannot modify super_admin permissions';
    END IF;
    
    -- Prevent last admin lockout for users:update permission
    IF _module = 'users' AND _action = 'update' AND _granted = false THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.company_users cu
            WHERE cu.company_id = _company_id
              AND cu.user_id != _target_user_id
              AND cu.role IN ('super_admin', 'company_admin')
              AND cu.is_active = true
        ) THEN
            RAISE EXCEPTION 'Cannot remove user management permission from last admin';
        END IF;
    END IF;
    
    -- Get permission ID
    SELECT id INTO _permission_id
    FROM public.permissions
    WHERE module = _module AND action = _action;
    
    IF _permission_id IS NULL THEN
        RAISE EXCEPTION 'Invalid permission';
    END IF;
    
    IF _granted IS NULL THEN
        -- Remove override
        DELETE FROM public.user_permissions
        WHERE company_id = _company_id
          AND user_id = _target_user_id
          AND permission_id = _permission_id;
    ELSE
        -- Set override
        INSERT INTO public.user_permissions (company_id, user_id, permission_id, granted, created_by)
        VALUES (_company_id, _target_user_id, _permission_id, _granted, auth.uid())
        ON CONFLICT (company_id, user_id, permission_id) 
        DO UPDATE SET granted = _granted, updated_at = now();
    END IF;
    
    RETURN true;
END;
$$;

-- =====================================================
-- INITIALIZE DEFAULT ROLE PERMISSIONS FOR A COMPANY
-- =====================================================
CREATE OR REPLACE FUNCTION public.initialize_company_permissions(_company_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Company Admin gets most permissions
    INSERT INTO public.role_permissions (company_id, role, permission_id)
    SELECT _company_id, 'company_admin', id
    FROM public.permissions
    WHERE NOT (module = 'compliance' AND action = 'manage') -- Reserve some for super_admin
    ON CONFLICT DO NOTHING;
    
    -- HR Manager permissions
    INSERT INTO public.role_permissions (company_id, role, permission_id)
    SELECT _company_id, 'hr_manager', id
    FROM public.permissions
    WHERE module IN ('dashboard', 'employees', 'departments', 'leave', 'time_tracking', 
                     'documents', 'recruitment', 'performance', 'expenses')
      AND action IN ('read', 'create', 'update', 'approve', 'verify')
    ON CONFLICT DO NOTHING;
    
    -- Manager permissions
    INSERT INTO public.role_permissions (company_id, role, permission_id)
    SELECT _company_id, 'manager', id
    FROM public.permissions
    WHERE (module IN ('dashboard', 'employees', 'departments') AND action = 'read')
       OR (module IN ('leave', 'time_tracking', 'expenses') AND action IN ('read', 'approve'))
       OR (module = 'performance' AND action IN ('read', 'create', 'update'))
    ON CONFLICT DO NOTHING;
    
    -- Employee permissions
    INSERT INTO public.role_permissions (company_id, role, permission_id)
    SELECT _company_id, 'employee', id
    FROM public.permissions
    WHERE (module = 'dashboard' AND action = 'read')
       OR (module = 'employees' AND action = 'read')
       OR (module = 'departments' AND action = 'read')
       OR (module = 'leave' AND action IN ('read', 'create', 'update', 'delete'))
       OR (module = 'time_tracking' AND action IN ('read', 'create'))
       OR (module = 'documents' AND action = 'read')
       OR (module = 'expenses' AND action IN ('read', 'create', 'update', 'delete'))
       OR (module = 'performance' AND action = 'read')
    ON CONFLICT DO NOTHING;
END;
$$;

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

-- Enable RLS on new tables
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;

-- Permissions table is readable by all authenticated users
CREATE POLICY "permissions_select" ON public.permissions
FOR SELECT TO authenticated
USING (true);

-- Role permissions - readable by company members, writable by admins
CREATE POLICY "role_permissions_select" ON public.role_permissions
FOR SELECT TO authenticated
USING (public.is_active_company_member(auth.uid(), company_id));

CREATE POLICY "role_permissions_insert" ON public.role_permissions
FOR INSERT TO authenticated
WITH CHECK (public.is_active_company_admin(auth.uid(), company_id));

CREATE POLICY "role_permissions_update" ON public.role_permissions
FOR UPDATE TO authenticated
USING (public.is_active_company_admin(auth.uid(), company_id));

CREATE POLICY "role_permissions_delete" ON public.role_permissions
FOR DELETE TO authenticated
USING (public.is_active_company_admin(auth.uid(), company_id));

-- User permissions - readable by company members, writable by admins
CREATE POLICY "user_permissions_select" ON public.user_permissions
FOR SELECT TO authenticated
USING (public.is_active_company_member(auth.uid(), company_id));

CREATE POLICY "user_permissions_insert" ON public.user_permissions
FOR INSERT TO authenticated
WITH CHECK (public.is_active_company_admin(auth.uid(), company_id));

CREATE POLICY "user_permissions_update" ON public.user_permissions
FOR UPDATE TO authenticated
USING (public.is_active_company_admin(auth.uid(), company_id));

CREATE POLICY "user_permissions_delete" ON public.user_permissions
FOR DELETE TO authenticated
USING (public.is_active_company_admin(auth.uid(), company_id));

-- =====================================================
-- AUDIT LOG TRIGGER FOR PERMISSION CHANGES
-- =====================================================
CREATE OR REPLACE FUNCTION public.audit_permission_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO public.audit_logs (
            company_id,
            user_id,
            action,
            table_name,
            record_id,
            new_values
        ) VALUES (
            NEW.company_id,
            auth.uid(),
            'create',
            TG_TABLE_NAME,
            NEW.id::text,
            to_jsonb(NEW)
        );
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO public.audit_logs (
            company_id,
            user_id,
            action,
            table_name,
            record_id,
            old_values,
            new_values
        ) VALUES (
            NEW.company_id,
            auth.uid(),
            'update',
            TG_TABLE_NAME,
            NEW.id::text,
            to_jsonb(OLD),
            to_jsonb(NEW)
        );
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO public.audit_logs (
            company_id,
            user_id,
            action,
            table_name,
            record_id,
            old_values
        ) VALUES (
            OLD.company_id,
            auth.uid(),
            'delete',
            TG_TABLE_NAME,
            OLD.id::text,
            to_jsonb(OLD)
        );
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$;

CREATE TRIGGER audit_role_permissions_changes
AFTER INSERT OR UPDATE OR DELETE ON public.role_permissions
FOR EACH ROW EXECUTE FUNCTION public.audit_permission_change();

CREATE TRIGGER audit_user_permissions_changes
AFTER INSERT OR UPDATE OR DELETE ON public.user_permissions
FOR EACH ROW EXECUTE FUNCTION public.audit_permission_change();