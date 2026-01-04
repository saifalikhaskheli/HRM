-- ================================================
-- SALES-LED COMPANY ONBOARDING SYSTEM
-- Phase 1-8: Database Schema
-- ================================================

-- 1. Add is_public column to plans table for private/public plan visibility
ALTER TABLE public.plans 
ADD COLUMN IF NOT EXISTS is_public boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;

-- Create index for private plan lookup
CREATE INDEX IF NOT EXISTS idx_plans_company_id ON public.plans(company_id) WHERE company_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_plans_is_public ON public.plans(is_public) WHERE is_public = true;

COMMENT ON COLUMN public.plans.is_public IS 'If false, plan is only visible to assigned company';
COMMENT ON COLUMN public.plans.company_id IS 'For private/custom plans, the company this plan is assigned to';

-- 2. Create company_creation_links table for secure invitation links
CREATE TABLE IF NOT EXISTS public.company_creation_links (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    token uuid UNIQUE NOT NULL DEFAULT gen_random_uuid(),
    plan_id uuid REFERENCES public.plans(id),
    
    -- Link configuration
    email text,  -- Optional: pre-fill and restrict to this email
    modules jsonb DEFAULT '[]'::jsonb,  -- Module overrides
    trial_days integer DEFAULT 14,
    billing_interval text DEFAULT 'monthly' CHECK (billing_interval IN ('monthly', 'yearly')),
    
    -- Expiry and usage
    expires_at timestamp with time zone NOT NULL,
    max_uses integer DEFAULT 1,
    uses integer DEFAULT 0,
    
    -- Metadata
    created_by uuid NOT NULL,  -- Platform admin who created the link
    created_at timestamp with time zone DEFAULT now(),
    used_at timestamp with time zone,
    used_by_company_id uuid REFERENCES public.companies(id),
    
    -- Notes for platform admin
    notes text
);

-- Enable RLS
ALTER TABLE public.company_creation_links ENABLE ROW LEVEL SECURITY;

-- Policies for company_creation_links
CREATE POLICY "company_creation_links_select_platform" ON public.company_creation_links
    FOR SELECT USING (is_platform_admin(auth.uid()));

CREATE POLICY "company_creation_links_insert_platform" ON public.company_creation_links
    FOR INSERT WITH CHECK (is_platform_admin(auth.uid()));

CREATE POLICY "company_creation_links_update_platform" ON public.company_creation_links
    FOR UPDATE USING (is_platform_admin(auth.uid()));

CREATE POLICY "company_creation_links_delete_platform" ON public.company_creation_links
    FOR DELETE USING (is_platform_admin(auth.uid()));

-- Public can select by token (for validation)
CREATE POLICY "company_creation_links_select_by_token" ON public.company_creation_links
    FOR SELECT USING (true);

-- 3. Add support email field to platform_settings if not exists via upsert pattern
-- (Already exists in settings, but ensure it's documented)

-- 4. Add force_password_change to profiles if not exists
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS force_password_change boolean DEFAULT false;

-- 5. Create onboarding_logs table for comprehensive audit
CREATE TABLE IF NOT EXISTS public.onboarding_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type text NOT NULL, -- 'signup_toggle', 'company_created', 'link_generated', 'link_used', 'credentials_sent'
    company_id uuid REFERENCES public.companies(id),
    user_id uuid,  -- User who performed the action
    target_user_id uuid,  -- User being affected (e.g., invited user)
    link_id uuid REFERENCES public.company_creation_links(id),
    metadata jsonb DEFAULT '{}'::jsonb,
    ip_address inet,
    user_agent text,
    created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.onboarding_logs ENABLE ROW LEVEL SECURITY;

-- Only platform admins can see onboarding logs
CREATE POLICY "onboarding_logs_select_platform" ON public.onboarding_logs
    FOR SELECT USING (is_platform_admin(auth.uid()));

-- Service role can insert
CREATE POLICY "onboarding_logs_insert_service" ON public.onboarding_logs
    FOR INSERT WITH CHECK (true);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_onboarding_logs_event_type ON public.onboarding_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_onboarding_logs_company_id ON public.onboarding_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_logs_created_at ON public.onboarding_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_company_creation_links_token ON public.company_creation_links(token);
CREATE INDEX IF NOT EXISTS idx_company_creation_links_expires ON public.company_creation_links(expires_at);

-- 6. Update plans RLS to handle private plans
DROP POLICY IF EXISTS "plans_select_public" ON public.plans;
CREATE POLICY "plans_select_public" ON public.plans
    FOR SELECT USING (
        -- Platform admins see all
        is_platform_admin(auth.uid())
        -- Public plans visible to all
        OR is_public = true
        -- Company-specific plans visible to that company
        OR (company_id IS NOT NULL AND is_active_company_member(auth.uid(), company_id))
    );

-- 7. Function to validate company creation link
CREATE OR REPLACE FUNCTION public.validate_company_creation_link(_token uuid)
RETURNS TABLE (
    is_valid boolean,
    link_id uuid,
    plan_id uuid,
    plan_name text,
    email text,
    modules jsonb,
    trial_days integer,
    billing_interval text,
    error_message text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
    _link record;
    _plan record;
BEGIN
    -- Find the link
    SELECT * INTO _link FROM public.company_creation_links WHERE token = _token;
    
    IF NOT FOUND THEN
        RETURN QUERY SELECT false, NULL::uuid, NULL::uuid, NULL::text, NULL::text, NULL::jsonb, NULL::integer, NULL::text, 'Invalid or expired link'::text;
        RETURN;
    END IF;
    
    -- Check if expired
    IF _link.expires_at < now() THEN
        RETURN QUERY SELECT false, _link.id, NULL::uuid, NULL::text, NULL::text, NULL::jsonb, NULL::integer, NULL::text, 'This link has expired'::text;
        RETURN;
    END IF;
    
    -- Check if already used
    IF _link.uses >= _link.max_uses THEN
        RETURN QUERY SELECT false, _link.id, NULL::uuid, NULL::text, NULL::text, NULL::jsonb, NULL::integer, NULL::text, 'This link has already been used'::text;
        RETURN;
    END IF;
    
    -- Get plan info if specified
    IF _link.plan_id IS NOT NULL THEN
        SELECT * INTO _plan FROM public.plans WHERE id = _link.plan_id AND is_active = true;
        IF NOT FOUND THEN
            RETURN QUERY SELECT false, _link.id, NULL::uuid, NULL::text, NULL::text, NULL::jsonb, NULL::integer, NULL::text, 'The assigned plan is no longer available'::text;
            RETURN;
        END IF;
    END IF;
    
    -- Return valid link info
    RETURN QUERY SELECT 
        true,
        _link.id,
        _link.plan_id,
        _plan.name,
        _link.email,
        _link.modules,
        _link.trial_days,
        _link.billing_interval,
        NULL::text;
END;
$$;

-- 8. Function to get registration settings (public function)
CREATE OR REPLACE FUNCTION public.get_registration_settings()
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
    SELECT COALESCE(value, '{"open_registration": false, "require_invite": true}'::jsonb)
    FROM public.platform_settings
    WHERE key = 'registration'
    LIMIT 1
$$;