-- Create impersonation_logs table to track platform admin impersonation sessions
CREATE TABLE public.impersonation_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_user_id UUID NOT NULL,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('start', 'end')),
  ip_address INET,
  user_agent TEXT,
  session_id UUID,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.impersonation_logs ENABLE ROW LEVEL SECURITY;

-- Only platform admins can view impersonation logs
CREATE POLICY "impersonation_logs_select_platform_admin"
ON public.impersonation_logs
FOR SELECT
USING (is_platform_admin(auth.uid()));

-- Platform admins can insert their own logs
CREATE POLICY "impersonation_logs_insert_platform_admin"
ON public.impersonation_logs
FOR INSERT
WITH CHECK (is_platform_admin(auth.uid()) AND admin_user_id = auth.uid());

-- Create index for faster queries
CREATE INDEX idx_impersonation_logs_admin ON public.impersonation_logs(admin_user_id);
CREATE INDEX idx_impersonation_logs_company ON public.impersonation_logs(company_id);
CREATE INDEX idx_impersonation_logs_created ON public.impersonation_logs(created_at DESC);

-- Add comment
COMMENT ON TABLE public.impersonation_logs IS 'Tracks when platform admins impersonate company accounts';