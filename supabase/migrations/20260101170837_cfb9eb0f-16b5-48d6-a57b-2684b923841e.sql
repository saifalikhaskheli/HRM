-- Fix security definer view issue by recreating without security definer
DROP VIEW IF EXISTS public.company_document_stats;

CREATE VIEW public.company_document_stats 
WITH (security_invoker = true)
AS
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