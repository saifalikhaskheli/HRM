-- Create storage bucket for company logos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'company-logos',
  'company-logos',
  true,
  2097152, -- 2MB
  ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp']
);

-- Allow company admins to upload logos to their company folder
CREATE POLICY "Company admins can upload logos"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'company-logos'
  AND is_active_company_admin(auth.uid(), (storage.foldername(name))[1]::uuid)
);

-- Allow company admins to update logos in their company folder
CREATE POLICY "Company admins can update logos"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'company-logos'
  AND is_active_company_admin(auth.uid(), (storage.foldername(name))[1]::uuid)
)
WITH CHECK (
  bucket_id = 'company-logos'
  AND is_active_company_admin(auth.uid(), (storage.foldername(name))[1]::uuid)
);

-- Allow company admins to delete logos in their company folder
CREATE POLICY "Company admins can delete logos"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'company-logos'
  AND is_active_company_admin(auth.uid(), (storage.foldername(name))[1]::uuid)
);

-- Public read access for company logos (they're public)
CREATE POLICY "Public can view company logos"
ON storage.objects
FOR SELECT
USING (bucket_id = 'company-logos');