-- Enable pg_cron and pg_net extensions for scheduled jobs
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Create trial_extension_requests table
CREATE TABLE public.trial_extension_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  requested_by UUID NOT NULL,
  requested_days INTEGER NOT NULL DEFAULT 7,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  extension_number INTEGER NOT NULL DEFAULT 1,
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create trial_email_logs table to prevent duplicate emails
CREATE TABLE public.trial_email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  email_type TEXT NOT NULL,
  recipient_email TEXT NOT NULL,
  days_remaining INTEGER NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_date DATE NOT NULL DEFAULT CURRENT_DATE
);

-- Create unique constraint to prevent duplicate emails per day
CREATE UNIQUE INDEX idx_trial_email_logs_unique_daily ON public.trial_email_logs(company_id, email_type, recipient_email, sent_date);

-- Enable RLS on trial_extension_requests
ALTER TABLE public.trial_extension_requests ENABLE ROW LEVEL SECURITY;

-- RLS Policies for trial_extension_requests
CREATE POLICY "trial_extension_requests_insert_admin"
ON public.trial_extension_requests
FOR INSERT
WITH CHECK (
  is_active_company_admin(auth.uid(), company_id) 
  AND is_company_active(company_id)
);

CREATE POLICY "trial_extension_requests_select_company"
ON public.trial_extension_requests
FOR SELECT
USING (is_active_company_admin(auth.uid(), company_id));

CREATE POLICY "trial_extension_requests_select_platform"
ON public.trial_extension_requests
FOR SELECT
USING (is_platform_admin(auth.uid()));

CREATE POLICY "trial_extension_requests_update_platform"
ON public.trial_extension_requests
FOR UPDATE
USING (is_platform_admin(auth.uid()))
WITH CHECK (is_platform_admin(auth.uid()));

CREATE POLICY "trial_extension_requests_delete_platform"
ON public.trial_extension_requests
FOR DELETE
USING (is_platform_admin(auth.uid()));

-- Enable RLS on trial_email_logs
ALTER TABLE public.trial_email_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "trial_email_logs_select_platform"
ON public.trial_email_logs
FOR SELECT
USING (is_platform_admin(auth.uid()));

CREATE POLICY "trial_email_logs_insert_authenticated"
ON public.trial_email_logs
FOR INSERT
WITH CHECK (true);

-- Create indexes for better performance
CREATE INDEX idx_trial_extension_requests_company_id ON public.trial_extension_requests(company_id);
CREATE INDEX idx_trial_extension_requests_status ON public.trial_extension_requests(status);
CREATE INDEX idx_trial_email_logs_company_id ON public.trial_email_logs(company_id);
CREATE INDEX idx_trial_email_logs_sent_at ON public.trial_email_logs(sent_at);

-- Add trigger for updated_at on trial_extension_requests
CREATE TRIGGER update_trial_extension_requests_updated_at
BEFORE UPDATE ON public.trial_extension_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();