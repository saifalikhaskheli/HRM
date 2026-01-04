-- ================================================================
-- User-Employee Auto-Link System
-- Strengthens the relationship between users and employees
-- ================================================================

-- 1. Trigger: Auto-link user to matching employee when user signs up
-- This runs AFTER a user confirms their account or is added to a company
CREATE OR REPLACE FUNCTION public.auto_link_user_to_employee()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    _matching_employee_id uuid;
    _company_id uuid;
BEGIN
    -- When a user is added to a company (company_users insert)
    -- Try to find a matching employee by email in that company
    
    -- Get user's email
    SELECT p.email, NEW.company_id INTO _company_id
    FROM public.profiles p
    WHERE p.id = NEW.user_id;
    
    IF _company_id IS NOT NULL THEN
        -- Find matching unlinked employee
        UPDATE public.employees
        SET user_id = NEW.user_id, 
            updated_at = now()
        WHERE company_id = NEW.company_id
          AND email = (SELECT email FROM public.profiles WHERE id = NEW.user_id)
          AND user_id IS NULL
          AND employment_status != 'terminated';
    END IF;
    
    RETURN NEW;
END;
$$;

-- Create trigger on company_users insert
DROP TRIGGER IF EXISTS trg_auto_link_user_to_employee ON public.company_users;
CREATE TRIGGER trg_auto_link_user_to_employee
    AFTER INSERT ON public.company_users
    FOR EACH ROW
    EXECUTE FUNCTION public.auto_link_user_to_employee();

-- 2. Trigger: Auto-link employee to matching user when employee is created
CREATE OR REPLACE FUNCTION public.auto_link_employee_to_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    _matching_user_id uuid;
BEGIN
    -- Only process if employee doesn't already have a user linked
    IF NEW.user_id IS NULL AND NEW.email IS NOT NULL THEN
        -- Find matching user who is in the same company
        SELECT p.id INTO _matching_user_id
        FROM public.profiles p
        JOIN public.company_users cu ON cu.user_id = p.id
        WHERE LOWER(p.email) = LOWER(NEW.email)
          AND cu.company_id = NEW.company_id
          AND cu.is_active = true
        LIMIT 1;
        
        IF _matching_user_id IS NOT NULL THEN
            NEW.user_id := _matching_user_id;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$;

-- Create trigger on employees insert/update
DROP TRIGGER IF EXISTS trg_auto_link_employee_to_user ON public.employees;
CREATE TRIGGER trg_auto_link_employee_to_user
    BEFORE INSERT OR UPDATE OF email ON public.employees
    FOR EACH ROW
    EXECUTE FUNCTION public.auto_link_employee_to_user();

-- 3. Utility function to bulk-link existing unmatched records
CREATE OR REPLACE FUNCTION public.bulk_link_users_to_employees(_company_id uuid)
RETURNS TABLE(linked_count integer, unlinked_users integer, unlinked_employees integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    _linked integer := 0;
    _unlinked_u integer;
    _unlinked_e integer;
BEGIN
    -- Check authorization
    IF NOT public.is_active_company_admin(auth.uid(), _company_id) THEN
        RAISE EXCEPTION 'Not authorized';
    END IF;
    
    -- Link matching records by email
    WITH updated AS (
        UPDATE public.employees e
        SET user_id = p.id, 
            updated_at = now()
        FROM public.profiles p
        JOIN public.company_users cu ON cu.user_id = p.id
        WHERE LOWER(e.email) = LOWER(p.email)
          AND e.company_id = _company_id
          AND cu.company_id = _company_id
          AND e.user_id IS NULL
          AND cu.is_active = true
          AND e.employment_status != 'terminated'
        RETURNING e.id
    )
    SELECT count(*) INTO _linked FROM updated;
    
    -- Count remaining unlinked users
    SELECT count(*) INTO _unlinked_u
    FROM public.company_users cu
    LEFT JOIN public.employees e ON e.user_id = cu.user_id AND e.company_id = cu.company_id
    WHERE cu.company_id = _company_id
      AND cu.is_active = true
      AND e.id IS NULL;
    
    -- Count remaining unlinked employees
    SELECT count(*) INTO _unlinked_e
    FROM public.employees e
    WHERE e.company_id = _company_id
      AND e.user_id IS NULL
      AND e.employment_status != 'terminated';
    
    RETURN QUERY SELECT _linked, _unlinked_u, _unlinked_e;
END;
$$;

-- 4. Update get_user_context to include current_employee object
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
    _is_platform_admin BOOLEAN;
    _primary_company_id UUID;
    _employee_data JSON;
BEGIN
    _user_id := auth.uid();
    
    IF _user_id IS NULL THEN
        RETURN NULL;
    END IF;
    
    -- Check if user is a platform admin
    _is_platform_admin := public.is_platform_admin(_user_id);
    
    -- Get primary company for regular users
    IF NOT _is_platform_admin THEN
        SELECT company_id INTO _primary_company_id
        FROM public.company_users
        WHERE user_id = _user_id
          AND is_active = true
          AND is_primary = true
        LIMIT 1;
        
        -- Build employee data object for the primary company
        SELECT json_build_object(
            'id', e.id,
            'first_name', e.first_name,
            'last_name', e.last_name,
            'employee_number', e.employee_number,
            'job_title', e.job_title,
            'department_id', e.department_id,
            'manager_id', e.manager_id,
            'employment_status', e.employment_status
        ) INTO _employee_data
        FROM public.employees e
        WHERE e.user_id = _user_id
          AND e.company_id = _primary_company_id
        LIMIT 1;
    END IF;
    
    SELECT json_build_object(
        'user_id', p.id,
        'email', p.email,
        'first_name', p.first_name,
        'last_name', p.last_name,
        'avatar_url', p.avatar_url,
        'max_companies', p.max_companies,
        'current_company_id', CASE WHEN _is_platform_admin THEN NULL ELSE _primary_company_id END,
        'current_role', CASE WHEN _is_platform_admin THEN NULL ELSE public.current_user_role() END,
        'current_employee_id', CASE WHEN _is_platform_admin THEN NULL ELSE public.current_employee_id() END,
        'current_employee', CASE WHEN _is_platform_admin THEN NULL ELSE _employee_data END,
        'is_platform_admin', _is_platform_admin,
        'platform_admin_role', public.get_platform_admin_role(_user_id),
        'companies', CASE 
            WHEN _is_platform_admin THEN NULL
            ELSE (
                SELECT json_agg(json_build_object(
                    'company_id', c.id,
                    'company_name', c.name,
                    'company_slug', c.slug,
                    'logo_url', c.logo_url,
                    'role', cu.role,
                    'is_primary', cu.is_primary,
                    'is_frozen', NOT COALESCE(c.is_active, true)
                ))
                FROM public.company_users cu
                JOIN public.companies c ON c.id = cu.company_id
                WHERE cu.user_id = _user_id
                  AND cu.is_active = true
            )
        END
    ) INTO _result
    FROM public.profiles p
    WHERE p.id = _user_id;
    
    RETURN _result;
END;
$$;