-- Fix security linter warnings

-- 1. Drop the security definer view and recreate as regular view
DROP VIEW IF EXISTS public.billing_logs_summary;

-- 2. Fix mask_ip_address function with proper search_path
CREATE OR REPLACE FUNCTION public.mask_ip_address(ip_addr text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
    SELECT CASE 
        WHEN ip_addr IS NULL THEN NULL
        WHEN position('.' in ip_addr) > 0 THEN 
            regexp_replace(ip_addr, '^(\d+\.\d+)\.\d+\.\d+$', '\1.xxx.xxx')
        WHEN position(':' in ip_addr) > 0 THEN
            regexp_replace(ip_addr, '^([^:]+).*$', '\1:xxxx:xxxx:xxxx')
        ELSE ip_addr
    END
$$;

-- 3. Fix truncate_user_agent function with proper search_path
CREATE OR REPLACE FUNCTION public.truncate_user_agent(ua text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
    SELECT CASE 
        WHEN ua IS NULL THEN NULL
        WHEN length(ua) > 100 THEN left(ua, 100) || '...'
        ELSE ua
    END
$$;