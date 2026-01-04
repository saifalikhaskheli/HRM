import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { useCurrentCompany } from '@/hooks/useCompany';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { Hash, Loader2, RefreshCw } from 'lucide-react';

interface EmployeeIdSettings {
  prefix: string;
  separator: '' | '-' | '_';
  padding: number;
  startingNumber: number;
}

const formatPreviewNumber = (settings: EmployeeIdSettings, num: number) => {
  const paddedNum = String(num).padStart(settings.padding, '0');
  if (settings.prefix) {
    return `${settings.prefix}${settings.separator}${paddedNum}`;
  }
  return paddedNum;
};

const generateEmployeeNumber = (settings: EmployeeIdSettings, sequence: number) => {
  return formatPreviewNumber(settings, sequence);
};

export default function EmployeeIdSettingsPage() {
  const { companyId, isFrozen } = useTenant();
  const { data: company, isLoading } = useCurrentCompany();
  const queryClient = useQueryClient();
  const canEdit = !isFrozen;

  const [settings, setSettings] = useState<EmployeeIdSettings>({
    prefix: '',
    separator: '',
    padding: 3,
    startingNumber: 1,
  });
  const [hasChanges, setHasChanges] = useState(false);
  const [applyToExisting, setApplyToExisting] = useState(false);
  const [showBulkUpdateDialog, setShowBulkUpdateDialog] = useState(false);

  // Fetch employee count
  const { data: employeeCount } = useQuery({
    queryKey: ['employee-count', companyId],
    queryFn: async () => {
      if (!companyId) return 0;
      const { count } = await supabase
        .from('employees')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', companyId);
      return count || 0;
    },
    enabled: !!companyId,
  });

  // Initialize from company settings
  useEffect(() => {
    if (company) {
      const savedSettings = company.settings as { employeeId?: EmployeeIdSettings } | null;
      if (savedSettings?.employeeId) {
        setSettings(savedSettings.employeeId);
      }
    }
  }, [company]);

  const updateSettings = useMutation({
    mutationFn: async (idSettings: EmployeeIdSettings) => {
      if (!companyId) throw new Error('No company selected');

      const currentSettings = (company?.settings ?? {}) as Record<string, unknown>;
      const newSettings = {
        ...currentSettings,
        employeeId: {
          prefix: idSettings.prefix,
          separator: idSettings.separator,
          padding: idSettings.padding,
          startingNumber: idSettings.startingNumber,
        },
      };

      const { error } = await supabase
        .from('companies')
        .update({
          settings: newSettings,
          updated_at: new Date().toISOString(),
        })
        .eq('id', companyId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company', companyId] });
      toast.success('Employee ID format updated');
      setHasChanges(false);
      setApplyToExisting(false);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update settings');
    },
  });

  const updateAllEmployees = useMutation({
    mutationFn: async () => {
      if (!companyId) throw new Error('No company selected');

      const { data: employees, error: fetchError } = await supabase
        .from('employees')
        .select('id, employee_number, created_at')
        .eq('company_id', companyId)
        .order('created_at', { ascending: true });

      if (fetchError) throw fetchError;
      if (!employees || employees.length === 0) return;

      for (let i = 0; i < employees.length; i++) {
        const newNumber = generateEmployeeNumber(settings, settings.startingNumber + i);
        const { error: updateError } = await supabase
          .from('employees')
          .update({ employee_number: newNumber })
          .eq('id', employees[i].id);

        if (updateError) throw updateError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      queryClient.invalidateQueries({ queryKey: ['next-employee-number'] });
      toast.success('All employee numbers updated');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update employee numbers');
    },
  });

  const handleSave = () => {
    if (applyToExisting && employeeCount && employeeCount > 0) {
      setShowBulkUpdateDialog(true);
    } else {
      updateSettings.mutate(settings);
    }
  };

  const handleConfirmBulkUpdate = async () => {
    setShowBulkUpdateDialog(false);
    await updateSettings.mutateAsync(settings);
    await updateAllEmployees.mutateAsync();
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Hash className="h-5 w-5" />
          Employee ID Format
        </h2>
        <p className="text-muted-foreground">
          Configure how employee numbers are automatically generated
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Format Settings</CardTitle>
          <CardDescription>
            Define the structure of automatically generated employee IDs
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Prefix (optional)</Label>
              <Input
                value={settings.prefix}
                onChange={(e) => {
                  setSettings((prev) => ({ ...prev, prefix: e.target.value }));
                  setHasChanges(true);
                }}
                disabled={!canEdit}
                placeholder="e.g., EMP, STAFF"
              />
              <p className="text-xs text-muted-foreground">
                Added before the number (e.g., EMP-001)
              </p>
            </div>

            <div className="space-y-2">
              <Label>Separator</Label>
              <Select
                value={settings.separator || 'none'}
                onValueChange={(value) => {
                  setSettings((prev) => ({
                    ...prev,
                    separator: value === 'none' ? '' : (value as '-' | '_'),
                  }));
                  setHasChanges(true);
                }}
                disabled={!canEdit}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="-">Hyphen (-)</SelectItem>
                  <SelectItem value="_">Underscore (_)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Number Padding</Label>
              <Select
                value={String(settings.padding)}
                onValueChange={(value) => {
                  setSettings((prev) => ({ ...prev, padding: parseInt(value, 10) }));
                  setHasChanges(true);
                }}
                disabled={!canEdit}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5, 6].map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n} digits (e.g., {'0'.repeat(n - 1) + '1'})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Starting Number</Label>
              <Input
                type="number"
                min={1}
                value={settings.startingNumber}
                onChange={(e) => {
                  setSettings((prev) => ({
                    ...prev,
                    startingNumber: parseInt(e.target.value, 10) || 1,
                  }));
                  setHasChanges(true);
                }}
                disabled={!canEdit}
              />
            </div>
          </div>

          {/* Preview */}
          <div className="bg-muted rounded-lg p-4">
            <Label className="text-sm font-medium">Preview</Label>
            <div className="flex flex-wrap gap-2 mt-2">
              {[0, 1, 2].map((i) => (
                <Badge key={i} variant="secondary" className="text-base font-mono">
                  {formatPreviewNumber(settings, settings.startingNumber + i)}
                </Badge>
              ))}
              <span className="text-muted-foreground">...</span>
            </div>
          </div>

          {/* Bulk Update Option */}
          {employeeCount && employeeCount > 0 && (
            <div className="flex items-center space-x-2 p-4 border rounded-lg bg-muted/30">
              <Checkbox
                id="apply-to-existing"
                checked={applyToExisting}
                onCheckedChange={(checked) => setApplyToExisting(checked === true)}
                disabled={!canEdit}
              />
              <div className="space-y-1">
                <Label htmlFor="apply-to-existing" className="cursor-pointer">
                  Apply to existing employees
                </Label>
                <p className="text-xs text-muted-foreground">
                  Update {employeeCount} existing employee numbers to match the new format
                </p>
              </div>
            </div>
          )}

          {canEdit && (
            <Button
              onClick={handleSave}
              disabled={!hasChanges || updateSettings.isPending || updateAllEmployees.isPending}
            >
              {(updateSettings.isPending || updateAllEmployees.isPending) && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Save Changes
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Bulk Update Confirmation */}
      <AlertDialog open={showBulkUpdateDialog} onOpenChange={setShowBulkUpdateDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Update All Employee Numbers?</AlertDialogTitle>
            <AlertDialogDescription>
              This will update {employeeCount} employee numbers to match the new format. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmBulkUpdate}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Update All
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
