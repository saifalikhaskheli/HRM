-- Create table to store multi-company access requests
CREATE TABLE public.multi_company_requests (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    user_email TEXT NOT NULL,
    user_name TEXT,
    requested_count INTEGER NOT NULL DEFAULT 2,
    reason TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    reviewed_by UUID,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    review_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add comment
COMMENT ON TABLE public.multi_company_requests IS 'Stores user requests for multi-company access';

-- Enable RLS
ALTER TABLE public.multi_company_requests ENABLE ROW LEVEL SECURITY;

-- Users can insert their own requests
CREATE POLICY "multi_company_requests_insert_own"
ON public.multi_company_requests
FOR INSERT
WITH CHECK (user_id = auth.uid());

-- Users can view their own requests
CREATE POLICY "multi_company_requests_select_own"
ON public.multi_company_requests
FOR SELECT
USING (user_id = auth.uid());

-- Platform admins can view all requests
CREATE POLICY "multi_company_requests_select_platform_admin"
ON public.multi_company_requests
FOR SELECT
USING (is_platform_admin(auth.uid()));

-- Platform admins can update requests (to approve/reject)
CREATE POLICY "multi_company_requests_update_platform_admin"
ON public.multi_company_requests
FOR UPDATE
USING (is_platform_admin(auth.uid()))
WITH CHECK (is_platform_admin(auth.uid()));

-- Platform admins can delete requests
CREATE POLICY "multi_company_requests_delete_platform_admin"
ON public.multi_company_requests
FOR DELETE
USING (is_platform_admin(auth.uid()));

-- Add trigger for updated_at
CREATE TRIGGER update_multi_company_requests_updated_at
BEFORE UPDATE ON public.multi_company_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();