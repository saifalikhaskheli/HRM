-- Create storage bucket for employee documents
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'employee-documents',
  'employee-documents',
  false,
  52428800, -- 50MB limit
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
);

-- RLS policies for employee documents bucket
CREATE POLICY "HR can upload documents"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'employee-documents' 
  AND EXISTS (
    SELECT 1 FROM company_users cu
    WHERE cu.user_id = auth.uid()
    AND cu.is_active = true
    AND cu.role IN ('super_admin', 'company_admin', 'hr_manager')
    AND cu.company_id::text = (storage.foldername(name))[1]
  )
);

CREATE POLICY "Employees can upload own documents"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'employee-documents'
  AND EXISTS (
    SELECT 1 FROM employees e
    WHERE e.user_id = auth.uid()
    AND e.id::text = (storage.foldername(name))[2]
  )
);

CREATE POLICY "HR can view all documents"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'employee-documents'
  AND EXISTS (
    SELECT 1 FROM company_users cu
    WHERE cu.user_id = auth.uid()
    AND cu.is_active = true
    AND cu.role IN ('super_admin', 'company_admin', 'hr_manager')
    AND cu.company_id::text = (storage.foldername(name))[1]
  )
);

CREATE POLICY "Employees can view own documents"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'employee-documents'
  AND EXISTS (
    SELECT 1 FROM employees e
    WHERE e.user_id = auth.uid()
    AND e.id::text = (storage.foldername(name))[2]
  )
);

CREATE POLICY "HR can delete documents"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'employee-documents'
  AND EXISTS (
    SELECT 1 FROM company_users cu
    WHERE cu.user_id = auth.uid()
    AND cu.is_active = true
    AND cu.role IN ('super_admin', 'company_admin', 'hr_manager')
    AND cu.company_id::text = (storage.foldername(name))[1]
  )
);