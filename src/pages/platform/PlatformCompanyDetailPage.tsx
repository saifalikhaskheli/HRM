import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import {
  ArrowLeft, 
  Building2, 
  Users, 
  CreditCard, 
  Calendar,
  Mail,
  Globe,
  Briefcase,
  HardDrive,
  UserCheck,
  Eye,
  AlertTriangle,
  Gift,
  Check,
  X,
  Shield
} from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { format } from 'date-fns';
import { useImpersonation } from '@/contexts/ImpersonationContext';
import { useState } from 'react';
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

export default function PlatformCompanyDetailPage() {
  const { companyId } = useParams<{ companyId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { startImpersonation } = useImpersonation();

  // Fetch company details
  const { data: company, isLoading: isLoadingCompany } = useQuery({
    queryKey: ['platform-company', companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .eq('id', companyId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!companyId,
  });

  // Fetch subscription
  const { data: subscription, isLoading: isLoadingSub } = useQuery({
    queryKey: ['platform-company-subscription', companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('company_subscriptions')
        .select('*, plans(name, price_monthly, max_employees, max_storage_gb)')
        .eq('company_id', companyId!)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!companyId,
  });

  // Fetch users
  const { data: users, isLoading: isLoadingUsers } = useQuery({
    queryKey: ['platform-company-users', companyId],
    queryFn: async () => {
      const { data: companyUsers, error } = await supabase
        .from('company_users')
        .select('*')
        .eq('company_id', companyId!)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Fetch profiles for these users
      const userIds = companyUsers.map(u => u.user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, email, first_name, last_name')
        .in('id', userIds);

      return companyUsers.map(cu => ({
        ...cu,
        profile: profiles?.find(p => p.id === cu.user_id),
      }));
    },
    enabled: !!companyId,
  });

  // Fetch employee count
  const { data: employeeCount } = useQuery({
    queryKey: ['platform-company-employees', companyId],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('employees')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', companyId!)
        .neq('employment_status', 'terminated');

      if (error) throw error;
      return count || 0;
    },
    enabled: !!companyId,
  });

  // Fetch company domains
  const { data: companyDomains, isLoading: isLoadingDomains } = useQuery({
    queryKey: ['platform-company-domains', companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('company_domains')
        .select('*')
        .eq('company_id', companyId!)
        .order('is_primary', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!companyId,
  });

  // Fetch storage usage (sum of file_size from employee_documents)
  const { data: storageUsage } = useQuery({
    queryKey: ['platform-company-storage', companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('employee_documents')
        .select('file_size')
        .eq('company_id', companyId!);

      if (error) throw error;
      
      // Sum all file sizes (in bytes)
      const totalBytes = data?.reduce((sum, doc) => sum + (doc.file_size || 0), 0) || 0;
      return totalBytes;
    },
    enabled: !!companyId,
  });

  // Helper to format bytes
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Calculate storage percentage
  const getStoragePercentage = (): number => {
    if (!storageUsage || !subscription?.plans?.max_storage_gb) return 0;
    const maxBytes = subscription.plans.max_storage_gb * 1024 * 1024 * 1024;
    return Math.min((storageUsage / maxBytes) * 100, 100);
  };

  const storagePercentage = getStoragePercentage();
  const isStorageWarning = storagePercentage >= 80;
  const isStorageCritical = storagePercentage >= 95;

  // Fetch available plans
  const { data: plans } = useQuery({
    queryKey: ['platform-plans-active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('plans')
        .select('id, name')
        .eq('is_active', true)
        .order('sort_order');

      if (error) throw error;
      return data;
    },
  });


  // Toggle company active status
  const toggleActiveMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('companies')
        .update({ is_active: !company?.is_active })
        .eq('id', companyId!);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(company?.is_active ? 'Company frozen' : 'Company unfrozen');
      queryClient.invalidateQueries({ queryKey: ['platform-company', companyId] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Change plan
  const changePlanMutation = useMutation({
    mutationFn: async (newPlanId: string) => {
      // Get the new plan details to check if it's a paid plan
      const { data: newPlan } = await supabase
        .from('plans')
        .select('price_monthly, price_yearly, name')
        .eq('id', newPlanId)
        .single();
      
      const isPaidPlan = newPlan && 
        (newPlan.price_monthly > 0 || newPlan.price_yearly > 0);

      const wasTrialing = subscription?.status === 'trialing';
      const previousPlanId = subscription?.plan_id;

      if (subscription) {
        const now = new Date();
        const periodEnd = new Date();
        periodEnd.setMonth(periodEnd.getMonth() + 1);
        
        const updateData: Record<string, unknown> = { 
          plan_id: newPlanId,
          updated_at: now.toISOString(),
        };
        
        // If upgrading to a paid plan, end trial immediately
        if (isPaidPlan) {
          updateData.status = 'active';
          updateData.trial_ends_at = null;
          updateData.current_period_start = now.toISOString();
          updateData.current_period_end = periodEnd.toISOString();
        }

        const { error } = await supabase
          .from('company_subscriptions')
          .update(updateData)
          .eq('id', subscription.id);

        if (error) throw error;

        // Log the plan change / trial conversion
        await supabase.from('billing_logs').insert({
          company_id: companyId,
          event_type: wasTrialing && isPaidPlan ? 'trial_converted' : 'plan_changed',
          subscription_id: subscription.id,
          plan_id: newPlanId,
          previous_plan_id: previousPlanId,
          metadata: {
            new_plan_name: newPlan?.name,
            was_trialing: wasTrialing,
            is_paid_upgrade: isPaidPlan,
            source: 'platform_admin',
          },
        });
      } else {
        // Create new subscription
        const { data: newSub, error } = await supabase
          .from('company_subscriptions')
          .insert({
            company_id: companyId!,
            plan_id: newPlanId,
            status: 'active',
            current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          })
          .select()
          .single();

        if (error) throw error;

        // Log new subscription
        await supabase.from('billing_logs').insert({
          company_id: companyId,
          event_type: 'subscription_created',
          subscription_id: newSub?.id,
          plan_id: newPlanId,
          metadata: {
            new_plan_name: newPlan?.name,
            source: 'platform_admin',
          },
        });
      }
    },
    onSuccess: () => {
      toast.success('Plan updated successfully');
      queryClient.invalidateQueries({ queryKey: ['platform-company-subscription', companyId] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Extend trial
  const extendTrialMutation = useMutation({
    mutationFn: async (days: number) => {
      if (!subscription) return;

      const newEndDate = new Date(subscription.trial_ends_at || subscription.current_period_end);
      newEndDate.setDate(newEndDate.getDate() + days);

      const { error } = await supabase
        .from('company_subscriptions')
        .update({
          trial_ends_at: newEndDate.toISOString(),
          current_period_end: newEndDate.toISOString(),
          status: 'trialing',
        })
        .eq('id', subscription.id);

      if (error) throw error;

      // Log the trial extension event
      await supabase.from('billing_logs').insert({
        company_id: companyId,
        event_type: 'trial_extended',
        subscription_id: subscription.id,
        plan_id: subscription.plan_id,
        metadata: {
          extension_days: days,
          new_trial_end: newEndDate.toISOString(),
          previous_trial_end: subscription.trial_ends_at,
          source: 'platform_admin',
        },
      });
    },
    onSuccess: () => {
      toast.success('Trial extended');
      queryClient.invalidateQueries({ queryKey: ['platform-company-subscription', companyId] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Fetch pending extension requests for this company
  const { data: extensionRequests, isLoading: isLoadingExtensions } = useQuery({
    queryKey: ['company-extension-requests', companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('trial_extension_requests')
        .select('*, profiles:requested_by(email, first_name, last_name)')
        .eq('company_id', companyId!)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!companyId,
  });

  const pendingExtensions = extensionRequests?.filter(r => r.status === 'pending') || [];

  // Review extension request mutation
  const reviewExtensionMutation = useMutation({
    mutationFn: async ({ requestId, approved, notes }: { requestId: string; approved: boolean; notes: string }) => {
      const request = extensionRequests?.find(r => r.id === requestId);
      if (!request) throw new Error('Request not found');

      // Update the request status
      const { error: updateError } = await supabase
        .from('trial_extension_requests')
        .update({
          status: approved ? 'approved' : 'rejected',
          reviewed_by: (await supabase.auth.getUser()).data.user?.id,
          reviewed_at: new Date().toISOString(),
          review_notes: notes || null,
        })
        .eq('id', requestId);

      if (updateError) throw updateError;

      // If approved, extend the trial
      if (approved && subscription) {
        const newEndDate = new Date(subscription.trial_ends_at || subscription.current_period_end);
        newEndDate.setDate(newEndDate.getDate() + request.requested_days);

        const { error: subError } = await supabase
          .from('company_subscriptions')
          .update({
            trial_ends_at: newEndDate.toISOString(),
            current_period_end: newEndDate.toISOString(),
            status: 'trialing',
          })
          .eq('id', subscription.id);

        if (subError) throw subError;

        // Log the extension approval
        await supabase.from('billing_logs').insert({
          company_id: companyId,
          event_type: 'trial_extension_approved',
          subscription_id: subscription.id,
          plan_id: subscription.plan_id,
          metadata: {
            extension_days: request.requested_days,
            new_trial_end: newEndDate.toISOString(),
            request_id: requestId,
            request_reason: request.reason,
          },
        });
      } else {
        // Log the extension rejection
        await supabase.from('billing_logs').insert({
          company_id: companyId,
          event_type: 'trial_extension_rejected',
          subscription_id: subscription?.id,
          plan_id: subscription?.plan_id,
          metadata: {
            request_id: requestId,
            request_reason: request.reason,
            rejection_notes: notes,
          },
        });
      }
    },
    onSuccess: (_, { approved }) => {
      toast.success(approved ? 'Extension approved and trial extended' : 'Extension rejected');
      queryClient.invalidateQueries({ queryKey: ['company-extension-requests', companyId] });
      queryClient.invalidateQueries({ queryKey: ['platform-company-subscription', companyId] });
      queryClient.invalidateQueries({ queryKey: ['pending-extension-requests'] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const [reviewNotes, setReviewNotes] = useState('');

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'trialing':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'past_due':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'canceled':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'super_admin':
        return 'destructive';
      case 'company_admin':
        return 'default';
      case 'hr_manager':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  if (isLoadingCompany) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!company) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Company not found</p>
        <Button variant="outline" onClick={() => navigate('/platform/companies')} className="mt-4">
          Back to Companies
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/platform/companies')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h2 className="text-2xl font-bold text-foreground">{company.name}</h2>
            <p className="text-muted-foreground">{company.slug}</p>
          </div>
          <Badge variant={company.is_active ? 'default' : 'secondary'}>
            {company.is_active ? 'Active' : 'Frozen'}
          </Badge>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => navigate(`/platform/companies/${companyId}/permissions`)}
          >
            <Shield className="h-4 w-4 mr-2" />
            Permissions
          </Button>
          <Button
            variant="default"
            onClick={async () => {
              await startImpersonation({
                id: company.id,
                name: company.name,
                slug: company.slug,
              });
              navigate('/app/dashboard');
            }}
          >
            <Eye className="h-4 w-4 mr-2" />
            Impersonate
          </Button>
          <Button
            variant="outline"
            onClick={() => toggleActiveMutation.mutate()}
            disabled={toggleActiveMutation.isPending}
          >
            {company.is_active ? 'Freeze Company' : 'Unfreeze Company'}
          </Button>
        </div>
      </div>

      {/* Company Info & Subscription */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Company Details */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Company Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Briefcase className="h-4 w-4" />
                Industry
              </div>
              <div>{company.industry || '-'}</div>
              
              <div className="flex items-center gap-2 text-muted-foreground">
                <Users className="h-4 w-4" />
                Size Range
              </div>
              <div>{company.size_range || '-'}</div>
              
              <div className="flex items-center gap-2 text-muted-foreground">
                <Mail className="h-4 w-4" />
                Email
              </div>
              <div>{company.email || '-'}</div>
              
              <div className="flex items-center gap-2 text-muted-foreground">
                <Globe className="h-4 w-4" />
                Website
              </div>
              <div>{company.website || '-'}</div>
              
              <div className="flex items-center gap-2 text-muted-foreground">
                <Calendar className="h-4 w-4" />
                Created
              </div>
              <div>{format(new Date(company.created_at), 'MMM d, yyyy')}</div>
            </div>
          </CardContent>
        </Card>

        {/* Subscription */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Subscription
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoadingSub ? (
              <Skeleton className="h-32" />
            ) : subscription ? (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Plan</span>
                  <Select
                    value={subscription.plan_id}
                    onValueChange={(value) => changePlanMutation.mutate(value)}
                  >
                    <SelectTrigger className="w-40">
                      <SelectValue />
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
                
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Status</span>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${getStatusColor(subscription.status)}`}>
                    {subscription.status}
                  </span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Period End</span>
                  <span>{format(new Date(subscription.current_period_end), 'MMM d, yyyy')}</span>
                </div>

                {subscription.trial_ends_at && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Trial Ends</span>
                    <span>{format(new Date(subscription.trial_ends_at), 'MMM d, yyyy')}</span>
                  </div>
                )}

                {subscription.status === 'trialing' && (
                  <div className="flex gap-2 pt-2">
                    <Button size="sm" variant="outline" onClick={() => extendTrialMutation.mutate(7)}>
                      +7 days
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => extendTrialMutation.mutate(14)}>
                      +14 days
                    </Button>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-4">
                <p className="text-muted-foreground mb-4">No subscription</p>
                <Select onValueChange={(value) => changePlanMutation.mutate(value)}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Assign a plan" />
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
            )}
          </CardContent>
        </Card>
      </div>

      {/* Pending Extension Requests */}
      {pendingExtensions.length > 0 && (
        <Card className="border-purple-200 dark:border-purple-900">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Gift className="h-5 w-5 text-purple-600" />
              Pending Extension Requests
            </CardTitle>
            <CardDescription>Review and approve trial extension requests</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {pendingExtensions.map((request) => (
              <div key={request.id} className="p-4 border rounded-lg space-y-3 bg-purple-50/50 dark:bg-purple-950/50">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium">
                      {request.requested_days} day extension requested
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Extension #{request.extension_number + 1} • Requested {format(new Date(request.created_at), 'MMM d, yyyy')}
                    </p>
                  </div>
                  <Badge variant="secondary">Pending</Badge>
                </div>
                
                <div className="text-sm">
                  <p className="text-muted-foreground">Reason:</p>
                  <p className="mt-1">{request.reason}</p>
                </div>

                <div className="space-y-2">
                  <Textarea
                    placeholder="Add notes (optional)"
                    value={reviewNotes}
                    onChange={(e) => setReviewNotes(e.target.value)}
                    rows={2}
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => {
                        reviewExtensionMutation.mutate({ requestId: request.id, approved: true, notes: reviewNotes });
                        setReviewNotes('');
                      }}
                      disabled={reviewExtensionMutation.isPending}
                    >
                      <Check className="h-4 w-4 mr-1" />
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        reviewExtensionMutation.mutate({ requestId: request.id, approved: false, notes: reviewNotes });
                        setReviewNotes('');
                      }}
                      disabled={reviewExtensionMutation.isPending}
                    >
                      <X className="h-4 w-4 mr-1" />
                      Reject
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Usage Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <UserCheck className="h-4 w-4 text-muted-foreground" />
              Employees
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {employeeCount}
              {subscription?.plans?.max_employees && (
                <span className="text-sm font-normal text-muted-foreground">
                  {' '}/ {subscription.plans.max_employees}
                </span>
              )}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              Users
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{users?.length || 0}</div>
          </CardContent>
        </Card>
        
        <Card className={isStorageCritical ? 'border-destructive' : isStorageWarning ? 'border-yellow-500' : ''}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <HardDrive className="h-4 w-4 text-muted-foreground" />
              Storage
              {isStorageCritical && (
                <Badge variant="destructive" className="ml-auto">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  Critical
                </Badge>
              )}
              {isStorageWarning && !isStorageCritical && (
                <Badge variant="secondary" className="ml-auto bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  Warning
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-2xl font-bold">
              {formatBytes(storageUsage || 0)}
              {subscription?.plans?.max_storage_gb && (
                <span className="text-sm font-normal text-muted-foreground">
                  {' '}/ {subscription.plans.max_storage_gb} GB
                </span>
              )}
            </div>
            {subscription?.plans?.max_storage_gb && (
              <div className="space-y-1">
                <Progress 
                  value={storagePercentage} 
                  className={`h-2 ${isStorageCritical ? '[&>div]:bg-destructive' : isStorageWarning ? '[&>div]:bg-yellow-500' : ''}`}
                />
                <p className="text-xs text-muted-foreground">
                  {storagePercentage.toFixed(1)}% used
                </p>
              </div>
            )}
            {isStorageCritical && (
              <p className="text-xs text-destructive">
                Storage is almost full. Consider upgrading the plan or cleaning up old documents.
              </p>
            )}
            {isStorageWarning && !isStorageCritical && (
              <p className="text-xs text-yellow-600 dark:text-yellow-400">
                Storage is running low. Monitor usage closely.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Company Domains */}
      <DomainManagementCard 
        companyId={companyId!}
        companyDomains={companyDomains}
        isLoading={isLoadingDomains}
        onRefresh={() => queryClient.invalidateQueries({ queryKey: ['platform-company-domains', companyId] })}
      />

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle>Users</CardTitle>
          <CardDescription>All users with access to this company</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingUsers ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : users?.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No users</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Joined</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users?.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">
                          {user.profile?.first_name && user.profile?.last_name
                            ? `${user.profile.first_name} ${user.profile.last_name}`
                            : 'Unknown'}
                        </p>
                        <p className="text-sm text-muted-foreground">{user.profile?.email}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getRoleBadgeVariant(user.role)}>
                        {user.role.replace('_', ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={user.is_active ? 'default' : 'secondary'}>
                        {user.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {user.joined_at ? format(new Date(user.joined_at), 'MMM d, yyyy') : '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Domain Management Card Component - View only, with subdomain change request approval
function DomainManagementCard({ 
  companyId, 
  companyDomains, 
  isLoading,
  onRefresh 
}: { 
  companyId: string;
  companyDomains: any[] | undefined;
  isLoading: boolean;
  onRefresh: () => void;
}) {
  const [reviewNotes, setReviewNotes] = useState('');
  const queryClient = useQueryClient();

  // Fetch pending subdomain change requests for this company
  const { data: subdomainRequests, isLoading: isLoadingRequests } = useQuery({
    queryKey: ['subdomain-change-requests-platform', companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('subdomain_change_requests')
        .select('*')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!companyId,
  });

  const pendingRequest = subdomainRequests?.find((r: any) => r.status === 'pending');

  // Approve subdomain change request
  const approveRequestMutation = useMutation({
    mutationFn: async ({ requestId, notes }: { requestId: string; notes: string }) => {
      const request = subdomainRequests?.find((r: any) => r.id === requestId);
      if (!request) throw new Error('Request not found');

      // Find the subdomain record to update
      const subdomainRecord = companyDomains?.find(d => d.subdomain);
      if (!subdomainRecord) throw new Error('No subdomain record found');

      // Update the company_domains with new subdomain
      const { error: updateDomainError } = await supabase
        .from('company_domains')
        .update({ 
          subdomain: request.requested_subdomain,
          updated_at: new Date().toISOString()
        })
        .eq('id', subdomainRecord.id);

      if (updateDomainError) throw updateDomainError;

      // Mark request as approved
      const { error: updateRequestError } = await supabase
        .from('subdomain_change_requests')
        .update({
          status: 'approved',
          reviewed_by: (await supabase.auth.getUser()).data.user?.id,
          reviewed_at: new Date().toISOString(),
          review_notes: notes || null,
        })
        .eq('id', requestId);

      if (updateRequestError) throw updateRequestError;
    },
    onSuccess: () => {
      toast.success('Subdomain change approved and updated');
      queryClient.invalidateQueries({ queryKey: ['subdomain-change-requests-platform', companyId] });
      queryClient.invalidateQueries({ queryKey: ['platform-company-domains', companyId] });
      setReviewNotes('');
      onRefresh();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Reject subdomain change request
  const rejectRequestMutation = useMutation({
    mutationFn: async ({ requestId, notes }: { requestId: string; notes: string }) => {
      const { error } = await supabase
        .from('subdomain_change_requests')
        .update({
          status: 'rejected',
          reviewed_by: (await supabase.auth.getUser()).data.user?.id,
          reviewed_at: new Date().toISOString(),
          review_notes: notes || null,
        })
        .eq('id', requestId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Subdomain change request rejected');
      queryClient.invalidateQueries({ queryKey: ['subdomain-change-requests-platform', companyId] });
      setReviewNotes('');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              Domains
            </CardTitle>
            <CardDescription>Subdomains and custom domains for this company (view only)</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Pending Subdomain Change Request */}
        {pendingRequest && (
          <div className="p-4 border rounded-lg space-y-3 bg-yellow-50/50 dark:bg-yellow-950/50 border-yellow-200 dark:border-yellow-900">
            <div className="flex justify-between items-start">
              <div>
                <p className="font-medium flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-yellow-600" />
                  Subdomain Change Request
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  From: <code className="bg-muted px-1 rounded">{pendingRequest.current_subdomain}</code>
                  {' → '}
                  To: <code className="bg-muted px-1 rounded">{pendingRequest.requested_subdomain}</code>
                </p>
              </div>
              <Badge variant="secondary">Pending</Badge>
            </div>
            
            {pendingRequest.reason && (
              <div className="text-sm">
                <p className="text-muted-foreground">Reason:</p>
                <p className="mt-1">{pendingRequest.reason}</p>
              </div>
            )}

            <div className="space-y-2">
              <Textarea
                placeholder="Add review notes (optional)"
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                rows={2}
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => approveRequestMutation.mutate({ requestId: pendingRequest.id, notes: reviewNotes })}
                  disabled={approveRequestMutation.isPending || rejectRequestMutation.isPending}
                >
                  <Check className="h-4 w-4 mr-1" />
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => rejectRequestMutation.mutate({ requestId: pendingRequest.id, notes: reviewNotes })}
                  disabled={approveRequestMutation.isPending || rejectRequestMutation.isPending}
                >
                  <X className="h-4 w-4 mr-1" />
                  Reject
                </Button>
              </div>
            </div>
          </div>
        )}

        {isLoading ? (
          <Skeleton className="h-20" />
        ) : companyDomains?.length === 0 ? (
          <p className="text-muted-foreground text-center py-4">No domains configured</p>
        ) : (
          <div className="space-y-3">
            {companyDomains?.map((domain) => (
              <div key={domain.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  <Globe className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="font-mono text-sm">
                      {domain.subdomain ? `${domain.subdomain}.hrplatform.com` : domain.custom_domain}
                    </p>
                    <div className="flex gap-2 mt-1">
                      {domain.is_primary && (
                        <Badge variant="default" className="text-xs">Primary</Badge>
                      )}
                      {domain.subdomain && (
                        <Badge variant="secondary" className="text-xs">Subdomain</Badge>
                      )}
                      {domain.custom_domain && (
                        <Badge variant="outline" className="text-xs">Custom</Badge>
                      )}
                      {domain.is_verified ? (
                        <Badge variant="default" className="text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                          Verified
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs">Pending</Badge>
                      )}
                      {!domain.is_active && (
                        <Badge variant="destructive" className="text-xs">Inactive</Badge>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
