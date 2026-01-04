-- Create platform_admins table for SaaS platform-level administrators
CREATE TABLE public.platform_admins (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL UNIQUE,
    role text NOT NULL DEFAULT 'admin' CHECK (role IN ('owner', 'admin', 'support')),
    created_at timestamptz NOT NULL DEFAULT now(),
    created_by uuid,
    is_active boolean NOT NULL DEFAULT true,
    metadata jsonb DEFAULT '{}'::jsonb,
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create index for faster lookups
CREATE INDEX idx_platform_admins_user_id ON public.platform_admins(user_id);

-- Enable RLS
ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;

-- Create helper function to check if user is a platform admin
CREATE OR REPLACE FUNCTION public.is_platform_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.platform_admins
        WHERE user_id = _user_id AND is_active = true
    )
$$;

-- Create helper function to check platform admin role
CREATE OR REPLACE FUNCTION public.get_platform_admin_role(_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT role FROM public.platform_admins
    WHERE user_id = _user_id AND is_active = true
    LIMIT 1
$$;

-- Create helper function to check if user is platform owner (highest level)
CREATE OR REPLACE FUNCTION public.is_platform_owner(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.platform_admins
        WHERE user_id = _user_id AND role = 'owner' AND is_active = true
    )
$$;

-- RLS Policies for platform_admins table

-- Platform admins can view all platform admins
CREATE POLICY "platform_admins_select"
ON public.platform_admins
FOR SELECT
USING (public.is_platform_admin(auth.uid()));

-- Only platform owners can insert new platform admins (or bootstrap)
CREATE POLICY "platform_admins_insert"
ON public.platform_admins
FOR INSERT
WITH CHECK (
    public.is_platform_owner(auth.uid())
    OR NOT EXISTS (SELECT 1 FROM public.platform_admins)  -- Bootstrap mode
);

-- Only platform owners can update platform admins
CREATE POLICY "platform_admins_update"
ON public.platform_admins
FOR UPDATE
USING (public.is_platform_owner(auth.uid()))
WITH CHECK (public.is_platform_owner(auth.uid()));

-- Only platform owners can delete platform admins (but not themselves)
CREATE POLICY "platform_admins_delete"
ON public.platform_admins
FOR DELETE
USING (
    public.is_platform_owner(auth.uid()) 
    AND user_id != auth.uid()
);

-- Update get_user_context to include platform admin status
CREATE OR REPLACE FUNCTION public.get_user_context()
RETURNS json
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
        'is_platform_admin', public.is_platform_admin(_user_id),
        'platform_admin_role', public.get_platform_admin_role(_user_id),
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

-- Add trigger for updated_at
CREATE TRIGGER update_platform_admins_updated_at
BEFORE UPDATE ON public.platform_admins
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Grant platform admins ability to view all companies
CREATE POLICY "companies_select_platform_admin"
ON public.companies
FOR SELECT
USING (public.is_platform_admin(auth.uid()));

-- Grant platform admins ability to manage all companies
CREATE POLICY "companies_update_platform_admin"
ON public.companies
FOR UPDATE
USING (public.is_platform_admin(auth.uid()))
WITH CHECK (public.is_platform_admin(auth.uid()));

-- Grant platform admins ability to view all subscriptions
CREATE POLICY "subscriptions_select_platform_admin"
ON public.company_subscriptions
FOR SELECT
USING (public.is_platform_admin(auth.uid()));

-- Grant platform admins ability to manage all subscriptions
CREATE POLICY "subscriptions_update_platform_admin"
ON public.company_subscriptions
FOR UPDATE
USING (public.is_platform_admin(auth.uid()))
WITH CHECK (public.is_platform_admin(auth.uid()));

-- Grant platform admins ability to insert subscriptions for any company
CREATE POLICY "subscriptions_insert_platform_admin"
ON public.company_subscriptions
FOR INSERT
WITH CHECK (public.is_platform_admin(auth.uid()));

-- Grant platform admins ability to view all company users
CREATE POLICY "company_users_select_platform_admin"
ON public.company_users
FOR SELECT
USING (public.is_platform_admin(auth.uid()));

-- Grant platform admins ability to manage plans
CREATE POLICY "plans_insert_platform_admin"
ON public.plans
FOR INSERT
WITH CHECK (public.is_platform_admin(auth.uid()));

CREATE POLICY "plans_update_platform_admin"
ON public.plans
FOR UPDATE
USING (public.is_platform_admin(auth.uid()))
WITH CHECK (public.is_platform_admin(auth.uid()));

CREATE POLICY "plans_delete_platform_admin"
ON public.plans
FOR DELETE
USING (public.is_platform_admin(auth.uid()));