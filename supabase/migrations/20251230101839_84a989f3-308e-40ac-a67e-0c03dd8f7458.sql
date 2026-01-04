-- Add max_companies column to profiles (default 1 = single company only)
ALTER TABLE public.profiles 
ADD COLUMN max_companies INTEGER NOT NULL DEFAULT 1;

-- Add a comment for documentation
COMMENT ON COLUMN public.profiles.max_companies IS 'Maximum number of companies this user can belong to. Default is 1. Platform admins can increase this.';

-- Allow platform admins to update any profile (for managing max_companies)
CREATE POLICY "profiles_update_platform_admin"
ON public.profiles
FOR UPDATE
USING (is_platform_admin(auth.uid()))
WITH CHECK (is_platform_admin(auth.uid()));

-- Allow platform admins to view all profiles (for user management)
CREATE POLICY "profiles_select_platform_admin"
ON public.profiles
FOR SELECT
USING (is_platform_admin(auth.uid()));

-- Update get_user_context() to include max_companies
CREATE OR REPLACE FUNCTION public.get_user_context()
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    _result JSON;
    _user_id UUID;
    _is_platform_admin BOOLEAN;
BEGIN
    _user_id := auth.uid();
    
    IF _user_id IS NULL THEN
        RETURN NULL;
    END IF;
    
    -- Check if user is a platform admin
    _is_platform_admin := public.is_platform_admin(_user_id);
    
    SELECT json_build_object(
        'user_id', p.id,
        'email', p.email,
        'first_name', p.first_name,
        'last_name', p.last_name,
        'avatar_url', p.avatar_url,
        'max_companies', p.max_companies,
        'current_company_id', CASE WHEN _is_platform_admin THEN NULL ELSE public.current_company_id() END,
        'current_role', CASE WHEN _is_platform_admin THEN NULL ELSE public.current_user_role() END,
        'current_employee_id', CASE WHEN _is_platform_admin THEN NULL ELSE public.current_employee_id() END,
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
$function$;