-- Create enum for subdomain change request status
CREATE TYPE subdomain_request_status AS ENUM ('pending', 'approved', 'rejected');

-- Create subdomain change requests table
CREATE TABLE public.subdomain_change_requests (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    current_subdomain TEXT NOT NULL,
    requested_subdomain TEXT NOT NULL,
    reason TEXT,
    status subdomain_request_status NOT NULL DEFAULT 'pending',
    requested_by UUID NOT NULL,
    reviewed_by UUID,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    review_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for faster lookups
CREATE INDEX idx_subdomain_requests_company ON public.subdomain_change_requests(company_id);
CREATE INDEX idx_subdomain_requests_status ON public.subdomain_change_requests(status);
CREATE INDEX idx_subdomain_requests_subdomain ON public.subdomain_change_requests(requested_subdomain);

-- Enable RLS
ALTER TABLE public.subdomain_change_requests ENABLE ROW LEVEL SECURITY;

-- Company admins can view their own requests
CREATE POLICY "subdomain_requests_select_company" ON public.subdomain_change_requests
    FOR SELECT USING (is_active_company_admin(auth.uid(), company_id));

-- Company admins can create requests for their company
CREATE POLICY "subdomain_requests_insert_company" ON public.subdomain_change_requests
    FOR INSERT WITH CHECK (
        is_active_company_admin(auth.uid(), company_id) 
        AND requested_by = auth.uid()
    );

-- Platform admins can view all requests
CREATE POLICY "subdomain_requests_select_platform" ON public.subdomain_change_requests
    FOR SELECT USING (is_platform_admin(auth.uid()));

-- Platform admins can update requests (approve/reject)
CREATE POLICY "subdomain_requests_update_platform" ON public.subdomain_change_requests
    FOR UPDATE USING (is_platform_admin(auth.uid()))
    WITH CHECK (is_platform_admin(auth.uid()));

-- Platform admins can delete requests
CREATE POLICY "subdomain_requests_delete_platform" ON public.subdomain_change_requests
    FOR DELETE USING (is_platform_admin(auth.uid()));

-- Create function to check subdomain availability
CREATE OR REPLACE FUNCTION public.check_subdomain_availability(subdomain_to_check TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
    SELECT NOT EXISTS (
        -- Check if subdomain exists in company_domains
        SELECT 1 FROM public.company_domains 
        WHERE subdomain = subdomain_to_check 
        AND is_active = true
    ) AND NOT EXISTS (
        -- Check if subdomain is in pending requests
        SELECT 1 FROM public.subdomain_change_requests 
        WHERE requested_subdomain = subdomain_to_check 
        AND status = 'pending'
    )
$$;

-- Add trigger for updated_at
CREATE TRIGGER update_subdomain_requests_updated_at
    BEFORE UPDATE ON public.subdomain_change_requests
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();