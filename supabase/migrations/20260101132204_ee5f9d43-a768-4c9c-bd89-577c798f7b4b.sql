-- =====================================================
-- LOGGING SYSTEM SCHEMA EXTENSION
-- =====================================================

-- 1. Add actor_role column to audit_logs for better tracking
ALTER TABLE public.audit_logs 
ADD COLUMN IF NOT EXISTS actor_role text,
ADD COLUMN IF NOT EXISTS target_type text,
ADD COLUMN IF NOT EXISTS severity text DEFAULT 'info';

-- 2. Create severity enum for security events
DO $$ BEGIN
    CREATE TYPE public.log_severity AS ENUM ('low', 'medium', 'high', 'critical');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 3. Add severity column to security_events if not exists
ALTER TABLE public.security_events 
ADD COLUMN IF NOT EXISTS severity text DEFAULT 'medium',
ADD COLUMN IF NOT EXISTS ip_address_masked text,
ADD COLUMN IF NOT EXISTS user_agent_truncated text;

-- 4. Create application_logs table (platform-level debugging)
CREATE TABLE IF NOT EXISTS public.application_logs (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    service text NOT NULL,
    level text NOT NULL DEFAULT 'info',
    message text NOT NULL,
    context jsonb DEFAULT '{}'::jsonb,
    error_code text,
    error_stack text,
    company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
    user_id uuid,
    request_id text,
    duration_ms integer,
    created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_application_logs_service ON public.application_logs(service);
CREATE INDEX IF NOT EXISTS idx_application_logs_level ON public.application_logs(level);
CREATE INDEX IF NOT EXISTS idx_application_logs_created_at ON public.application_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_application_logs_company_id ON public.application_logs(company_id);

-- Enable RLS on application_logs
ALTER TABLE public.application_logs ENABLE ROW LEVEL SECURITY;

-- Platform admins can view application logs
CREATE POLICY "application_logs_select_platform_admin" ON public.application_logs
FOR SELECT USING (is_platform_admin(auth.uid()));

-- Service role can insert (edge functions)
CREATE POLICY "application_logs_insert_service" ON public.application_logs
FOR INSERT WITH CHECK (true);

-- 5. Create billing_logs table
CREATE TABLE IF NOT EXISTS public.billing_logs (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    event_type text NOT NULL,
    subscription_id uuid REFERENCES public.company_subscriptions(id) ON DELETE SET NULL,
    plan_id uuid REFERENCES public.plans(id) ON DELETE SET NULL,
    previous_plan_id uuid REFERENCES public.plans(id) ON DELETE SET NULL,
    amount numeric,
    currency text DEFAULT 'USD',
    metadata jsonb DEFAULT '{}'::jsonb,
    triggered_by uuid,
    created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_billing_logs_company_id ON public.billing_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_billing_logs_event_type ON public.billing_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_billing_logs_created_at ON public.billing_logs(created_at DESC);

-- Enable RLS on billing_logs
ALTER TABLE public.billing_logs ENABLE ROW LEVEL SECURITY;

-- Company admins can view their billing logs
CREATE POLICY "billing_logs_select_admin" ON public.billing_logs
FOR SELECT USING (is_active_company_admin(auth.uid(), company_id));

-- Platform admins can view all billing logs (metadata only visibility enforced in app)
CREATE POLICY "billing_logs_select_platform_admin" ON public.billing_logs
FOR SELECT USING (is_platform_admin(auth.uid()));

-- Service role can insert billing logs
CREATE POLICY "billing_logs_insert_service" ON public.billing_logs
FOR INSERT WITH CHECK (true);

-- 6. Add additional columns to support_access for better audit trail
ALTER TABLE public.support_access 
ADD COLUMN IF NOT EXISTS access_reason text,
ADD COLUMN IF NOT EXISTS accessed_resources jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS last_accessed_at timestamp with time zone;

-- 7. Create a helper function to mask IP addresses (privacy compliance)
CREATE OR REPLACE FUNCTION public.mask_ip_address(ip_addr text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT CASE 
        WHEN ip_addr IS NULL THEN NULL
        WHEN position('.' in ip_addr) > 0 THEN 
            -- IPv4: show first two octets, mask last two
            regexp_replace(ip_addr, '^(\d+\.\d+)\.\d+\.\d+$', '\1.xxx.xxx')
        WHEN position(':' in ip_addr) > 0 THEN
            -- IPv6: show first segment only
            regexp_replace(ip_addr, '^([^:]+).*$', '\1:xxxx:xxxx:xxxx')
        ELSE ip_addr
    END
$$;

-- 8. Create a helper function to truncate user agent
CREATE OR REPLACE FUNCTION public.truncate_user_agent(ua text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT CASE 
        WHEN ua IS NULL THEN NULL
        WHEN length(ua) > 100 THEN left(ua, 100) || '...'
        ELSE ua
    END
$$;

-- 9. Create function to log audit events (server-side, for use in edge functions)
CREATE OR REPLACE FUNCTION public.log_audit_event(
    _company_id uuid,
    _user_id uuid,
    _action audit_action,
    _table_name text,
    _record_id uuid DEFAULT NULL,
    _old_values jsonb DEFAULT NULL,
    _new_values jsonb DEFAULT NULL,
    _metadata jsonb DEFAULT '{}'::jsonb,
    _actor_role text DEFAULT NULL,
    _target_type text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    _log_id uuid;
BEGIN
    INSERT INTO public.audit_logs (
        company_id,
        user_id,
        action,
        table_name,
        record_id,
        old_values,
        new_values,
        metadata,
        actor_role,
        target_type
    ) VALUES (
        _company_id,
        _user_id,
        _action,
        _table_name,
        _record_id,
        _old_values,
        _new_values,
        _metadata,
        _actor_role,
        _target_type
    ) RETURNING id INTO _log_id;
    
    RETURN _log_id;
END;
$$;

-- 10. Create function to log security events
CREATE OR REPLACE FUNCTION public.log_security_event(
    _company_id uuid,
    _user_id uuid,
    _event_type security_event_type,
    _description text DEFAULT NULL,
    _severity text DEFAULT 'medium',
    _ip_address text DEFAULT NULL,
    _user_agent text DEFAULT NULL,
    _metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    _log_id uuid;
BEGIN
    INSERT INTO public.security_events (
        company_id,
        user_id,
        event_type,
        description,
        severity,
        ip_address_masked,
        user_agent_truncated,
        user_agent,
        metadata
    ) VALUES (
        _company_id,
        _user_id,
        _event_type,
        _description,
        _severity,
        public.mask_ip_address(_ip_address),
        public.truncate_user_agent(_user_agent),
        _user_agent,
        _metadata
    ) RETURNING id INTO _log_id;
    
    RETURN _log_id;
END;
$$;

-- 11. Create function to log billing events
CREATE OR REPLACE FUNCTION public.log_billing_event(
    _company_id uuid,
    _event_type text,
    _subscription_id uuid DEFAULT NULL,
    _plan_id uuid DEFAULT NULL,
    _previous_plan_id uuid DEFAULT NULL,
    _amount numeric DEFAULT NULL,
    _currency text DEFAULT 'USD',
    _metadata jsonb DEFAULT '{}'::jsonb,
    _triggered_by uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    _log_id uuid;
BEGIN
    INSERT INTO public.billing_logs (
        company_id,
        event_type,
        subscription_id,
        plan_id,
        previous_plan_id,
        amount,
        currency,
        metadata,
        triggered_by
    ) VALUES (
        _company_id,
        _event_type,
        _subscription_id,
        _plan_id,
        _previous_plan_id,
        _amount,
        _currency,
        _metadata,
        COALESCE(_triggered_by, auth.uid())
    ) RETURNING id INTO _log_id;
    
    RETURN _log_id;
END;
$$;

-- 12. Create function to log application events
CREATE OR REPLACE FUNCTION public.log_application_event(
    _service text,
    _level text,
    _message text,
    _context jsonb DEFAULT '{}'::jsonb,
    _error_code text DEFAULT NULL,
    _error_stack text DEFAULT NULL,
    _company_id uuid DEFAULT NULL,
    _user_id uuid DEFAULT NULL,
    _request_id text DEFAULT NULL,
    _duration_ms integer DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    _log_id uuid;
BEGIN
    INSERT INTO public.application_logs (
        service,
        level,
        message,
        context,
        error_code,
        error_stack,
        company_id,
        user_id,
        request_id,
        duration_ms
    ) VALUES (
        _service,
        _level,
        _message,
        _context,
        _error_code,
        -- Truncate stack trace to prevent bloat
        CASE WHEN _error_stack IS NOT NULL THEN left(_error_stack, 5000) ELSE NULL END,
        _company_id,
        COALESCE(_user_id, auth.uid()),
        _request_id,
        _duration_ms
    ) RETURNING id INTO _log_id;
    
    RETURN _log_id;
END;
$$;

-- 13. Add index for faster audit log queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_company_action ON public.audit_logs(company_id, action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_table_name ON public.audit_logs(table_name);

-- 14. Add index for faster security event queries  
CREATE INDEX IF NOT EXISTS idx_security_events_severity ON public.security_events(severity);
CREATE INDEX IF NOT EXISTS idx_security_events_created_at ON public.security_events(created_at DESC);

-- 15. Create view for platform admins to see aggregated billing stats (no sensitive data)
CREATE OR REPLACE VIEW public.billing_logs_summary AS
SELECT 
    bl.company_id,
    c.name as company_name,
    bl.event_type,
    count(*) as event_count,
    date_trunc('day', bl.created_at) as log_date
FROM public.billing_logs bl
JOIN public.companies c ON c.id = bl.company_id
GROUP BY bl.company_id, c.name, bl.event_type, date_trunc('day', bl.created_at);