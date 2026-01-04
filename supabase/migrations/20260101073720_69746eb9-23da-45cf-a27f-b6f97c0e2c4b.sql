-- Drop problematic RLS policies that cause infinite recursion
DROP POLICY IF EXISTS "interviews_select_panelist" ON public.interviews;

-- Create helper function to check interview access (avoids recursion)
CREATE OR REPLACE FUNCTION public.is_interview_panelist(_user_id uuid, _interview_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM interview_panelists ip
    JOIN employees e ON e.id = ip.employee_id
    WHERE ip.interview_id = _interview_id
      AND e.user_id = _user_id
  )
$$;

-- Recreate interviews select policy for panelists using the helper function
CREATE POLICY "interviews_select_panelist" ON public.interviews
FOR SELECT USING (
  company_has_module(company_id, 'recruitment'::text) 
  AND is_interview_panelist(auth.uid(), id)
);

-- Ensure complete RLS policies exist for interviews and interview_panelists
-- These may already exist but we add IF NOT EXISTS equivalent by dropping first
DROP POLICY IF EXISTS "interviews_insert_hr" ON public.interviews;
DROP POLICY IF EXISTS "interviews_update_hr" ON public.interviews;
DROP POLICY IF EXISTS "interviews_delete_hr" ON public.interviews;
DROP POLICY IF EXISTS "interviews_select_hr" ON public.interviews;

CREATE POLICY "interviews_select_hr" ON public.interviews
FOR SELECT USING (can_use_recruitment(auth.uid(), company_id));

CREATE POLICY "interviews_insert_hr" ON public.interviews
FOR INSERT WITH CHECK (can_use_recruitment(auth.uid(), company_id));

CREATE POLICY "interviews_update_hr" ON public.interviews
FOR UPDATE USING (can_use_recruitment(auth.uid(), company_id))
WITH CHECK (can_use_recruitment(auth.uid(), company_id));

CREATE POLICY "interviews_delete_hr" ON public.interviews
FOR DELETE USING (can_use_recruitment(auth.uid(), company_id));