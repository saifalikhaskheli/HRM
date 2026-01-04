-- =============================================
-- DOCUMENT MODULE HARDENING MIGRATION
-- Phase 1: Schema updates for security & compliance
-- =============================================

-- 1. Create document verification status enum
CREATE TYPE public.document_verification_status AS ENUM (
    'pending',
    'verified',
    'rejected',
    'expired'
);

-- 2. Add new columns to employee_documents for soft delete, versioning, and enhanced verification
ALTER TABLE public.employee_documents
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES public.employees(id) DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS verification_status public.document_verification_status DEFAULT 'pending',
    ADD COLUMN IF NOT EXISTS rejection_reason TEXT DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS version_number INTEGER DEFAULT 1,
    ADD COLUMN IF NOT EXISTS parent_document_id UUID REFERENCES public.employee_documents(id) DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS is_latest_version BOOLEAN DEFAULT true,
    ADD COLUMN IF NOT EXISTS access_count INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS last_accessed_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS last_accessed_by UUID DEFAULT NULL;

-- 3. Migrate existing is_verified data to new verification_status
UPDATE public.employee_documents 
SET verification_status = CASE 
    WHEN is_verified = true THEN 'verified'::document_verification_status
    ELSE 'pending'::document_verification_status
END
WHERE verification_status IS NULL OR verification_status = 'pending';

-- 4. Create document access log table for audit trail
CREATE TABLE IF NOT EXISTS public.document_access_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES public.employee_documents(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    accessed_by UUID NOT NULL,
    access_type TEXT NOT NULL CHECK (access_type IN ('view', 'download', 'preview')),
    ip_address_masked TEXT,
    user_agent TEXT,
    access_granted BOOLEAN NOT NULL DEFAULT true,
    denial_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 5. Create indexes for document access logs
CREATE INDEX idx_document_access_logs_document ON public.document_access_logs(document_id);
CREATE INDEX idx_document_access_logs_company ON public.document_access_logs(company_id);
CREATE INDEX idx_document_access_logs_accessed_by ON public.document_access_logs(accessed_by);
CREATE INDEX idx_document_access_logs_created_at ON public.document_access_logs(created_at DESC);

-- 6. Enable RLS on document access logs
ALTER TABLE public.document_access_logs ENABLE ROW LEVEL SECURITY;

-- 7. RLS policies for document_access_logs - tenant isolated
CREATE POLICY "document_access_logs_insert_service"
ON public.document_access_logs FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "document_access_logs_select_admin"
ON public.document_access_logs FOR SELECT
TO authenticated
USING (public.is_active_company_admin(auth.uid(), company_id));

-- Platform admins should NOT see document access logs (privacy)
-- Intentionally no platform admin policy here

-- 8. Add index for soft delete queries
CREATE INDEX idx_employee_documents_deleted_at ON public.employee_documents(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_employee_documents_version ON public.employee_documents(parent_document_id, version_number DESC);
CREATE INDEX idx_employee_documents_verification_status ON public.employee_documents(verification_status);

-- 9. Create function to check document permissions
CREATE OR REPLACE FUNCTION public.can_access_document(_user_id uuid, _document_id uuid, _action text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    _company_id uuid;
    _employee_id uuid;
    _doc_employee_id uuid;
    _is_own boolean;
    _is_manager boolean;
BEGIN
    -- Get document info
    SELECT company_id, employee_id INTO _company_id, _doc_employee_id
    FROM public.employee_documents
    WHERE id = _document_id AND deleted_at IS NULL;
    
    IF _company_id IS NULL THEN
        RETURN false;
    END IF;
    
    -- Check module access
    IF NOT public.can_use_documents(_user_id, _company_id) THEN
        RETURN false;
    END IF;
    
    -- Get user's employee record
    SELECT id INTO _employee_id
    FROM public.employees
    WHERE user_id = _user_id AND company_id = _company_id;
    
    -- Check if own document
    _is_own := _employee_id = _doc_employee_id;
    
    -- Check if manager of document owner
    _is_manager := public.is_manager_of_employee(_user_id, _doc_employee_id);
    
    -- Permission checks based on action
    CASE _action
        WHEN 'read' THEN
            -- Own, manager, or has permission
            RETURN _is_own 
                OR _is_manager 
                OR public.has_permission(_user_id, _company_id, 'documents', 'read');
        WHEN 'create' THEN
            RETURN public.has_permission(_user_id, _company_id, 'documents', 'create')
                OR (_is_own AND public.is_active_company_member(_user_id, _company_id));
        WHEN 'update' THEN
            RETURN public.has_permission(_user_id, _company_id, 'documents', 'update');
        WHEN 'delete' THEN
            RETURN public.has_permission(_user_id, _company_id, 'documents', 'delete');
        WHEN 'verify' THEN
            RETURN public.has_permission(_user_id, _company_id, 'documents', 'verify');
        ELSE
            RETURN false;
    END CASE;
END;
$$;

-- 10. Create function to log document access
CREATE OR REPLACE FUNCTION public.log_document_access(
    _document_id uuid,
    _access_type text,
    _ip_address text DEFAULT NULL,
    _user_agent text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    _log_id uuid;
    _company_id uuid;
    _user_id uuid;
BEGIN
    _user_id := auth.uid();
    
    -- Get company from document
    SELECT company_id INTO _company_id
    FROM public.employee_documents
    WHERE id = _document_id;
    
    -- Insert access log
    INSERT INTO public.document_access_logs (
        document_id,
        company_id,
        accessed_by,
        access_type,
        ip_address_masked,
        user_agent,
        access_granted
    ) VALUES (
        _document_id,
        _company_id,
        _user_id,
        _access_type,
        public.mask_ip_address(_ip_address),
        public.truncate_user_agent(_user_agent),
        true
    ) RETURNING id INTO _log_id;
    
    -- Update document access stats
    UPDATE public.employee_documents
    SET access_count = COALESCE(access_count, 0) + 1,
        last_accessed_at = now(),
        last_accessed_by = _user_id
    WHERE id = _document_id;
    
    RETURN _log_id;
END;
$$;

-- 11. Create function for soft delete
CREATE OR REPLACE FUNCTION public.soft_delete_document(_document_id uuid, _employee_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    _company_id uuid;
    _file_path text;
BEGIN
    -- Check permission
    IF NOT public.can_access_document(auth.uid(), _document_id, 'delete') THEN
        RAISE EXCEPTION 'Not authorized to delete this document';
    END IF;
    
    -- Get document info
    SELECT company_id, file_url INTO _company_id, _file_path
    FROM public.employee_documents
    WHERE id = _document_id AND deleted_at IS NULL;
    
    IF _company_id IS NULL THEN
        RAISE EXCEPTION 'Document not found';
    END IF;
    
    -- Soft delete the document
    UPDATE public.employee_documents
    SET deleted_at = now(),
        deleted_by = _employee_id
    WHERE id = _document_id;
    
    -- Log the action
    PERFORM public.log_audit_event(
        _company_id,
        auth.uid(),
        'delete',
        'employee_documents',
        _document_id,
        jsonb_build_object('file_path', _file_path),
        NULL,
        jsonb_build_object('soft_delete', true)
    );
    
    RETURN true;
END;
$$;

-- 12. Create function for document verification with status
CREATE OR REPLACE FUNCTION public.verify_document(
    _document_id uuid,
    _status document_verification_status,
    _verifier_employee_id uuid,
    _rejection_reason text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    _company_id uuid;
    _old_status document_verification_status;
BEGIN
    -- Check permission
    IF NOT public.can_access_document(auth.uid(), _document_id, 'verify') THEN
        RAISE EXCEPTION 'Not authorized to verify this document';
    END IF;
    
    -- Get current state
    SELECT company_id, verification_status INTO _company_id, _old_status
    FROM public.employee_documents
    WHERE id = _document_id AND deleted_at IS NULL;
    
    IF _company_id IS NULL THEN
        RAISE EXCEPTION 'Document not found';
    END IF;
    
    -- Validate status transition
    IF _old_status = 'verified' AND _status != 'expired' THEN
        RAISE EXCEPTION 'Cannot change status of verified document';
    END IF;
    
    -- Require rejection reason if rejecting
    IF _status = 'rejected' AND (_rejection_reason IS NULL OR _rejection_reason = '') THEN
        RAISE EXCEPTION 'Rejection reason is required';
    END IF;
    
    -- Update document
    UPDATE public.employee_documents
    SET verification_status = _status,
        verified_by = _verifier_employee_id,
        verified_at = now(),
        is_verified = (_status = 'verified'),
        rejection_reason = _rejection_reason
    WHERE id = _document_id;
    
    -- Log the action
    PERFORM public.log_audit_event(
        _company_id,
        auth.uid(),
        'update',
        'employee_documents',
        _document_id,
        jsonb_build_object('verification_status', _old_status::text),
        jsonb_build_object('verification_status', _status::text, 'rejection_reason', _rejection_reason),
        jsonb_build_object('action_type', 'verify_document')
    );
    
    RETURN true;
END;
$$;

-- 13. Drop old RLS policies and create new permission-based ones
DROP POLICY IF EXISTS "employee_documents_select_own" ON public.employee_documents;
DROP POLICY IF EXISTS "employee_documents_select_hr" ON public.employee_documents;
DROP POLICY IF EXISTS "employee_documents_select_manager" ON public.employee_documents;
DROP POLICY IF EXISTS "employee_documents_insert_own" ON public.employee_documents;
DROP POLICY IF EXISTS "employee_documents_insert_hr" ON public.employee_documents;
DROP POLICY IF EXISTS "employee_documents_update" ON public.employee_documents;
DROP POLICY IF EXISTS "employee_documents_delete" ON public.employee_documents;
DROP POLICY IF EXISTS "Employees can view own documents" ON public.employee_documents;
DROP POLICY IF EXISTS "HR can manage all documents" ON public.employee_documents;

-- New permission-based RLS policies
CREATE POLICY "documents_select_permission"
ON public.employee_documents FOR SELECT
TO authenticated
USING (
    deleted_at IS NULL
    AND public.can_use_documents(auth.uid(), company_id)
    AND (
        -- Own documents
        public.is_own_employee_record(auth.uid(), employee_id)
        -- Manager of employee
        OR public.is_manager_of_employee(auth.uid(), employee_id)
        -- Has read permission
        OR public.has_permission(auth.uid(), company_id, 'documents', 'read')
    )
);

CREATE POLICY "documents_insert_permission"
ON public.employee_documents FOR INSERT
TO authenticated
WITH CHECK (
    public.can_use_documents(auth.uid(), company_id)
    AND public.guard_write_operation(company_id)
    AND (
        -- Own documents (employees can upload their own)
        public.is_own_employee_record(auth.uid(), employee_id)
        -- Has create permission
        OR public.has_permission(auth.uid(), company_id, 'documents', 'create')
    )
);

CREATE POLICY "documents_update_permission"
ON public.employee_documents FOR UPDATE
TO authenticated
USING (
    deleted_at IS NULL
    AND public.can_use_documents(auth.uid(), company_id)
    AND public.has_permission(auth.uid(), company_id, 'documents', 'update')
)
WITH CHECK (
    public.guard_write_operation(company_id)
);

-- Delete policy - only soft delete allowed via function
CREATE POLICY "documents_delete_permission"
ON public.employee_documents FOR DELETE
TO authenticated
USING (
    public.can_use_documents(auth.uid(), company_id)
    AND public.has_permission(auth.uid(), company_id, 'documents', 'delete')
);

-- 14. Add document storage limits to plans features
-- This is tracked in plan features JSON: { "documents": { "max_storage_mb": 1000, "max_per_employee": 50 } }

-- 15. Create function to check document limits
CREATE OR REPLACE FUNCTION public.check_document_limits(_company_id uuid, _employee_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    _plan_features jsonb;
    _max_storage_mb integer;
    _max_per_employee integer;
    _current_storage_bytes bigint;
    _current_count integer;
    _result jsonb;
BEGIN
    -- Get plan features
    SELECT p.features INTO _plan_features
    FROM public.company_subscriptions cs
    JOIN public.plans p ON p.id = cs.plan_id
    WHERE cs.company_id = _company_id
    AND cs.status IN ('active', 'trialing');
    
    -- Get limits (default to unlimited if not set)
    _max_storage_mb := COALESCE((_plan_features->'documents'->>'max_storage_mb')::integer, -1);
    _max_per_employee := COALESCE((_plan_features->'documents'->>'max_per_employee')::integer, -1);
    
    -- Get current usage
    SELECT COALESCE(SUM(file_size), 0), COUNT(*)
    INTO _current_storage_bytes, _current_count
    FROM public.employee_documents
    WHERE company_id = _company_id
    AND employee_id = _employee_id
    AND deleted_at IS NULL;
    
    _result := jsonb_build_object(
        'max_storage_mb', _max_storage_mb,
        'max_per_employee', _max_per_employee,
        'current_storage_bytes', _current_storage_bytes,
        'current_count', _current_count,
        'can_upload', (
            (_max_storage_mb = -1 OR (_current_storage_bytes / 1024 / 1024) < _max_storage_mb)
            AND (_max_per_employee = -1 OR _current_count < _max_per_employee)
        )
    );
    
    RETURN _result;
END;
$$;

-- 16. Create trigger to auto-expire documents
CREATE OR REPLACE FUNCTION public.check_document_expiry()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Auto-set status to expired if expiry date passed
    IF NEW.expiry_date IS NOT NULL 
       AND NEW.expiry_date < CURRENT_DATE 
       AND NEW.verification_status != 'expired' THEN
        NEW.verification_status := 'expired';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER document_expiry_check
BEFORE INSERT OR UPDATE ON public.employee_documents
FOR EACH ROW
EXECUTE FUNCTION public.check_document_expiry();

-- 17. Add company storage tracking view
CREATE OR REPLACE VIEW public.company_document_stats AS
SELECT 
    company_id,
    COUNT(*) FILTER (WHERE deleted_at IS NULL) as total_documents,
    COUNT(*) FILTER (WHERE deleted_at IS NULL AND verification_status = 'verified') as verified_documents,
    COUNT(*) FILTER (WHERE deleted_at IS NULL AND verification_status = 'pending') as pending_documents,
    COUNT(*) FILTER (WHERE deleted_at IS NULL AND verification_status = 'expired') as expired_documents,
    COALESCE(SUM(file_size) FILTER (WHERE deleted_at IS NULL), 0) as total_storage_bytes,
    COUNT(DISTINCT employee_id) FILTER (WHERE deleted_at IS NULL) as employees_with_documents
FROM public.employee_documents
GROUP BY company_id;