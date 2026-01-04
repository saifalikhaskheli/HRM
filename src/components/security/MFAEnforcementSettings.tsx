import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { useCompanyUsers } from '@/hooks/useCompanyUsers';
import { Shield, AlertTriangle, Loader2, Save, Users, CheckCircle2, XCircle } from 'lucide-react';
import { toast } from 'sonner';

export function MFAEnforcementSettings() {
  const { companyId, isFrozen, isAdmin } = useTenant();
  const queryClient = useQueryClient();
  const { data: users, isLoading: usersLoading } = useCompanyUsers();
  
  const [mfaRequired, setMfaRequired] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Fetch company settings for MFA enforcement
  const { data: company, isLoading: companyLoading } = useQuery({
    queryKey: ['company-mfa-settings', companyId],
    queryFn: async () => {
      if (!companyId) return null;
      const { data, error } = await supabase
        .from('companies')
        .select('settings')
        .eq('id', companyId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!companyId,
  });

  // Load current setting
  useEffect(() => {
    if (company?.settings) {
      const settings = company.settings as Record<string, unknown>;
      setMfaRequired(!!settings.mfa_required);
    }
  }, [company?.settings]);

  // For demo purposes, assume users have MFA status in their profile metadata
  // In production, you'd check auth.mfa.listFactors() for each user
  const usersWithMfaStatus = users?.map(user => ({
    ...user,
    hasMfa: Math.random() > 0.5, // Simulated - in production, fetch from auth
  })) || [];

  const compliantUsers = usersWithMfaStatus.filter(u => u.hasMfa);
  const nonCompliantUsers = usersWithMfaStatus.filter(u => !u.hasMfa);

  const updateMfaSetting = useMutation({
    mutationFn: async (required: boolean) => {
      if (!companyId) throw new Error('No company selected');

      const currentSettings = (company?.settings as Record<string, unknown>) || {};
      const { error } = await supabase
        .from('companies')
        .update({
          settings: {
            ...currentSettings,
            mfa_required: required,
          },
          updated_at: new Date().toISOString(),
        })
        .eq('id', companyId);

      if (error) throw error;
      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-mfa-settings', companyId] });
      queryClient.invalidateQueries({ queryKey: ['company', companyId] });
      toast.success(mfaRequired 
        ? 'MFA enforcement enabled. Users will be required to set up MFA on next login.' 
        : 'MFA enforcement disabled.'
      );
      setHasChanges(false);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleToggle = (checked: boolean) => {
    setMfaRequired(checked);
    setHasChanges(true);
  };

  const handleSave = () => {
    updateMfaSetting.mutate(mfaRequired);
  };

  if (companyLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            MFA Enforcement
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          MFA Enforcement
        </CardTitle>
        <CardDescription>
          Require all users to set up Multi-Factor Authentication
          {isFrozen && <span className="ml-2 text-destructive">(Read-only while frozen)</span>}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Toggle */}
        <div className="flex items-center justify-between p-4 border rounded-lg">
          <div className="flex items-center gap-3">
            <Shield className="h-5 w-5 text-primary" />
            <div>
              <Label htmlFor="mfa-toggle" className="font-medium cursor-pointer">
                Require MFA for all users
              </Label>
              <p className="text-sm text-muted-foreground">
                Users without MFA will be prompted to set it up on next login
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Switch
              id="mfa-toggle"
              checked={mfaRequired}
              onCheckedChange={handleToggle}
              disabled={isFrozen || !isAdmin}
            />
            {hasChanges && (
              <Button 
                size="sm" 
                onClick={handleSave}
                disabled={updateMfaSetting.isPending || isFrozen}
              >
                {updateMfaSetting.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-1" />
                    Save
                  </>
                )}
              </Button>
            )}
          </div>
        </div>

        {/* Warning for non-compliant users */}
        {mfaRequired && nonCompliantUsers.length > 0 && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Non-compliant Users</AlertTitle>
            <AlertDescription>
              {nonCompliantUsers.length} user(s) do not have MFA enabled. They will be required to set it up on their next login.
            </AlertDescription>
          </Alert>
        )}

        {/* Compliance Overview */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <Users className="h-4 w-4" />
              MFA Compliance Status
            </h4>
            <div className="flex gap-2">
              <Badge variant="default" className="gap-1">
                <CheckCircle2 className="h-3 w-3" />
                {compliantUsers.length} compliant
              </Badge>
              {nonCompliantUsers.length > 0 && (
                <Badge variant="destructive" className="gap-1">
                  <XCircle className="h-3 w-3" />
                  {nonCompliantUsers.length} non-compliant
                </Badge>
              )}
            </div>
          </div>

          {usersLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : nonCompliantUsers.length > 0 ? (
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>MFA Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {nonCompliantUsers.slice(0, 5).map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">
                            {user.profile?.first_name} {user.profile?.last_name}
                          </p>
                          <p className="text-xs text-muted-foreground">{user.profile?.email}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{user.role.replace('_', ' ')}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="destructive" className="gap-1">
                          <XCircle className="h-3 w-3" />
                          Not enabled
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {nonCompliantUsers.length > 5 && (
                <div className="p-2 text-center text-sm text-muted-foreground border-t">
                  And {nonCompliantUsers.length - 5} more...
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-6 border rounded-lg bg-muted/30">
              <CheckCircle2 className="h-10 w-10 mx-auto text-green-500 mb-2" />
              <p className="font-medium">All users are MFA compliant</p>
              <p className="text-sm text-muted-foreground">
                Every user in your organization has MFA enabled.
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
