import { useState, useEffect } from 'react';
import { useTenant } from '@/contexts/TenantContext';
import { useCompany } from '@/hooks/useCompany';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Shield, Key, Smartphone, Clock, AlertTriangle, Save, Loader2, Lock, Info } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { SecurityEventsViewer } from '@/components/security/SecurityEventsViewer';
import { TrustedDevicesManager } from '@/components/security/TrustedDevicesManager';
import { MFAEnforcementSettings } from '@/components/security/MFAEnforcementSettings';

const SESSION_TIMEOUT_OPTIONS = [
  { value: '15', label: '15 minutes' },
  { value: '30', label: '30 minutes' },
  { value: '60', label: '1 hour' },
  { value: '120', label: '2 hours' },
  { value: '480', label: '8 hours' },
  { value: '0', label: 'Never (not recommended)' },
];

export default function SecuritySettingsPage() {
  const { isFrozen } = useTenant();
  const { currentCompanyId } = useAuth();
  const { data: company, isLoading: companyLoading } = useCompany(currentCompanyId);
  
  const [sessionTimeout, setSessionTimeout] = useState('30');
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Load current settings from company settings
  useEffect(() => {
    if (company?.settings) {
      const settings = company.settings as Record<string, unknown>;
      const savedTimeout = settings.session_timeout_minutes;
      if (savedTimeout !== undefined) {
        setSessionTimeout(String(savedTimeout));
      }
    }
  }, [company?.settings]);

  const handleTimeoutChange = (value: string) => {
    setSessionTimeout(value);
    setHasChanges(true);
  };

  const handleSave = async () => {
    if (!currentCompanyId) return;
    
    setIsSaving(true);
    try {
      const currentSettings = (company?.settings as Record<string, unknown>) || {};
      const { error } = await supabase
        .from('companies')
        .update({
          settings: {
            ...currentSettings,
            session_timeout_minutes: parseInt(sessionTimeout, 10),
          },
        })
        .eq('id', currentCompanyId);

      if (error) throw error;

      toast.success('Security settings saved');
      setHasChanges(false);
    } catch (error) {
      console.error('Failed to save settings:', error);
      toast.error('Failed to save security settings');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Session Timeout Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Session Timeout
          </CardTitle>
          <CardDescription>
            Configure automatic logout after inactivity to protect user accounts
            {isFrozen && <span className="ml-2 text-destructive">(Read-only while account is frozen)</span>}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-end gap-4">
            <div className="flex-1 space-y-2">
              <Label htmlFor="session-timeout">Inactivity Timeout Duration</Label>
              <Select
                value={sessionTimeout}
                onValueChange={handleTimeoutChange}
                disabled={isFrozen || companyLoading}
              >
                <SelectTrigger id="session-timeout" className="w-full sm:w-[250px]">
                  <SelectValue placeholder="Select timeout duration" />
                </SelectTrigger>
                <SelectContent>
                  {SESSION_TIMEOUT_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">
                Users will be automatically logged out after this period of inactivity. 
                A 5-minute warning will be shown before logout.
              </p>
            </div>
            <Button
              onClick={handleSave}
              disabled={!hasChanges || isSaving || isFrozen}
            >
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
          
          {sessionTimeout === '0' && (
            <div className="flex items-center gap-2 p-3 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-lg">
              <AlertTriangle className="h-4 w-4 flex-shrink-0" />
              <p className="text-sm">
                Disabling session timeout is not recommended for security reasons. 
                Consider using a longer timeout instead.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* MFA Enforcement */}
      <MFAEnforcementSettings />

      {/* Other Security Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Security Policies</CardTitle>
          <CardDescription>
            Additional security configurations for your organization
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Password Policy */}
          <div className="flex items-start gap-4 py-3">
            <div className="p-2 rounded-lg bg-muted">
              <Key className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <h4 className="font-medium">Password Policy</h4>
                <Tooltip>
                  <TooltipTrigger>
                    <Badge variant="secondary">
                      <Lock className="h-3 w-3 mr-1" />
                      Platform Default
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    Password requirements are configured at the platform level for security
                  </TooltipContent>
                </Tooltip>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Minimum 8 characters with complexity requirements enforced by the platform
              </p>
            </div>
          </div>

          <Separator />

          {/* MFA */}
          <div className="flex items-start gap-4 py-3">
            <div className="p-2 rounded-lg bg-muted">
              <Smartphone className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <h4 className="font-medium">Multi-Factor Authentication (MFA)</h4>
                <div className="flex items-center gap-2">
                  <Tooltip>
                    <TooltipTrigger>
                      <Badge variant="outline" className="gap-1">
                        <Clock className="h-3 w-3" />
                        Coming Soon
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent>
                      MFA configuration will be available in a future update
                    </TooltipContent>
                  </Tooltip>
                </div>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Require additional verification for account access. Currently configured per-user in Compliance settings.
              </p>
            </div>
          </div>

          <Separator />

          {/* SSO */}
          <div className="flex items-start gap-4 py-3">
            <div className="p-2 rounded-lg bg-muted">
              <Shield className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <h4 className="font-medium">Single Sign-On (SSO)</h4>
                <Tooltip>
                  <TooltipTrigger>
                    <Badge variant="secondary" className="gap-1">
                      <Info className="h-3 w-3" />
                      Enterprise Plan
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    SSO integration is available on Enterprise plans. Contact sales to upgrade.
                  </TooltipContent>
                </Tooltip>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Enterprise authentication integration with SAML/OIDC providers
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Trusted Devices */}
      <TrustedDevicesManager />

      {/* Security Events Viewer */}
      <SecurityEventsViewer />
    </div>
  );
}
