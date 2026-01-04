import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Clock, Loader2, CheckCircle, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

export interface TrialExtensionRequestDialogProps {
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function TrialExtensionRequestDialog({ trigger, open: controlledOpen, onOpenChange }: TrialExtensionRequestDialogProps) {
  const { companyId, isTrialing } = useTenant();
  const queryClient = useQueryClient();
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = onOpenChange || setInternalOpen;
  const [reason, setReason] = useState('');
  const [requestedDays, setRequestedDays] = useState('7');

  // Fetch existing pending request
  const { data: pendingRequest } = useQuery({
    queryKey: ['trial-extension-request', companyId],
    queryFn: async () => {
      if (!companyId) return null;
      const { data } = await supabase
        .from('trial_extension_requests')
        .select('*')
        .eq('company_id', companyId)
        .eq('status', 'pending')
        .maybeSingle();
      return data;
    },
    enabled: !!companyId && open,
  });

  // Fetch extension count
  const { data: extensionCount } = useQuery({
    queryKey: ['trial-extension-count', companyId],
    queryFn: async () => {
      if (!companyId) return 0;
      const { count } = await supabase
        .from('trial_extension_requests')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .eq('status', 'approved');
      return count || 0;
    },
    enabled: !!companyId && open,
  });

  // Fetch platform settings
  const { data: trialSettings } = useQuery({
    queryKey: ['platform-trial-settings'],
    queryFn: async () => {
      const { data } = await supabase
        .from('platform_settings')
        .select('value')
        .eq('key', 'trial')
        .maybeSingle();
      return (data?.value as { extend_allowed?: boolean; max_extensions?: number }) || 
        { extend_allowed: true, max_extensions: 2 };
    },
    enabled: open,
  });

  const maxExtensions = trialSettings?.max_extensions || 2;
  const canRequestExtension = trialSettings?.extend_allowed && (extensionCount || 0) < maxExtensions;

  const submitMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('request-trial-extension', {
        body: {
          companyId,
          requestedDays: parseInt(requestedDays),
          reason,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      toast.success('Extension request submitted successfully');
      queryClient.invalidateQueries({ queryKey: ['trial-extension-request', companyId] });
      setReason('');
      setOpen(false);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to submit request');
    },
  });

  if (!isTrialing) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className="gap-2">
            <Clock className="h-4 w-4" />
            Request Extension
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Request Trial Extension</DialogTitle>
          <DialogDescription>
            Need more time to evaluate? Request an extension of your trial period.
          </DialogDescription>
        </DialogHeader>

        {pendingRequest ? (
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              You have a pending extension request for {pendingRequest.requested_days} days. 
              We'll notify you once it's reviewed.
            </AlertDescription>
          </Alert>
        ) : !canRequestExtension ? (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              {!trialSettings?.extend_allowed 
                ? 'Trial extensions are not available.'
                : `You've used all ${maxExtensions} available extensions.`}
            </AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              Extensions used: {extensionCount || 0} of {maxExtensions}
            </div>

            <div className="space-y-2">
              <Label>How many additional days do you need?</Label>
              <RadioGroup value={requestedDays} onValueChange={setRequestedDays}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="7" id="7days" />
                  <Label htmlFor="7days">7 days</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="14" id="14days" />
                  <Label htmlFor="14days">14 days</Label>
                </div>
              </RadioGroup>
            </div>

            <div className="space-y-2">
              <Label htmlFor="reason">Why do you need more time?</Label>
              <Textarea
                id="reason"
                placeholder="e.g., Still evaluating features, need to involve more team members..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          {canRequestExtension && !pendingRequest && (
            <Button 
              onClick={() => submitMutation.mutate()} 
              disabled={!reason.trim() || submitMutation.isPending}
            >
              {submitMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : (
                'Submit Request'
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
