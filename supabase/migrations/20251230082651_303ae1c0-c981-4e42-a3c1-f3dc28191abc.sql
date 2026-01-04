-- Add RLS policy for platform admins to view all audit logs
CREATE POLICY "audit_logs_select_platform_admin" 
ON public.audit_logs 
FOR SELECT 
USING (is_platform_admin(auth.uid()));