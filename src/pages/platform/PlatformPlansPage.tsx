import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { CreditCard, Plus, Pencil, Trash2, ArrowUp, ArrowDown } from 'lucide-react';
import { PLAN_MODULES } from '@/config/plans';

const ALL_MODULES = [
  { id: 'employees', label: 'Employees' },
  { id: 'directory', label: 'Directory' },
  { id: 'leave', label: 'Leave Management' },
  { id: 'time_tracking', label: 'Time Tracking' },
  { id: 'documents', label: 'Documents' },
  { id: 'recruitment', label: 'Recruitment' },
  { id: 'performance', label: 'Performance' },
  { id: 'payroll', label: 'Payroll' },
  { id: 'compliance', label: 'Compliance' },
  { id: 'audit', label: 'Audit' },
  { id: 'integrations', label: 'Integrations' },
];

interface PlanFormData {
  name: string;
  description: string;
  price_monthly: number;
  price_yearly: number;
  max_employees: number | null;
  max_storage_gb: number;
  modules: string[];
  sso: boolean;
  api: boolean;
  audit: boolean;
  is_active: boolean;
  is_public: boolean;
  // Trial configuration
  trial_enabled: boolean;
  trial_default_days: number;
  trial_restrictions: {
    disabled_modules: string[];
    max_employees: number | null;
  };
}

const defaultFormData: PlanFormData = {
  name: '',
  description: '',
  price_monthly: 0,
  price_yearly: 0,
  max_employees: null,
  max_storage_gb: 5,
  modules: ['employees', 'directory'],
  sso: false,
  api: false,
  audit: false,
  is_active: true,
  is_public: true,
  trial_enabled: true,
  trial_default_days: 14,
  trial_restrictions: {
    disabled_modules: [],
    max_employees: null,
  },
};

export default function PlatformPlansPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<any>(null);
  const [formData, setFormData] = useState<PlanFormData>(defaultFormData);
  const queryClient = useQueryClient();

  const { data: plans, isLoading } = useQuery({
    queryKey: ['platform-plans'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('plans')
        .select('*')
        .order('sort_order', { ascending: true });

      if (error) throw error;
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: PlanFormData) => {
      const features = {
        modules: data.modules,
        sso: data.sso,
        api: data.api,
        audit: data.audit,
      };

      const maxSortOrder = plans?.reduce((max, p) => Math.max(max, p.sort_order || 0), 0) || 0;

      const { error } = await supabase.from('plans').insert({
        name: data.name,
        description: data.description || null,
        price_monthly: data.price_monthly,
        price_yearly: data.price_yearly,
        max_employees: data.max_employees,
        max_storage_gb: data.max_storage_gb,
        features,
        is_active: data.is_active,
        is_public: data.is_public,
        sort_order: maxSortOrder + 1,
        trial_enabled: data.trial_enabled,
        trial_default_days: data.trial_default_days,
        trial_restrictions: data.trial_restrictions,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Plan created successfully');
      queryClient.invalidateQueries({ queryKey: ['platform-plans'] });
      handleCloseDialog();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: PlanFormData }) => {
      const features = {
        modules: data.modules,
        sso: data.sso,
        api: data.api,
        audit: data.audit,
      };

      const { error } = await supabase
        .from('plans')
        .update({
          name: data.name,
          description: data.description || null,
          price_monthly: data.price_monthly,
          price_yearly: data.price_yearly,
          max_employees: data.max_employees,
          max_storage_gb: data.max_storage_gb,
          features,
          is_active: data.is_active,
          is_public: data.is_public,
          trial_enabled: data.trial_enabled,
          trial_default_days: data.trial_default_days,
          trial_restrictions: data.trial_restrictions,
        }, { count: 'exact' })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Plan updated successfully');
      queryClient.invalidateQueries({ queryKey: ['platform-plans'] });
      handleCloseDialog();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      // Check if plan has active subscriptions
      const { count } = await supabase
        .from('company_subscriptions')
        .select('id', { count: 'exact', head: true })
        .eq('plan_id', id)
        .in('status', ['active', 'trialing']);

      if (count && count > 0) {
        throw new Error('Cannot delete plan with active subscriptions');
      }

      const { error } = await supabase.from('plans').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Plan deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['platform-plans'] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const reorderMutation = useMutation({
    mutationFn: async ({ planId, direction }: { planId: string; direction: 'up' | 'down' }) => {
      const sortedPlans = [...(plans || [])].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      const currentIndex = sortedPlans.findIndex(p => p.id === planId);
      
      if (currentIndex === -1) return;
      
      const swapIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
      if (swapIndex < 0 || swapIndex >= sortedPlans.length) return;

      const currentPlan = sortedPlans[currentIndex];
      const swapPlan = sortedPlans[swapIndex];

      await Promise.all([
        supabase.from('plans').update({ sort_order: swapPlan.sort_order }, { count: 'exact' }).eq('id', currentPlan.id),
        supabase.from('plans').update({ sort_order: currentPlan.sort_order }, { count: 'exact' }).eq('id', swapPlan.id),
      ]);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-plans'] });
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { error } = await supabase
        .from('plans')
        .update({ is_active: !isActive }, { count: 'exact' })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Plan status updated');
      queryClient.invalidateQueries({ queryKey: ['platform-plans'] });
    },
    onError: (error: Error) => {
      toast.error('Permission error updating plan status');
    },
  });

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingPlan(null);
    setFormData(defaultFormData);
  };

  const handleEdit = (plan: any) => {
    const features = plan.features || {};
    const trialRestrictions = plan.trial_restrictions || {};
    setFormData({
      name: plan.name,
      description: plan.description || '',
      price_monthly: plan.price_monthly,
      price_yearly: plan.price_yearly,
      max_employees: plan.max_employees,
      max_storage_gb: plan.max_storage_gb || 5,
      modules: features.modules === 'all' ? ALL_MODULES.map(m => m.id) : (features.modules || []),
      sso: features.sso || false,
      api: features.api || false,
      audit: features.audit || false,
      is_active: plan.is_active,
      is_public: plan.is_public ?? true,
      trial_enabled: plan.trial_enabled ?? true,
      trial_default_days: plan.trial_default_days ?? 14,
      trial_restrictions: {
        disabled_modules: trialRestrictions.disabled_modules || [],
        max_employees: trialRestrictions.max_employees ?? null,
      },
    });
    setEditingPlan(plan);
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingPlan) {
      updateMutation.mutate({ id: editingPlan.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(price);
  };

  const parseFeatures = (features: any) => {
    if (!features) return { modules: [], other: {} };
    const { modules, ...other } = features;
    return { 
      modules: modules === 'all' ? ['All modules'] : (Array.isArray(modules) ? modules : []),
      other 
    };
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Subscription Plans</h2>
          <p className="text-muted-foreground">Manage subscription plans and pricing</p>
        </div>
        <Button onClick={() => setIsDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Plan
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Plans</CardTitle>
          <CardDescription>
            Plans available to companies on the platform
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : plans?.length === 0 ? (
            <div className="text-center py-12">
              <CreditCard className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No plans configured</p>
              <Button variant="outline" className="mt-4" onClick={() => setIsDialogOpen(true)}>
                Create your first plan
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8"></TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Monthly</TableHead>
                  <TableHead>Yearly</TableHead>
                  <TableHead>Max Employees</TableHead>
                  <TableHead>Trial</TableHead>
                  <TableHead>Modules</TableHead>
                  <TableHead>Visibility</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {plans?.map((plan, index) => {
                  const { modules } = parseFeatures(plan.features);
                  
                  return (
                    <TableRow key={plan.id}>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            disabled={index === 0}
                            onClick={() => reorderMutation.mutate({ planId: plan.id, direction: 'up' })}
                          >
                            <ArrowUp className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            disabled={index === plans.length - 1}
                            onClick={() => reorderMutation.mutate({ planId: plan.id, direction: 'down' })}
                          >
                            <ArrowDown className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{plan.name}</p>
                          {plan.description && (
                            <p className="text-sm text-muted-foreground truncate max-w-[200px]">
                              {plan.description}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{formatPrice(plan.price_monthly)}</TableCell>
                      <TableCell>{formatPrice(plan.price_yearly)}</TableCell>
                      <TableCell>
                        {plan.max_employees ? plan.max_employees : 'Unlimited'}
                      </TableCell>
                      <TableCell>
                        {plan.trial_enabled !== false ? (
                          <Badge variant="outline" className="text-xs">
                            {plan.trial_default_days || 14} days
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-xs">Disabled</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {modules.length === 0 ? (
                            <span className="text-muted-foreground">-</span>
                          ) : modules.slice(0, 3).map((module: string) => (
                            <Badge key={module} variant="outline" className="text-xs">
                              {module}
                            </Badge>
                          ))}
                          {modules.length > 3 && (
                            <Badge variant="outline" className="text-xs">
                              +{modules.length - 3}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={plan.is_public !== false ? 'default' : 'secondary'}>
                          {plan.is_public !== false ? 'Public' : 'Private'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={plan.is_active}
                          disabled={toggleActiveMutation.isPending}
                          onCheckedChange={() => toggleActiveMutation.mutate({ id: plan.id, isActive: plan.is_active })}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(plan)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              if (confirm('Are you sure you want to delete this plan?')) {
                                deleteMutation.mutate(plan.id);
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingPlan ? 'Edit Plan' : 'Create New Plan'}</DialogTitle>
            <DialogDescription>
              {editingPlan ? 'Update plan details and features' : 'Configure a new subscription plan'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Info */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Plan Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Pro"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="max_employees">Max Employees</Label>
                <Input
                  id="max_employees"
                  type="number"
                  value={formData.max_employees || ''}
                  onChange={(e) => setFormData({ ...formData, max_employees: e.target.value ? parseInt(e.target.value) : null })}
                  placeholder="Leave empty for unlimited"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Brief description of the plan"
                rows={2}
              />
            </div>

            {/* Pricing */}
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="price_monthly">Monthly Price ($)</Label>
                <Input
                  id="price_monthly"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.price_monthly}
                  onChange={(e) => setFormData({ ...formData, price_monthly: parseFloat(e.target.value) || 0 })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="price_yearly">Yearly Price ($)</Label>
                <Input
                  id="price_yearly"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.price_yearly}
                  onChange={(e) => setFormData({ ...formData, price_yearly: parseFloat(e.target.value) || 0 })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="max_storage">Storage (GB)</Label>
                <Input
                  id="max_storage"
                  type="number"
                  min="1"
                  value={formData.max_storage_gb}
                  onChange={(e) => setFormData({ ...formData, max_storage_gb: parseInt(e.target.value) || 5 })}
                  required
                />
              </div>
            </div>

            {/* Modules */}
            <div className="space-y-3">
              <Label>Included Modules</Label>
              <div className="grid gap-2 md:grid-cols-3">
                {ALL_MODULES.map((module) => (
                  <div key={module.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`module-${module.id}`}
                      checked={formData.modules.includes(module.id)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setFormData({ ...formData, modules: [...formData.modules, module.id] });
                        } else {
                          setFormData({ ...formData, modules: formData.modules.filter(m => m !== module.id) });
                        }
                      }}
                    />
                    <Label htmlFor={`module-${module.id}`} className="text-sm font-normal">
                      {module.label}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            {/* Enterprise Features */}
            <div className="space-y-3">
              <Label>Enterprise Features</Label>
              <div className="flex flex-wrap gap-6">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="sso"
                    checked={formData.sso}
                    onCheckedChange={(checked) => setFormData({ ...formData, sso: checked })}
                  />
                  <Label htmlFor="sso">SSO / SAML</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="api"
                    checked={formData.api}
                    onCheckedChange={(checked) => setFormData({ ...formData, api: checked })}
                  />
                  <Label htmlFor="api">API Access</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="audit"
                    checked={formData.audit}
                    onCheckedChange={(checked) => setFormData({ ...formData, audit: checked })}
                  />
                  <Label htmlFor="audit">Audit Logs</Label>
                </div>
              </div>
            </div>

            {/* Trial Configuration */}
            <div className="space-y-4 border-t pt-4">
              <div className="flex items-center justify-between">
                <Label className="text-base font-medium">Trial Configuration</Label>
                <Switch
                  id="trial_enabled"
                  checked={formData.trial_enabled}
                  onCheckedChange={(checked) => setFormData({ ...formData, trial_enabled: checked })}
                />
              </div>
              
              {formData.trial_enabled && (
                <div className="space-y-4 pl-4 border-l-2 border-muted">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="trial_default_days">Default Trial Days</Label>
                      <Input
                        id="trial_default_days"
                        type="number"
                        min="1"
                        max="90"
                        value={formData.trial_default_days}
                        onChange={(e) => setFormData({ ...formData, trial_default_days: parseInt(e.target.value) || 14 })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="trial_max_employees">Max Employees During Trial</Label>
                      <Input
                        id="trial_max_employees"
                        type="number"
                        min="1"
                        value={formData.trial_restrictions.max_employees || ''}
                        onChange={(e) => setFormData({ 
                          ...formData, 
                          trial_restrictions: {
                            ...formData.trial_restrictions,
                            max_employees: e.target.value ? parseInt(e.target.value) : null
                          }
                        })}
                        placeholder="Same as plan"
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Disabled Modules During Trial</Label>
                    <div className="grid gap-2 md:grid-cols-3">
                      {formData.modules.map((moduleId) => {
                        const module = ALL_MODULES.find(m => m.id === moduleId);
                        if (!module) return null;
                        return (
                          <div key={moduleId} className="flex items-center space-x-2">
                            <Checkbox
                              id={`trial-disable-${moduleId}`}
                              checked={formData.trial_restrictions.disabled_modules.includes(moduleId)}
                              onCheckedChange={(checked) => {
                                const newDisabled = checked
                                  ? [...formData.trial_restrictions.disabled_modules, moduleId]
                                  : formData.trial_restrictions.disabled_modules.filter(m => m !== moduleId);
                                setFormData({
                                  ...formData,
                                  trial_restrictions: {
                                    ...formData.trial_restrictions,
                                    disabled_modules: newDisabled
                                  }
                                });
                              }}
                            />
                            <Label htmlFor={`trial-disable-${moduleId}`} className="text-sm font-normal text-muted-foreground">
                              {module.label}
                            </Label>
                          </div>
                        );
                      })}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Checked modules will be disabled during the trial period.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Status & Visibility */}
            <div className="space-y-3">
              <Label>Plan Visibility</Label>
              <div className="flex flex-wrap gap-6">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="is_active"
                    checked={formData.is_active}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                  />
                  <Label htmlFor="is_active">Active</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="is_public"
                    checked={formData.is_public}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_public: checked })}
                  />
                  <Label htmlFor="is_public">Public (visible to all companies)</Label>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Private plans are only visible to specifically assigned companies.
              </p>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleCloseDialog}>
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                {editingPlan ? 'Update Plan' : 'Create Plan'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
