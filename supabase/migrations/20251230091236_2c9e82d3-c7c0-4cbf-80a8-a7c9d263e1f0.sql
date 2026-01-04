-- Create webhooks table for external integrations
CREATE TABLE public.webhooks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  secret TEXT NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  events TEXT[] NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  headers JSONB DEFAULT '{}',
  retry_count INTEGER DEFAULT 3,
  timeout_seconds INTEGER DEFAULT 30,
  last_triggered_at TIMESTAMP WITH TIME ZONE,
  last_status INTEGER,
  failure_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create webhook logs table
CREATE TABLE public.webhook_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  webhook_id UUID NOT NULL REFERENCES public.webhooks(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  response_status INTEGER,
  response_body TEXT,
  duration_ms INTEGER,
  success BOOLEAN NOT NULL DEFAULT false,
  error_message TEXT,
  attempt_number INTEGER DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies for webhooks (platform admins only)
CREATE POLICY "webhooks_select_platform_admin" ON public.webhooks
  FOR SELECT USING (is_platform_admin(auth.uid()));

CREATE POLICY "webhooks_insert_platform_admin" ON public.webhooks
  FOR INSERT WITH CHECK (is_platform_admin(auth.uid()));

CREATE POLICY "webhooks_update_platform_admin" ON public.webhooks
  FOR UPDATE USING (is_platform_admin(auth.uid()))
  WITH CHECK (is_platform_admin(auth.uid()));

CREATE POLICY "webhooks_delete_platform_admin" ON public.webhooks
  FOR DELETE USING (is_platform_admin(auth.uid()));

-- RLS policies for webhook logs
CREATE POLICY "webhook_logs_select_platform_admin" ON public.webhook_logs
  FOR SELECT USING (is_platform_admin(auth.uid()));

CREATE POLICY "webhook_logs_insert_platform_admin" ON public.webhook_logs
  FOR INSERT WITH CHECK (is_platform_admin(auth.uid()));

-- Indexes for performance
CREATE INDEX idx_webhooks_active ON public.webhooks(is_active) WHERE is_active = true;
CREATE INDEX idx_webhooks_events ON public.webhooks USING GIN(events);
CREATE INDEX idx_webhook_logs_webhook_id ON public.webhook_logs(webhook_id);
CREATE INDEX idx_webhook_logs_created_at ON public.webhook_logs(created_at DESC);

-- Trigger for updated_at
CREATE TRIGGER update_webhooks_updated_at
  BEFORE UPDATE ON public.webhooks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();