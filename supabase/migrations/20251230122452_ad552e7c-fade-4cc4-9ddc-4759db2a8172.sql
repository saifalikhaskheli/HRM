-- Create email_logs table for auditing all emails
CREATE TABLE public.email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  
  -- Email details
  template_type TEXT,
  subject TEXT NOT NULL,
  recipient_email TEXT NOT NULL,
  recipient_name TEXT,
  cc_emails TEXT[],
  bcc_emails TEXT[],
  
  -- Status tracking
  status TEXT NOT NULL DEFAULT 'pending',
  provider TEXT,
  message_id TEXT,
  
  -- Error handling
  error_message TEXT,
  error_code TEXT,
  retry_count INTEGER DEFAULT 0,
  
  -- Context
  triggered_by UUID,
  triggered_from TEXT,
  metadata JSONB DEFAULT '{}',
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  sent_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for performance
CREATE INDEX idx_email_logs_company_id ON public.email_logs(company_id);
CREATE INDEX idx_email_logs_status ON public.email_logs(status);
CREATE INDEX idx_email_logs_created_at ON public.email_logs(created_at DESC);
CREATE INDEX idx_email_logs_recipient ON public.email_logs(recipient_email);

-- Enable RLS
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

-- Company admins can view their company's email logs
CREATE POLICY "email_logs_select_admin"
  ON public.email_logs FOR SELECT
  USING (public.is_active_company_admin(auth.uid(), company_id));

-- Platform admins can view all email logs
CREATE POLICY "email_logs_select_platform_admin"
  ON public.email_logs FOR SELECT
  USING (public.is_platform_admin(auth.uid()));

-- Edge functions can insert logs (using service role)
CREATE POLICY "email_logs_insert_service"
  ON public.email_logs FOR INSERT
  WITH CHECK (true);

-- Edge functions can update logs (using service role)
CREATE POLICY "email_logs_update_service"
  ON public.email_logs FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- Update trigger
CREATE TRIGGER update_email_logs_updated_at
  BEFORE UPDATE ON public.email_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();