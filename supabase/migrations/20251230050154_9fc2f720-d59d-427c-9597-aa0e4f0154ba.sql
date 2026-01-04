-- Enable pg_net extension for HTTP calls from triggers
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Function to send leave request notifications
CREATE OR REPLACE FUNCTION public.notify_leave_request_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  notification_type TEXT;
  payload JSONB;
BEGIN
  -- Determine notification type based on status change
  IF TG_OP = 'INSERT' AND NEW.status = 'pending' THEN
    notification_type := 'leave_request_submitted';
  ELSIF TG_OP = 'UPDATE' AND OLD.status != NEW.status THEN
    IF NEW.status = 'approved' THEN
      notification_type := 'leave_request_approved';
    ELSIF NEW.status = 'rejected' THEN
      notification_type := 'leave_request_rejected';
    ELSE
      -- No notification for other status changes
      RETURN NEW;
    END IF;
  ELSE
    RETURN NEW;
  END IF;

  -- Build payload
  payload := jsonb_build_object(
    'type', notification_type,
    'record_id', NEW.id,
    'company_id', NEW.company_id,
    'old_status', COALESCE(OLD.status::text, 'none'),
    'new_status', NEW.status::text
  );

  -- Call edge function asynchronously
  PERFORM extensions.http_post(
    url := 'https://xwfzrbigmgyxsrzlkqwr.supabase.co/functions/v1/send-notification',
    body := payload::text,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh3ZnpyYmlnbWd5eHNyemxrcXdyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcwNDQ5NzIsImV4cCI6MjA4MjYyMDk3Mn0.IAF8SnMuVNOxgznfKiOq7Lvi_LuExXRBxqs26UEhD-o'
    )::jsonb
  );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail the transaction
    RAISE WARNING 'Failed to send leave notification: %', SQLERRM;
    RETURN NEW;
END;
$$;

-- Function to send payroll notifications
CREATE OR REPLACE FUNCTION public.notify_payroll_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  payload JSONB;
BEGIN
  -- Only notify when payroll is marked as completed
  IF TG_OP = 'UPDATE' AND OLD.status != 'completed' AND NEW.status = 'completed' THEN
    payload := jsonb_build_object(
      'type', 'payroll_processed',
      'record_id', NEW.id,
      'company_id', NEW.company_id,
      'old_status', OLD.status::text,
      'new_status', NEW.status::text
    );

    -- Call edge function asynchronously
    PERFORM extensions.http_post(
      url := 'https://xwfzrbigmgyxsrzlkqwr.supabase.co/functions/v1/send-notification',
      body := payload::text,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh3ZnpyYmlnbWd5eHNyemxrcXdyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcwNDQ5NzIsImV4cCI6MjA4MjYyMDk3Mn0.IAF8SnMuVNOxgznfKiOq7Lvi_LuExXRBxqs26UEhD-o'
      )::jsonb
    );
  END IF;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail the transaction
    RAISE WARNING 'Failed to send payroll notification: %', SQLERRM;
    RETURN NEW;
END;
$$;

-- Create trigger for leave request notifications
DROP TRIGGER IF EXISTS trigger_leave_request_notification ON public.leave_requests;
CREATE TRIGGER trigger_leave_request_notification
  AFTER INSERT OR UPDATE OF status ON public.leave_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_leave_request_status_change();

-- Create trigger for payroll notifications  
DROP TRIGGER IF EXISTS trigger_payroll_notification ON public.payroll_runs;
CREATE TRIGGER trigger_payroll_notification
  AFTER UPDATE OF status ON public.payroll_runs
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_payroll_status_change();