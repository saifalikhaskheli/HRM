import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { CreditCard, Plus, Trash2, Loader2, AlertTriangle, Check } from 'lucide-react';
import { toast } from 'sonner';

interface PaymentMethod {
  id: string;
  brand: string;
  last4: string;
  exp_month: number;
  exp_year: number;
  is_default: boolean;
}

function getCardIcon(brand: string) {
  // In production, you'd use actual card brand icons
  return <CreditCard className="h-5 w-5" />;
}

function maskCardNumber(last4: string) {
  return `•••• •••• •••• ${last4}`;
}

export function PaymentMethodCard() {
  const { companyId, isFrozen } = useTenant();
  const queryClient = useQueryClient();
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvc, setCvc] = useState('');
  
  // This would typically fetch from Stripe via your backend
  const { data: paymentMethods, isLoading } = useQuery({
    queryKey: ['payment-methods', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      
      // Fetch from subscription metadata or a dedicated payment_methods table
      const { data, error } = await supabase
        .from('company_subscriptions')
        .select('metadata, stripe_customer_id')
        .eq('company_id', companyId)
        .single();
      
      if (error || !data) return [];
      
      // Parse payment methods from metadata
      const metadata = data.metadata as { payment_methods?: PaymentMethod[] };
      return metadata.payment_methods || [];
    },
    enabled: !!companyId,
  });

  const addPaymentMethod = useMutation({
    mutationFn: async () => {
      // In production, this would:
      // 1. Create a payment intent with Stripe
      // 2. Tokenize the card
      // 3. Attach to customer
      // For now, we simulate the flow
      
      if (!cardNumber || !expiry || !cvc) {
        throw new Error('Please fill in all card details');
      }

      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // In production, call your edge function to handle Stripe
      // const { data, error } = await supabase.functions.invoke('add-payment-method', {
      //   body: { cardToken: 'tok_xxx' }
      // });
      
      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment-methods', companyId] });
      toast.success('Payment method added successfully');
      setAddDialogOpen(false);
      setCardNumber('');
      setExpiry('');
      setCvc('');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const removePaymentMethod = useMutation({
    mutationFn: async (methodId: string) => {
      // In production, call Stripe to detach payment method
      await new Promise(resolve => setTimeout(resolve, 1000));
      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment-methods', companyId] });
      toast.success('Payment method removed');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const setDefaultPaymentMethod = useMutation({
    mutationFn: async (methodId: string) => {
      // In production, update default payment method in Stripe
      await new Promise(resolve => setTimeout(resolve, 1000));
      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment-methods', companyId] });
      toast.success('Default payment method updated');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const formatCardNumber = (value: string) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    const matches = v.match(/\d{4,16}/g);
    const match = (matches && matches[0]) || '';
    const parts = [];
    for (let i = 0, len = match.length; i < len; i += 4) {
      parts.push(match.substring(i, i + 4));
    }
    return parts.length ? parts.join(' ') : v;
  };

  const formatExpiry = (value: string) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    if (v.length >= 2) {
      return v.substring(0, 2) + '/' + v.substring(2, 4);
    }
    return v;
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Payment Method
          </CardTitle>
          <CardDescription>Manage your payment details</CardDescription>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Payment Method
          </CardTitle>
          <CardDescription>Manage your payment details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {paymentMethods && paymentMethods.length > 0 ? (
            <div className="space-y-3">
              {paymentMethods.map((method) => (
                <div 
                  key={method.id} 
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    {getCardIcon(method.brand)}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium capitalize">{method.brand}</span>
                        <span className="font-mono text-sm text-muted-foreground">
                          {maskCardNumber(method.last4)}
                        </span>
                        {method.is_default && (
                          <Badge variant="secondary" className="text-xs">Default</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Expires {method.exp_month.toString().padStart(2, '0')}/{method.exp_year}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {!method.is_default && (
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => setDefaultPaymentMethod.mutate(method.id)}
                        disabled={isFrozen || setDefaultPaymentMethod.isPending}
                      >
                        Set Default
                      </Button>
                    )}
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => removePaymentMethod.mutate(method.id)}
                      disabled={isFrozen || removePaymentMethod.isPending || method.is_default}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6">
              <CreditCard className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-2">No payment method on file</p>
              <p className="text-sm text-muted-foreground mb-4">
                Add a payment method to activate your subscription.
              </p>
            </div>
          )}

          <Button 
            onClick={() => setAddDialogOpen(true)} 
            disabled={isFrozen}
            variant={paymentMethods?.length ? 'outline' : 'default'}
            className="w-full"
          >
            <Plus className="h-4 w-4 mr-2" />
            {paymentMethods?.length ? 'Add Another Card' : 'Add Payment Method'}
          </Button>
        </CardContent>
      </Card>

      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Add Payment Method
            </DialogTitle>
            <DialogDescription>
              Enter your card details to add a new payment method.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                In production, this would use Stripe Elements for secure card entry.
                This is a demonstration of the UI flow.
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label htmlFor="card-number">Card Number</Label>
              <Input
                id="card-number"
                placeholder="1234 5678 9012 3456"
                value={cardNumber}
                onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                maxLength={19}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="expiry">Expiry Date</Label>
                <Input
                  id="expiry"
                  placeholder="MM/YY"
                  value={expiry}
                  onChange={(e) => setExpiry(formatExpiry(e.target.value))}
                  maxLength={5}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cvc">CVC</Label>
                <Input
                  id="cvc"
                  placeholder="123"
                  value={cvc}
                  onChange={(e) => setCvc(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  maxLength={4}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => addPaymentMethod.mutate()}
              disabled={addPaymentMethod.isPending}
            >
              {addPaymentMethod.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Adding...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Add Card
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
