
-- =============================================
-- TENANT CONTEXT RESOLUTION FUNCTIONS
-- Secure helper functions for multi-tenant access
-- =============================================

-- =============================================
-- CURRENT USER CONTEXT FUNCTIONS
-- =============================================

-- Get current user's primary company ID
CREATE OR REPLACE FUNCTION public.current_company_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT company_id
    FROM public.company_users
    WHERE user_id = auth.uid()
      AND is_active = true
      AND is_primary = true
    LIMIT 1
$$;

-- Get current user's role in a specific company
CREATE OR REPLACE FUNCTION public.get_user_role(_company_id UUID)
RETURNS public.app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT role
    FROM public.company_users
    WHERE user_id = auth.uid()
      AND company_id = _company_id
      AND is_active = true
    LIMIT 1
$$;

-- Get current user's role in their primary company
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS public.app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT role
    FROM public.company_users
    WHERE user_id = auth.uid()
      AND is_active = true
      AND is_primary = true
    LIMIT 1
$$;

-- Get all companies user belongs to
CREATE OR REPLACE FUNCTION public.get_user_companies()
RETURNS TABLE (
    company_id UUID,
    company_name TEXT,
    company_slug TEXT,
    role public.app_role,
    is_primary BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT 
        c.id as company_id,
        c.name as company_name,
        c.slug as company_slug,
        cu.role,
        cu.is_primary
    FROM public.company_users cu
    JOIN public.companies c ON c.id = cu.company_id
    WHERE cu.user_id = auth.uid()
      AND cu.is_active = true
      AND c.is_active = true
    ORDER BY cu.is_primary DESC, c.name ASC
$$;

-- Get current user's employee record in a company
CREATE OR REPLACE FUNCTION public.get_current_employee(_company_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT id
    FROM public.employees
    WHERE user_id = auth.uid()
      AND company_id = _company_id
    LIMIT 1
$$;

-- Get current user's employee record in their primary company
CREATE OR REPLACE FUNCTION public.current_employee_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT e.id
    FROM public.employees e
    JOIN public.company_users cu ON cu.company_id = e.company_id AND cu.user_id = e.user_id
    WHERE e.user_id = auth.uid()
      AND cu.is_primary = true
      AND cu.is_active = true
    LIMIT 1
$$;

-- =============================================
-- TENANT CONTEXT VALIDATION
-- =============================================

-- Validate user has access to company (prevents cross-tenant)
CREATE OR REPLACE FUNCTION public.validate_tenant_access(_company_id UUID)
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
        WHERE cu.user_id = auth.uid()
          AND cu.company_id = _company_id
          AND cu.is_active = true
          AND c.is_active = true
    )
$$;

-- Set primary company for user (must be member)
CREATE OR REPLACE FUNCTION public.set_primary_company(_company_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Validate access
    IF NOT public.validate_tenant_access(_company_id) THEN
        RETURN false;
    END IF;
    
    -- Clear existing primary
    UPDATE public.company_users
    SET is_primary = false
    WHERE user_id = auth.uid()
      AND is_primary = true;
    
    -- Set new primary
    UPDATE public.company_users
    SET is_primary = true
    WHERE user_id = auth.uid()
      AND company_id = _company_id;
    
    RETURN true;
END;
$$;

-- =============================================
-- COMPANY CREATION WITH AUTO-ADMIN
-- =============================================

-- Create company and make creator the admin
CREATE OR REPLACE FUNCTION public.create_company_with_admin(
    _name TEXT,
    _slug TEXT,
    _industry TEXT DEFAULT NULL,
    _size_range TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    _company_id UUID;
    _user_id UUID;
    _free_plan_id UUID;
BEGIN
    _user_id := auth.uid();
    
    IF _user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;
    
    -- Create company
    INSERT INTO public.companies (name, slug, industry, size_range)
    VALUES (_name, _slug, _industry, _size_range)
    RETURNING id INTO _company_id;
    
    -- Add user as company admin
    INSERT INTO public.company_users (company_id, user_id, role, is_primary, joined_at)
    VALUES (_company_id, _user_id, 'company_admin', true, now());
    
    -- Get free plan
    SELECT id INTO _free_plan_id FROM public.plans WHERE name = 'Free' LIMIT 1;
    
    -- Create subscription on free plan
    IF _free_plan_id IS NOT NULL THEN
        INSERT INTO public.company_subscriptions (
            company_id, 
            plan_id, 
            status, 
            current_period_start,
            current_period_end,
            trial_ends_at
        )
        VALUES (
            _company_id, 
            _free_plan_id, 
            'trialing',
            now(),
            now() + interval '14 days',
            now() + interval '14 days'
        );
    END IF;
    
    RETURN _company_id;
END;
$$;

-- =============================================
-- USER PROFILE CONTEXT
-- =============================================

-- Get full user context (profile + companies + current role)
CREATE OR REPLACE FUNCTION public.get_user_context()
RETURNS JSON
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    _result JSON;
    _user_id UUID;
BEGIN
    _user_id := auth.uid();
    
    IF _user_id IS NULL THEN
        RETURN NULL;
    END IF;
    
    SELECT json_build_object(
        'user_id', p.id,
        'email', p.email,
        'first_name', p.first_name,
        'last_name', p.last_name,
        'avatar_url', p.avatar_url,
        'current_company_id', public.current_company_id(),
        'current_role', public.current_user_role(),
        'current_employee_id', public.current_employee_id(),
        'companies', (
            SELECT json_agg(json_build_object(
                'company_id', c.id,
                'company_name', c.name,
                'company_slug', c.slug,
                'logo_url', c.logo_url,
                'role', cu.role,
                'is_primary', cu.is_primary
            ))
            FROM public.company_users cu
            JOIN public.companies c ON c.id = cu.company_id
            WHERE cu.user_id = _user_id
              AND cu.is_active = true
              AND c.is_active = true
        )
    ) INTO _result
    FROM public.profiles p
    WHERE p.id = _user_id;
    
    RETURN _result;
END;
$$;

-- =============================================
-- ROLE-BASED PERMISSION CHECKS
-- =============================================

-- Check if current user is owner (super_admin) of company
CREATE OR REPLACE FUNCTION public.is_company_owner(_company_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.company_users
        WHERE user_id = auth.uid()
          AND company_id = _company_id
          AND role = 'super_admin'
          AND is_active = true
    )
$$;

-- Check if current user can manage users in company
CREATE OR REPLACE FUNCTION public.can_manage_users(_company_id UUID)
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
        WHERE cu.user_id = auth.uid()
          AND cu.company_id = _company_id
          AND cu.role IN ('super_admin', 'company_admin')
          AND cu.is_active = true
          AND c.is_active = true
    )
$$;

-- Check if current user can view reports in company
CREATE OR REPLACE FUNCTION public.can_view_reports(_company_id UUID)
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
        WHERE cu.user_id = auth.uid()
          AND cu.company_id = _company_id
          AND cu.role IN ('super_admin', 'company_admin', 'hr_manager', 'manager')
          AND cu.is_active = true
          AND c.is_active = true
    )
$$;

-- =============================================
-- INVITATION SYSTEM
-- =============================================

-- Invite user to company
CREATE OR REPLACE FUNCTION public.invite_user_to_company(
    _company_id UUID,
    _email TEXT,
    _role public.app_role DEFAULT 'employee'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    _invitation_id UUID;
    _inviter_id UUID;
BEGIN
    _inviter_id := auth.uid();
    
    -- Check permission
    IF NOT public.can_manage_users(_company_id) THEN
        RAISE EXCEPTION 'Not authorized to invite users';
    END IF;
    
    -- Prevent inviting with higher role than self
    IF _role = 'super_admin' AND NOT public.is_company_owner(_company_id) THEN
        RAISE EXCEPTION 'Only owners can invite super admins';
    END IF;
    
    -- Check if user already exists and is member
    IF EXISTS (
        SELECT 1 
        FROM public.profiles p
        JOIN public.company_users cu ON cu.user_id = p.id
        WHERE p.email = _email AND cu.company_id = _company_id
    ) THEN
        RAISE EXCEPTION 'User is already a member of this company';
    END IF;
    
    -- For now, just return a placeholder - actual invitation would need email service
    RETURN gen_random_uuid();
END;
$$;
