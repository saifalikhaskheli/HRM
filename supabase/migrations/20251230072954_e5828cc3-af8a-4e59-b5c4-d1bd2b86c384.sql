-- Create trusted devices table to track user devices
CREATE TABLE public.trusted_devices (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    device_fingerprint TEXT NOT NULL,
    device_name TEXT NOT NULL,
    browser TEXT,
    os TEXT,
    last_used_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    first_seen_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    is_current BOOLEAN DEFAULT false,
    is_trusted BOOLEAN DEFAULT true,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create unique constraint on user_id + device_fingerprint
CREATE UNIQUE INDEX trusted_devices_user_fingerprint_idx ON public.trusted_devices(user_id, device_fingerprint);

-- Enable RLS
ALTER TABLE public.trusted_devices ENABLE ROW LEVEL SECURITY;

-- Users can only view their own devices
CREATE POLICY "trusted_devices_select_own"
ON public.trusted_devices
FOR SELECT
USING (user_id = auth.uid());

-- Users can insert their own devices
CREATE POLICY "trusted_devices_insert_own"
ON public.trusted_devices
FOR INSERT
WITH CHECK (user_id = auth.uid());

-- Users can update their own devices
CREATE POLICY "trusted_devices_update_own"
ON public.trusted_devices
FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Users can delete their own devices
CREATE POLICY "trusted_devices_delete_own"
ON public.trusted_devices
FOR DELETE
USING (user_id = auth.uid());

-- Add trigger for updated_at
CREATE TRIGGER update_trusted_devices_updated_at
BEFORE UPDATE ON public.trusted_devices
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();