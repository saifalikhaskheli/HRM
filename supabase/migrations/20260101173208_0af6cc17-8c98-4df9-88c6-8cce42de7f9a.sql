-- ============================================================
-- PHASE 9: GRANULAR PERMISSIONS FOR EMPLOYEE DATA
-- ============================================================

-- Add new permission actions for granular control
-- Note: permission_action enum already has the needed actions

-- Insert granular permissions for employee module
INSERT INTO public.permissions (module, action, name, description) VALUES
  -- Existing base permissions are already there, add specialized ones
  ('employees', 'export', 'Export Employees', 'Export employee data to CSV/Excel')
ON CONFLICT (module, action) DO NOTHING;

-- Insert permissions for payroll read
INSERT INTO public.permissions (module, action, name, description) VALUES
  ('payroll', 'export', 'Export Payroll', 'Export payroll data and reports')
ON CONFLICT (module, action) DO NOTHING;

-- Insert permissions for documents OCR
INSERT INTO public.permissions (module, action, name, description) VALUES
  ('documents', 'process', 'Process Documents', 'Run OCR and automated processing on documents')
ON CONFLICT (module, action) DO NOTHING;

-- Insert audit export permission
INSERT INTO public.permissions (module, action, name, description) VALUES
  ('audit', 'export', 'Export Audit Logs', 'Export audit logs and security events')
ON CONFLICT (module, action) DO NOTHING;

-- ============================================================
-- HELPER FUNCTIONS FOR SENSITIVE FIELD ACCESS
-- ============================================================

-- Function to check if user can view employee payroll data
CREATE OR REPLACE FUNCTION public.can_view_employee_payroll(_user_id uuid, _company_id uuid, _employee_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    -- Own record
    is_own_employee_record(_user_id, _employee_id)
    -- Or has payroll read permission
    OR has_permission(_user_id, _company_id, 'payroll', 'read')
    -- Or is company admin
    OR is_active_company_admin(_user_id, _company_id)
$$;

-- Function to check if user can view employee personal data
CREATE OR REPLACE FUNCTION public.can_view_employee_personal(_user_id uuid, _company_id uuid, _employee_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    -- Own record
    is_own_employee_record(_user_id, _employee_id)
    -- Or has employees read permission
    OR has_permission(_user_id, _company_id, 'employees', 'read')
    -- Or is manager of employee
    OR is_manager_of_employee(_user_id, _employee_id)
$$;

-- Function to check if user can process OCR
CREATE OR REPLACE FUNCTION public.can_process_document_ocr(_user_id uuid, _company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    company_has_ocr(_company_id)
    AND has_permission(_user_id, _company_id, 'documents', 'process')
$$;

-- ============================================================
-- AUDIT LOGGING FOR SENSITIVE FIELD ACCESS
-- ============================================================

-- Function to log sensitive field access
CREATE OR REPLACE FUNCTION public.log_sensitive_access(
  _company_id uuid,
  _user_id uuid,
  _table_name text,
  _record_id uuid,
  _field_type text,
  _access_type text DEFAULT 'read'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.audit_logs (
    company_id,
    user_id,
    action,
    table_name,
    record_id,
    metadata,
    severity
  ) VALUES (
    _company_id,
    _user_id,
    'read',
    _table_name,
    _record_id,
    jsonb_build_object(
      'field_type', _field_type,
      'access_type', _access_type,
      'sensitive_access', true
    ),
    'info'
  );
END;
$$;

-- ============================================================
-- DOCUMENT EXPIRY NOTIFICATION HELPER
-- ============================================================

-- Function to get documents needing expiry notifications
CREATE OR REPLACE FUNCTION public.get_documents_needing_expiry_notification(_days_before integer DEFAULT 30)
RETURNS TABLE(
  document_id uuid,
  company_id uuid,
  employee_id uuid,
  document_title text,
  document_type_name text,
  employee_email text,
  employee_name text,
  expiry_date date,
  days_until_expiry integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    ed.id as document_id,
    ed.company_id,
    ed.employee_id,
    ed.title as document_title,
    dt.name as document_type_name,
    e.email as employee_email,
    e.first_name || ' ' || e.last_name as employee_name,
    ed.expiry_date,
    (ed.expiry_date - CURRENT_DATE)::integer as days_until_expiry
  FROM public.employee_documents ed
  JOIN public.employees e ON e.id = ed.employee_id
  JOIN public.document_types dt ON dt.id = ed.document_type_id
  WHERE ed.deleted_at IS NULL
    AND ed.expiry_date IS NOT NULL
    AND ed.expiry_date > CURRENT_DATE
    AND ed.expiry_date <= (CURRENT_DATE + (_days_before || ' days')::interval)
    AND ed.expiry_notification_sent = false
    AND ed.verification_status != 'expired'
  ORDER BY ed.expiry_date ASC
$$;

-- Function to mark document expiry notification as sent
CREATE OR REPLACE FUNCTION public.mark_expiry_notification_sent(_document_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.employee_documents
  SET 
    expiry_notification_sent = true,
    expiry_notification_sent_at = now()
  WHERE id = _document_id;
END;
$$;