import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Loader2, Copy, Check, ExternalLink } from 'lucide-react';

interface Plan {
  id: string;
  name: string;
  trial_enabled: boolean | null;
  trial_default_days: number | null;
}

interface CreateCompanyFormData {
  company_name: string;
  admin_email: string;
  admin_first_name: string;
  admin_last_name: string;
  plan_id: string;
  enable_trial: boolean;
  trial_days: number;
  industry: string;
  send_credentials: boolean;
}

interface CreateLinkFormData {
  plan_id: string;
  email: string;
  enable_trial: boolean;
  trial_days: number;
  expires_in_hours: number;
  notes: string;
}

interface CreateCompanyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateCompanyDialog({ open, onOpenChange }: CreateCompanyDialogProps) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState<CreateCompanyFormData>({
    company_name: '',
    admin_email: '',
    admin_first_name: '',
    admin_last_name: '',
    plan_id: '',
    enable_trial: true,
    trial_days: 14,
    industry: '',
    send_credentials: true,
  });
  const [createdCompany, setCreatedCompany] = useState<any>(null);

  const { data: plans } = useQuery({
    queryKey: ['platform-plans-with-trial'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('plans')
        .select('id, name, trial_enabled, trial_default_days')
        .eq('is_active', true)
        .order('sort_order');
      if (error) throw error;
      return data as Plan[];
    },
  });

  // Update trial settings when plan changes
  const selectedPlan = plans?.find(p => p.id === formData.plan_id);
  
  useEffect(() => {
    if (selectedPlan) {
      const planTrialEnabled = selectedPlan.trial_enabled !== false;
      const planTrialDays = selectedPlan.trial_default_days ?? 14;
      
      setFormData(prev => ({
        ...prev,
        enable_trial: planTrialEnabled,
        trial_days: planTrialDays,
      }));
    }
  }, [formData.plan_id, selectedPlan?.id]);

  const createMutation = useMutation({
    mutationFn: async (data: CreateCompanyFormData) => {
      const { data: result, error } = await supabase.functions.invoke('create-company-admin', {
        body: {
          company_name: data.company_name,
          admin_email: data.admin_email,
          admin_first_name: data.admin_first_name,
          admin_last_name: data.admin_last_name,
          plan_id: data.plan_id || undefined,
          enable_trial: data.enable_trial,
          trial_days: data.trial_days,
          industry: data.industry || undefined,
          send_credentials: data.send_credentials,
        },
      });
      if (error) throw error;
      if (result.error) throw new Error(result.message || result.error);
      return result;
    },
    onSuccess: (data) => {
      setCreatedCompany(data);
      queryClient.invalidateQueries({ queryKey: ['platform-companies'] });
      
      // Show email status feedback
      if (data.email_status === 'sent') {
        toast.success('Company created and credentials email sent');
      } else if (data.email_status === 'failed') {
        toast.warning(`Company created, but email failed: ${data.email_error || 'Unknown error'}`);
      } else if (data.admin?.is_new_user) {
        toast.success('Company created successfully');
      }
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.company_name || !formData.admin_email) {
      toast.error('Company name and admin email are required');
      return;
    }
    createMutation.mutate(formData);
  };

  const handleClose = () => {
    setFormData({
      company_name: '',
      admin_email: '',
      admin_first_name: '',
      admin_last_name: '',
      plan_id: '',
      enable_trial: true,
      trial_days: 14,
      industry: '',
      send_credentials: true,
    });
    setCreatedCompany(null);
    onOpenChange(false);
  };

  const copyPassword = () => {
    if (createdCompany?.admin?.temporary_password) {
      navigator.clipboard.writeText(createdCompany.admin.temporary_password);
      toast.success('Password copied to clipboard');
    }
  };

  // Determine if trial toggle should be shown (only if plan supports trials)
  const planSupportsTrials = !formData.plan_id || selectedPlan?.trial_enabled !== false;

  if (createdCompany) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Check className="h-5 w-5 text-green-500" />
              Company Created Successfully
            </DialogTitle>
            <DialogDescription>
              {createdCompany.company.name} has been set up.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="bg-muted rounded-lg p-4 space-y-3">
              <div>
                <p className="text-sm text-muted-foreground">Company URL</p>
                <div className="flex items-center gap-2">
                  <code className="text-sm bg-background px-2 py-1 rounded flex-1 truncate">
                    {createdCompany.domain.full_url}
                  </code>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => window.open(createdCompany.domain.full_url, '_blank')}
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              
              <div>
                <p className="text-sm text-muted-foreground">Admin Email</p>
                <p className="font-mono">{createdCompany.admin.email}</p>
              </div>
              
              {createdCompany.admin.is_new_user && createdCompany.admin.temporary_password && (
                <div>
                  <p className="text-sm text-muted-foreground">Temporary Password</p>
                  <div className="flex items-center gap-2">
                    <code className="text-sm bg-background px-2 py-1 rounded flex-1 font-mono">
                      {createdCompany.admin.temporary_password}
                    </code>
                    <Button size="icon" variant="ghost" onClick={copyPassword}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-destructive mt-1">
                    User will be required to change password on first login
                  </p>
                </div>
              )}
            </div>
          </div>
          
          <DialogFooter>
            <Button onClick={handleClose}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Company</DialogTitle>
          <DialogDescription>
            Create a new company and its primary admin account
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Company Name *</Label>
            <Input
              value={formData.company_name}
              onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
              placeholder="Acme Corporation"
              required
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Admin First Name</Label>
              <Input
                value={formData.admin_first_name}
                onChange={(e) => setFormData({ ...formData, admin_first_name: e.target.value })}
                placeholder="John"
              />
            </div>
            <div className="space-y-2">
              <Label>Admin Last Name</Label>
              <Input
                value={formData.admin_last_name}
                onChange={(e) => setFormData({ ...formData, admin_last_name: e.target.value })}
                placeholder="Doe"
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <Label>Admin Email *</Label>
            <Input
              type="email"
              value={formData.admin_email}
              onChange={(e) => setFormData({ ...formData, admin_email: e.target.value })}
              placeholder="admin@company.com"
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label>Plan</Label>
            <Select
              value={formData.plan_id}
              onValueChange={(value) => setFormData({ ...formData, plan_id: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select plan" />
              </SelectTrigger>
              <SelectContent>
                {plans?.map((plan) => (
                  <SelectItem key={plan.id} value={plan.id}>
                    {plan.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Trial Configuration */}
          {planSupportsTrials ? (
            <div className="space-y-3 p-3 border rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Enable Trial Period</Label>
                  <p className="text-sm text-muted-foreground">Start with a trial before billing</p>
                </div>
                <Switch
                  checked={formData.enable_trial}
                  onCheckedChange={(checked) => setFormData({ ...formData, enable_trial: checked })}
                />
              </div>
              
              {formData.enable_trial && (
                <div className="space-y-2">
                  <Label>Trial Days</Label>
                  <Input
                    type="number"
                    min={1}
                    value={formData.trial_days}
                    onChange={(e) => setFormData({ ...formData, trial_days: parseInt(e.target.value) || 14 })}
                  />
                </div>
              )}
            </div>
          ) : (
            <div className="p-3 border rounded-lg bg-muted/50">
              <p className="text-sm text-muted-foreground">
                This plan does not include a trial period. Company will start with an active subscription.
              </p>
            </div>
          )}
          
          <div className="space-y-2">
            <Label>Industry</Label>
            <Select
              value={formData.industry}
              onValueChange={(value) => setFormData({ ...formData, industry: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select industry" />
              </SelectTrigger>
              <SelectContent>
                {['Technology', 'Healthcare', 'Finance', 'Manufacturing', 'Retail', 'Education', 'Consulting', 'Other'].map((ind) => (
                  <SelectItem key={ind} value={ind}>
                    {ind}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex items-center justify-between py-2">
            <div>
              <Label>Send Credentials Email</Label>
              <p className="text-sm text-muted-foreground">Email login details to admin</p>
            </div>
            <Switch
              checked={formData.send_credentials}
              onCheckedChange={(checked) => setFormData({ ...formData, send_credentials: checked })}
            />
          </div>
          
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Company
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface CreateLinkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateLinkDialog({ open, onOpenChange }: CreateLinkDialogProps) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState<CreateLinkFormData>({
    plan_id: '',
    email: '',
    enable_trial: true,
    trial_days: 14,
    expires_in_hours: 72,
    notes: '',
  });
  const [createdLink, setCreatedLink] = useState<any>(null);
  const [copied, setCopied] = useState(false);

  const { data: plans } = useQuery({
    queryKey: ['platform-plans-with-trial'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('plans')
        .select('id, name, trial_enabled, trial_default_days')
        .eq('is_active', true)
        .order('sort_order');
      if (error) throw error;
      return data as Plan[];
    },
  });

  // Update trial settings when plan changes
  const selectedPlan = plans?.find(p => p.id === formData.plan_id);
  
  useEffect(() => {
    if (selectedPlan) {
      const planTrialEnabled = selectedPlan.trial_enabled !== false;
      const planTrialDays = selectedPlan.trial_default_days ?? 14;
      
      setFormData(prev => ({
        ...prev,
        enable_trial: planTrialEnabled,
        trial_days: planTrialDays,
      }));
    }
  }, [formData.plan_id, selectedPlan?.id]);

  const createMutation = useMutation({
    mutationFn: async (data: CreateLinkFormData) => {
      const { data: result, error } = await supabase.functions.invoke('create-company-link', {
        body: {
          plan_id: data.plan_id || undefined,
          email: data.email || undefined,
          enable_trial: data.enable_trial,
          trial_days: data.trial_days,
          expires_in_hours: data.expires_in_hours,
          notes: data.notes || undefined,
        },
      });
      if (error) throw error;
      if (result.error) throw new Error(result.message || result.error);
      return result;
    },
    onSuccess: (data) => {
      setCreatedLink(data.link);
      queryClient.invalidateQueries({ queryKey: ['company-creation-links'] });
      
      // Show email status feedback
      if (data.email_status === 'sent') {
        toast.success('Link created and email sent');
      } else if (data.email_status === 'failed') {
        toast.warning(`Link created, but email failed: ${data.email_error || 'Unknown error'}`);
      } else {
        toast.success('Link created successfully');
      }
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(formData);
  };

  const handleClose = () => {
    setFormData({
      plan_id: '',
      email: '',
      enable_trial: true,
      trial_days: 14,
      expires_in_hours: 72,
      notes: '',
    });
    setCreatedLink(null);
    setCopied(false);
    onOpenChange(false);
  };

  const copyLink = () => {
    if (createdLink?.signup_url) {
      navigator.clipboard.writeText(createdLink.signup_url);
      setCopied(true);
      toast.success('Link copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Determine if trial toggle should be shown (only if plan supports trials)
  const planSupportsTrials = !formData.plan_id || selectedPlan?.trial_enabled !== false;

  if (createdLink) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Check className="h-5 w-5 text-green-500" />
              Link Created Successfully
            </DialogTitle>
            <DialogDescription>
              Share this link with your client to let them set up their company.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="bg-muted rounded-lg p-4 space-y-3">
              <div>
                <p className="text-sm text-muted-foreground mb-2">Signup Link</p>
                <div className="flex items-center gap-2">
                  <Input
                    readOnly
                    value={createdLink.signup_url}
                    className="font-mono text-sm"
                  />
                  <Button size="icon" variant={copied ? 'default' : 'outline'} onClick={copyLink}>
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              
              <div className="flex gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Expires</p>
                  <p>{new Date(createdLink.expires_at).toLocaleDateString()}</p>
                </div>
                {createdLink.email && (
                  <div>
                    <p className="text-muted-foreground">Restricted to</p>
                    <p>{createdLink.email}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button onClick={handleClose}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Company Setup Link</DialogTitle>
          <DialogDescription>
            Generate a secure, single-use link for a client to set up their company
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Assigned Plan</Label>
            <Select
              value={formData.plan_id}
              onValueChange={(value) => setFormData({ ...formData, plan_id: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select plan (optional)" />
              </SelectTrigger>
              <SelectContent>
                {plans?.map((plan) => (
                  <SelectItem key={plan.id} value={plan.id}>
                    {plan.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label>Restrict to Email (optional)</Label>
            <Input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="client@company.com"
            />
            <p className="text-xs text-muted-foreground">
              If set, only this email can use the link
            </p>
          </div>

          {/* Trial Configuration */}
          {planSupportsTrials ? (
            <div className="space-y-3 p-3 border rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Enable Trial Period</Label>
                  <p className="text-sm text-muted-foreground">Start with a trial before billing</p>
                </div>
                <Switch
                  checked={formData.enable_trial}
                  onCheckedChange={(checked) => setFormData({ ...formData, enable_trial: checked })}
                />
              </div>
              
              {formData.enable_trial && (
                <div className="space-y-2">
                  <Label>Trial Days</Label>
                  <Input
                    type="number"
                    min={1}
                    value={formData.trial_days}
                    onChange={(e) => setFormData({ ...formData, trial_days: parseInt(e.target.value) || 14 })}
                  />
                </div>
              )}
            </div>
          ) : (
            <div className="p-3 border rounded-lg bg-muted/50">
              <p className="text-sm text-muted-foreground">
                This plan does not include a trial period. Company will start with an active subscription.
              </p>
            </div>
          )}
          
          <div className="space-y-2">
            <Label>Link Expires In</Label>
            <Select
              value={formData.expires_in_hours.toString()}
              onValueChange={(value) => setFormData({ ...formData, expires_in_hours: parseInt(value) })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="24">24 hours (1 day)</SelectItem>
                <SelectItem value="72">72 hours (3 days)</SelectItem>
                <SelectItem value="168">168 hours (7 days)</SelectItem>
                <SelectItem value="720">720 hours (30 days)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label>Internal Notes</Label>
            <Input
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="e.g., Client name, sales rep"
            />
          </div>
          
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Generate Link
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
