-- =====================================================
-- PHASE 1-2: Trial System Data Model & State Extension
-- =====================================================

-- 1. Add new subscription status 'trial_expired' to the enum
ALTER TYPE subscription_status ADD VALUE IF NOT EXISTS 'trial_expired' AFTER 'trialing';

-- 2. Add trial configuration columns to plans table
ALTER TABLE public.plans 
ADD COLUMN IF NOT EXISTS trial_enabled boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS trial_default_days integer DEFAULT 14,
ADD COLUMN IF NOT EXISTS trial_restrictions jsonb DEFAULT '{}'::jsonb;

-- Add comments for documentation
COMMENT ON COLUMN public.plans.trial_enabled IS 'Whether this plan can have a trial period';
COMMENT ON COLUMN public.plans.trial_default_days IS 'Default number of days for trial on this plan';
COMMENT ON COLUMN public.plans.trial_restrictions IS 'JSON config for trial restrictions: disabled_modules, action_limits, quantity_limits';

-- 3. Add trial_total_days to subscriptions for tracking actual trial duration
ALTER TABLE public.company_subscriptions
ADD COLUMN IF NOT EXISTS trial_total_days integer DEFAULT NULL;

COMMENT ON COLUMN public.company_subscriptions.trial_total_days IS 'Total trial days granted (including extensions) for progress bar accuracy';

-- 4. Update existing trialing subscriptions to have trial_total_days set
UPDATE public.company_subscriptions
SET trial_total_days = 14
WHERE status = 'trialing' AND trial_total_days IS NULL;

-- =====================================================
-- PHASE 3: Real-time Trial Status Helper Functions
-- =====================================================

-- 5. Create function to check if trial is expired (real-time check)
CREATE OR REPLACE FUNCTION public.is_trial_expired(_company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
    SELECT EXISTS (
        SELECT 1 
        FROM public.company_subscriptions cs
        WHERE cs.company_id = _company_id
          AND cs.status = 'trialing'
          AND cs.trial_ends_at IS NOT NULL
          AND cs.trial_ends_at < now()
    )
$$;

-- 6. Create function to get effective subscription status (with real-time trial expiry)
CREATE OR REPLACE FUNCTION public.get_effective_subscription_status(_company_id uuid)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
    SELECT 
        CASE 
            -- If trialing but trial has expired, return trial_expired
            WHEN cs.status = 'trialing' 
                 AND cs.trial_ends_at IS NOT NULL 
                 AND cs.trial_ends_at < now() 
            THEN 'trial_expired'
            -- Otherwise return actual status
            ELSE cs.status::text
        END
    FROM public.company_subscriptions cs
    WHERE cs.company_id = _company_id
    LIMIT 1
$$;

-- 7. Create function to check if company can perform write actions (real-time)
CREATE OR REPLACE FUNCTION public.can_write_action(_company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
    SELECT 
        -- Company must be active
        public.is_company_active(_company_id)
        -- AND subscription must allow writes
        AND EXISTS (
            SELECT 1 
            FROM public.company_subscriptions cs
            WHERE cs.company_id = _company_id
              AND (
                  -- Active subscription
                  cs.status = 'active'
                  -- OR valid trial (not expired)
                  OR (cs.status = 'trialing' AND (cs.trial_ends_at IS NULL OR cs.trial_ends_at >= now()))
              )
        )
$$;

-- 8. Create function to check if company can perform module-specific action
CREATE OR REPLACE FUNCTION public.can_perform_action(_company_id uuid, _module text, _action text DEFAULT 'read')
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    _effective_status text;
    _trial_restrictions jsonb;
BEGIN
    -- Get effective status (with real-time trial expiry check)
    _effective_status := public.get_effective_subscription_status(_company_id);
    
    -- If frozen or no subscription, deny
    IF NOT public.is_company_active(_company_id) THEN
        RETURN false;
    END IF;
    
    -- If trial_expired, only allow read actions
    IF _effective_status = 'trial_expired' THEN
        RETURN _action = 'read';
    END IF;
    
    -- If paused or canceled, deny all
    IF _effective_status IN ('paused', 'canceled') THEN
        RETURN false;
    END IF;
    
    -- If past_due, allow reads only
    IF _effective_status = 'past_due' THEN
        RETURN _action = 'read';
    END IF;
    
    -- If trialing, check trial restrictions
    IF _effective_status = 'trialing' THEN
        -- Get trial restrictions from the plan
        SELECT p.trial_restrictions INTO _trial_restrictions
        FROM public.company_subscriptions cs
        JOIN public.plans p ON p.id = cs.plan_id
        WHERE cs.company_id = _company_id;
        
        -- Check if module is disabled during trial
        IF _trial_restrictions IS NOT NULL 
           AND _trial_restrictions->'disabled_modules' IS NOT NULL 
           AND _trial_restrictions->'disabled_modules' ? _module THEN
            RETURN false;
        END IF;
        
        -- Check action limits during trial
        IF _trial_restrictions IS NOT NULL 
           AND _trial_restrictions->'action_limits' IS NOT NULL 
           AND _trial_restrictions->'action_limits'->_module IS NOT NULL 
           AND NOT (
               _trial_restrictions->'action_limits'->_module ? _action 
               OR _trial_restrictions->'action_limits'->_module ? 'all'
           ) THEN
            RETURN false;
        END IF;
    END IF;
    
    -- Check module access from plan
    RETURN public.company_has_module(_company_id, _module);
END;
$$;

-- 9. Create function to auto-transition expired trials (for cron or on-demand)
CREATE OR REPLACE FUNCTION public.transition_expired_trials()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    _count integer := 0;
BEGIN
    -- Update all expired trials to trial_expired status
    WITH updated AS (
        UPDATE public.company_subscriptions
        SET status = 'trial_expired',
            updated_at = now()
        WHERE status = 'trialing'
          AND trial_ends_at IS NOT NULL
          AND trial_ends_at < now()
        RETURNING id, company_id
    )
    SELECT count(*) INTO _count FROM updated;
    
    -- Log transitions
    INSERT INTO public.billing_logs (company_id, event_type, metadata)
    SELECT 
        company_id,
        'trial_expired',
        jsonb_build_object('auto_transitioned', true, 'transitioned_at', now())
    FROM company_subscriptions
    WHERE status = 'trial_expired'
      AND updated_at >= now() - interval '1 minute';
    
    RETURN _count;
END;
$$;

-- =====================================================
-- PHASE 4: Update RLS Helper Functions for Trial Checks
-- =====================================================

-- 10. Update company_has_active_subscription to handle trial_expired
CREATE OR REPLACE FUNCTION public.company_has_active_subscription(_company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
    SELECT EXISTS (
        SELECT 1 
        FROM public.company_subscriptions cs
        WHERE cs.company_id = _company_id
          AND (
              -- Active subscription
              cs.status = 'active'
              -- OR valid trial (not expired in real-time)
              OR (cs.status = 'trialing' AND (cs.trial_ends_at IS NULL OR cs.trial_ends_at >= now()))
          )
          AND cs.current_period_end > now()
    )
$$;

-- 11. Create comprehensive write guard function
CREATE OR REPLACE FUNCTION public.guard_write_operation(_company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
    SELECT 
        public.is_company_active(_company_id)
        AND public.can_write_action(_company_id)
$$;

-- 12. Create function to get trial info for a company
CREATE OR REPLACE FUNCTION public.get_trial_info(_company_id uuid)
RETURNS TABLE (
    is_trialing boolean,
    is_trial_expired boolean,
    trial_ends_at timestamp with time zone,
    trial_days_remaining integer,
    trial_total_days integer,
    effective_status text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
    SELECT 
        cs.status = 'trialing' as is_trialing,
        (cs.status = 'trialing' AND cs.trial_ends_at IS NOT NULL AND cs.trial_ends_at < now()) as is_trial_expired,
        cs.trial_ends_at,
        CASE 
            WHEN cs.trial_ends_at IS NULL THEN NULL
            WHEN cs.trial_ends_at < now() THEN 0
            ELSE GREATEST(0, EXTRACT(DAY FROM cs.trial_ends_at - now())::integer)
        END as trial_days_remaining,
        cs.trial_total_days,
        public.get_effective_subscription_status(_company_id) as effective_status
    FROM public.company_subscriptions cs
    WHERE cs.company_id = _company_id
    LIMIT 1
$$;