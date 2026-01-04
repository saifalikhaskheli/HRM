import { useTenant } from '@/contexts/TenantContext';
import { usePlans, useSubscription, useChangePlan, useSubscriptionHealth } from '@/hooks/useSubscription';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Check, Crown, AlertTriangle, ArrowUp, ArrowDown, Loader2, Clock, Gift } from 'lucide-react';
import { EmployeeUsageCard } from '@/components/settings/EmployeeUsageCard';
import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { TrialExtensionRequestDialog } from '@/components/TrialExtensionRequestDialog';
import { InvoiceHistory } from '@/components/billing/InvoiceHistory';
import { PaymentMethodCard } from '@/components/billing/PaymentMethodCard';

export default function BillingSettingsPage() {
  const { planName, isTrialing, trialDaysRemaining, isFrozen, isAdmin, companyId } = useTenant();
  const { data: plans, isLoading: plansLoading } = usePlans();
  const { data: subscription } = useSubscription();
  const { mutate: changePlan, isPending: isChanging } = useChangePlan();
  const health = useSubscriptionHealth();
  
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [selectedInterval, setSelectedInterval] = useState<'monthly' | 'yearly'>('monthly');
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [extensionDialogOpen, setExtensionDialogOpen] = useState(false);

  // Fetch extension requests for this company
  const { data: extensionRequests } = useQuery({
    queryKey: ['trial-extension-requests', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await supabase
        .from('trial_extension_requests')
        .select('*')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!companyId && isTrialing,
  });

  // Fetch platform trial settings
  const { data: trialSettings } = useQuery({
    queryKey: ['platform-trial-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('platform_settings')
        .select('value')
        .eq('key', 'trial')
        .maybeSingle();
      if (error) throw error;
      return data?.value as { extend_allowed?: boolean; max_extensions?: number } || {};
    },
    enabled: isTrialing,
  });

  const pendingRequest = extensionRequests?.find(r => r.status === 'pending');
  const approvedCount = extensionRequests?.filter(r => r.status === 'approved').length || 0;
  const maxExtensions = trialSettings?.max_extensions || 2;
  const canRequestExtension = trialSettings?.extend_allowed && approvedCount < maxExtensions && !pendingRequest;

  const handlePlanSelect = (planId: string) => {
    setSelectedPlan(planId);
    setConfirmDialogOpen(true);
  };

  const handleConfirmChange = () => {
    if (!selectedPlan) return;
    changePlan(
      { planId: selectedPlan, interval: selectedInterval },
      { onSuccess: () => setConfirmDialogOpen(false) }
    );
  };

  const selectedPlanInfo = plans?.find(p => p.id === selectedPlan);
  const currentPlanInfo = plans?.find(p => p.name === planName);
  const isUpgrade = selectedPlanInfo && currentPlanInfo 
    ? (selectedPlanInfo.sort_order || 0) > (currentPlanInfo.sort_order || 0)
    : true;

  return (
    <div className="space-y-6">
      {/* Account Status Alerts */}
      {isFrozen && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Account Frozen</AlertTitle>
          <AlertDescription>
            Your account is frozen due to billing issues. Please update your payment method or select a plan to reactivate.
          </AlertDescription>
        </Alert>
      )}

      {health.isPastDue && !isFrozen && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Payment Past Due</AlertTitle>
          <AlertDescription>
            {health.warningMessage}
          </AlertDescription>
        </Alert>
      )}

      {health.isTrialing && health.warningMessage && !health.isPastDue && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Trial Ending Soon</AlertTitle>
          <AlertDescription>{health.warningMessage}</AlertDescription>
        </Alert>
      )}

      {/* Current Plan & Employee Usage */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Crown className="h-5 w-5 text-primary" />
              Current Plan
            </CardTitle>
            <CardDescription>
              You are currently on the{' '}
              <span className="font-semibold text-foreground">{planName || 'Free'}</span> plan
              {isTrialing && trialDaysRemaining !== null && (
                <Badge variant="secondary" className="ml-2">
                  {trialDaysRemaining} days left in trial
                </Badge>
              )}
            </CardDescription>
          </CardHeader>
          {subscription && (
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <div className="flex justify-between">
                <span>Billing interval:</span>
                <span className="capitalize font-medium text-foreground">
                  {subscription.billing_interval}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Current period ends:</span>
                <span className="font-medium text-foreground">
                  {new Date(subscription.current_period_end).toLocaleDateString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Status:</span>
                <Badge variant={health.isHealthy ? 'default' : 'destructive'}>
                  {subscription.status}
                </Badge>
              </div>
            </CardContent>
          )}
        </Card>

        <EmployeeUsageCard />
      </div>

      {/* Trial Extension Section */}
      {isTrialing && isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Gift className="h-5 w-5 text-primary" />
              Trial Extension
            </CardTitle>
            <CardDescription>
              Need more time to evaluate? Request a trial extension.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Extensions used:</span>
              <span className="font-medium">
                {approvedCount} / {maxExtensions}
              </span>
            </div>

            {pendingRequest && (
              <Alert>
                <Clock className="h-4 w-4" />
                <AlertTitle>Extension Request Pending</AlertTitle>
                <AlertDescription>
                  You have a pending extension request for {pendingRequest.requested_days} days. 
                  We'll notify you once it's reviewed.
                </AlertDescription>
              </Alert>
            )}

            {!trialSettings?.extend_allowed && (
              <p className="text-sm text-muted-foreground">
                Trial extensions are not available at this time.
              </p>
            )}

            {trialSettings?.extend_allowed && approvedCount >= maxExtensions && !pendingRequest && (
              <p className="text-sm text-muted-foreground">
                You've used all available trial extensions. Please upgrade to continue.
              </p>
            )}

            {canRequestExtension && (
              <Button 
                variant="outline" 
                onClick={() => setExtensionDialogOpen(true)}
                className="w-full"
              >
                <Gift className="h-4 w-4 mr-2" />
                Request Extension
              </Button>
            )}

            {extensionRequests && extensionRequests.length > 0 && (
              <div className="space-y-2 pt-2 border-t">
                <p className="text-sm font-medium">Request History</p>
                {extensionRequests.slice(0, 3).map((request) => (
                  <div key={request.id} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      {request.requested_days} days
                    </span>
                    <Badge 
                      variant={
                        request.status === 'approved' ? 'default' : 
                        request.status === 'rejected' ? 'destructive' : 
                        'secondary'
                      }
                    >
                      {request.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <TrialExtensionRequestDialog 
        open={extensionDialogOpen} 
        onOpenChange={setExtensionDialogOpen} 
      />

      {/* Payment Method */}
      <PaymentMethodCard />

      {/* Invoice History */}
      <InvoiceHistory />

      {/* Billing Interval Toggle */}
      <Card>
        <CardHeader>
          <CardTitle>Billing Cycle</CardTitle>
          <CardDescription>
            Save up to 20% with yearly billing
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RadioGroup 
            value={selectedInterval} 
            onValueChange={(v) => setSelectedInterval(v as 'monthly' | 'yearly')}
            className="flex gap-4"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="monthly" id="monthly" />
              <Label htmlFor="monthly">Monthly</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="yearly" id="yearly" />
              <Label htmlFor="yearly">
                Yearly <Badge variant="secondary" className="ml-1">Save 20%</Badge>
              </Label>
            </div>
          </RadioGroup>
        </CardContent>
      </Card>

      {/* Plans Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {plansLoading ? (
          <div className="col-span-full flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          plans?.map((plan) => {
            const isCurrent = plan.name === planName;
            const planPrice = selectedInterval === 'monthly' 
              ? plan.price_monthly 
              : Math.round(plan.price_yearly / 12);
            const canChange = isAdmin && !isCurrent;
            const isPlanUpgrade = currentPlanInfo 
              ? (plan.sort_order || 0) > (currentPlanInfo.sort_order || 0)
              : true;

            return (
              <Card 
                key={plan.id} 
                className={`relative ${isCurrent ? 'border-primary ring-2 ring-primary/20' : ''}`}
              >
                {isCurrent && (
                  <Badge className="absolute -top-2 -right-2" variant="default">
                    Current
                  </Badge>
                )}
                <CardHeader>
                  <CardTitle className="text-lg">{plan.name}</CardTitle>
                  <CardDescription>
                    <span className="text-2xl font-bold text-foreground">
                      ${planPrice}
                    </span>
                    <span className="text-muted-foreground">/mo</span>
                    {selectedInterval === 'yearly' && (
                      <div className="text-xs text-muted-foreground">
                        Billed ${plan.price_yearly}/year
                      </div>
                    )}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ul className="space-y-2 text-sm">
                    {plan.max_employees && (
                      <li className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-primary" />
                        {plan.max_employees === 9999 ? 'Unlimited' : `Up to ${plan.max_employees}`} employees
                      </li>
                    )}
                    {plan.features?.sso && (
                      <li className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-primary" />
                        SSO / SAML
                      </li>
                    )}
                    {plan.features?.api && (
                      <li className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-primary" />
                        API Access
                      </li>
                    )}
                    {plan.features?.audit && (
                      <li className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-primary" />
                        Audit Logs
                      </li>
                    )}
                    {plan.features?.support && (
                      <li className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-primary" />
                        {plan.features.support} support
                      </li>
                    )}
                  </ul>

                  {canChange && (
                    <Button 
                      variant={isPlanUpgrade ? 'default' : 'outline'}
                      className="w-full"
                      onClick={() => handlePlanSelect(plan.id)}
                      disabled={isChanging}
                    >
                      {isPlanUpgrade ? (
                        <>
                          <ArrowUp className="h-4 w-4 mr-1" />
                          Upgrade
                        </>
                      ) : (
                        <>
                          <ArrowDown className="h-4 w-4 mr-1" />
                          Downgrade
                        </>
                      )}
                    </Button>
                  )}

                  {!isAdmin && !isCurrent && (
                    <p className="text-xs text-muted-foreground text-center">
                      Contact your admin to change plans
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Confirm Plan Change Dialog */}
      <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {isUpgrade ? 'Upgrade' : 'Downgrade'} to {selectedPlanInfo?.name}?
            </DialogTitle>
            <DialogDescription>
              {isUpgrade ? (
                'Your new plan will be activated immediately. You will be charged the prorated difference.'
              ) : (
                'Your plan will change at the end of your current billing period. You will retain access to your current features until then.'
              )}
            </DialogDescription>
          </DialogHeader>
          
          {selectedPlanInfo && (
            <div className="py-4">
              <div className="flex justify-between items-center p-4 bg-muted rounded-lg">
                <div>
                  <p className="font-semibold">{selectedPlanInfo.name}</p>
                  <p className="text-sm text-muted-foreground capitalize">{selectedInterval} billing</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold">
                    ${selectedInterval === 'monthly' 
                      ? selectedPlanInfo.price_monthly 
                      : selectedPlanInfo.price_yearly}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    /{selectedInterval === 'monthly' ? 'month' : 'year'}
                  </p>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleConfirmChange} disabled={isChanging}>
              {isChanging ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                `Confirm ${isUpgrade ? 'Upgrade' : 'Downgrade'}`
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
