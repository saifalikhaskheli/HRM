import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { Settings, Mail, Palette, UserPlus, Clock, Save, Send, Loader2, Bell, CheckCircle2, XCircle, AlertCircle, ExternalLink, Globe, RefreshCw } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface BrandingSettings {
  logo_url: string | null;
  primary_color: string;
  platform_name: string;
  base_domain: string;
  support_email: string;
}

interface RegistrationSettings {
  open_registration: boolean;
  require_invite: boolean;
  allowed_domains: string[];
}

interface TrialSettings {
  default_days: number;
  extend_allowed: boolean;
  max_extensions: number;
}

interface EmailSettings {
  provider: string;
  from_name: string;
  from_address: string;
}


interface NotificationSettings {
  user_invitation: boolean;
  welcome: boolean;
  password_reset: boolean;
  leave_request_submitted: boolean;
  leave_request_approved: boolean;
  leave_request_rejected: boolean;
  payroll_processed: boolean;
  subscription_expiring: boolean;
  company_frozen: boolean;
}

// Provider secrets configuration
const PROVIDER_SECRETS: Record<string, { name: string; required: string[]; optional?: string[]; docs: string }> = {
  console: {
    name: 'Console (Development)',
    required: [],
    docs: '',
  },
  mailersend: {
    name: 'MailerSend',
    required: ['MAILERSEND_API_KEY'],
    optional: ['EMAIL_FROM_ADDRESS', 'EMAIL_FROM_NAME'],
    docs: 'https://app.mailersend.com/api-tokens',
  },
  sendgrid: {
    name: 'SendGrid',
    required: ['SENDGRID_API_KEY'],
    optional: ['EMAIL_FROM_ADDRESS', 'EMAIL_FROM_NAME'],
    docs: 'https://app.sendgrid.com/settings/api_keys',
  },
  resend: {
    name: 'Resend',
    required: ['RESEND_API_KEY'],
    optional: ['EMAIL_FROM_ADDRESS', 'EMAIL_FROM_NAME'],
    docs: 'https://resend.com/api-keys',
  },
  brevo: {
    name: 'Brevo (Sendinblue)',
    required: ['BREVO_API_KEY'],
    optional: ['EMAIL_FROM_ADDRESS', 'EMAIL_FROM_NAME'],
    docs: 'https://app.brevo.com/settings/keys/api',
  },
  'aws-ses': {
    name: 'AWS SES',
    required: ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_REGION'],
    optional: ['EMAIL_FROM_ADDRESS', 'EMAIL_FROM_NAME'],
    docs: 'https://console.aws.amazon.com/ses/',
  },
};

// Known configured secrets (fetched from edge function)
function ProviderSecretsHelper({ provider }: { provider: string }) {
  const { data: secretStatus, isLoading } = useQuery({
    queryKey: ['email-secrets-status'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('check-email-secrets');
      if (error) throw error;
      return data as Record<string, boolean>;
    },
    staleTime: 60000,
  });

  const config = PROVIDER_SECRETS[provider];
  
  if (!config || provider === 'console') {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Console mode logs emails to the edge function logs instead of sending them. 
          Select a real provider for production use.
        </AlertDescription>
      </Alert>
    );
  }

  const allRequired = config.required;
  const allOptional = config.optional || [];

  return (
    <div className="space-y-3 p-4 bg-muted/50 rounded-lg border">
      <div className="flex items-center justify-between">
        <h4 className="font-medium text-sm">{config.name} Configuration</h4>
        {config.docs && (
          <a
            href={config.docs}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-primary hover:underline flex items-center gap-1"
          >
            Get API Key <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>
      
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground font-medium">Required Secrets:</p>
        <div className="grid gap-1.5">
          {allRequired.map((secret) => (
            <SecretStatusRow 
              key={secret} 
              name={secret} 
              isConfigured={secretStatus?.[secret]} 
              isLoading={isLoading}
            />
          ))}
        </div>
      </div>

      {allOptional.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground font-medium">Optional (uses defaults if not set):</p>
          <div className="grid gap-1.5">
            {allOptional.map((secret) => (
              <SecretStatusRow 
                key={secret} 
                name={secret} 
                isConfigured={secretStatus?.[secret]} 
                isLoading={isLoading}
                optional
              />
            ))}
          </div>
        </div>
      )}

      <p className="text-xs text-muted-foreground pt-2 border-t">
        Configure secrets in{' '}
        <a
          href="https://supabase.com/dashboard/project/xwfzrbigmgyxsrzlkqwr/settings/functions"
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline"
        >
          Supabase Edge Function Secrets
        </a>
      </p>
    </div>
  );
}

function SecretStatusRow({ 
  name, 
  isConfigured, 
  isLoading,
  optional = false 
}: { 
  name: string; 
  isConfigured?: boolean; 
  isLoading: boolean;
  optional?: boolean;
}) {
  return (
    <div className="flex items-center gap-2 text-sm">
      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      ) : isConfigured ? (
        <CheckCircle2 className="h-4 w-4 text-green-500" />
      ) : optional ? (
        <AlertCircle className="h-4 w-4 text-yellow-500" />
      ) : (
        <XCircle className="h-4 w-4 text-destructive" />
      )}
      <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{name}</code>
      {isConfigured && <span className="text-xs text-green-600">Configured</span>}
      {!isConfigured && !isLoading && !optional && (
        <span className="text-xs text-destructive">Not configured</span>
      )}
      {!isConfigured && !isLoading && optional && (
        <span className="text-xs text-yellow-600">Using default</span>
      )}
    </div>
  );
}

interface DomainHealthCheckResult {
  domain: string;
  wildcardConfigured: boolean;
  rootResolvable: boolean;
  testSubdomainResolvable: boolean;
  ipAddress: string | null;
  message: string;
  details: string[];
}

function DomainHealthCheckCard({ baseDomain }: { baseDomain: string }) {
  const [isChecking, setIsChecking] = useState(false);
  const [result, setResult] = useState<DomainHealthCheckResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runHealthCheck = async () => {
    if (!baseDomain) {
      setError('Please enter a base domain in the branding settings above');
      return;
    }

    setIsChecking(true);
    setError(null);
    setResult(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('check-domain-health', {
        body: { domain: baseDomain },
      });

      if (fnError) throw fnError;
      if (data.error) throw new Error(data.error);

      setResult(data as DomainHealthCheckResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Health check failed');
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-muted-foreground" />
            <div>
              <CardTitle>Domain Health Check</CardTitle>
              <CardDescription>Verify DNS is configured for subdomain routing</CardDescription>
            </div>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={runHealthCheck} 
            disabled={isChecking || !baseDomain}
          >
            {isChecking ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            <span className="ml-2">{isChecking ? 'Checking...' : 'Run Check'}</span>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!baseDomain && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Enter a base domain in the branding settings above to run a health check.
            </AlertDescription>
          </Alert>
        )}

        {error && (
          <Alert variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {result && (
          <div className="space-y-4">
            {/* Summary */}
            <div className={`p-4 rounded-lg border ${
              result.wildcardConfigured && result.rootResolvable 
                ? 'bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800' 
                : result.rootResolvable 
                  ? 'bg-yellow-50 border-yellow-200 dark:bg-yellow-950/20 dark:border-yellow-800'
                  : 'bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-800'
            }`}>
              <div className="flex items-center gap-2">
                {result.wildcardConfigured && result.rootResolvable ? (
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                ) : result.rootResolvable ? (
                  <AlertCircle className="h-5 w-5 text-yellow-600" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-600" />
                )}
                <span className="font-medium">{result.message}</span>
              </div>
              {result.ipAddress && (
                <p className="text-sm text-muted-foreground mt-1">
                  IP Address: {result.ipAddress}
                </p>
              )}
            </div>

            {/* Details */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Check Details</h4>
              <div className="space-y-1 text-sm">
                {result.details.map((detail, i) => (
                  <div key={i} className="flex items-start gap-2 text-muted-foreground">
                    <span className="font-mono">{detail}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* DNS Instructions if wildcard not configured */}
            {!result.wildcardConfigured && result.rootResolvable && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <p className="font-medium mb-2">To enable subdomain routing, add a wildcard DNS record:</p>
                  <code className="block bg-muted p-2 rounded text-sm">
                    *.{result.domain} → {result.ipAddress || 'your-server-ip'}
                  </code>
                  <p className="text-xs mt-2">
                    This allows subdomains like company.{result.domain} to resolve to your server.
                  </p>
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        {!result && !error && baseDomain && (
          <p className="text-sm text-muted-foreground">
            Click "Run Check" to verify that <strong>{baseDomain}</strong> is properly configured for subdomain routing.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

interface WildcardHealthResult {
  baseDomain: string;
  wildcardConfigured: boolean;
  rootResolvable: boolean;
  testSubdomains: {
    subdomain: string;
    resolvable: boolean;
    ipAddress: string | null;
  }[];
  expectedIp: string | null;
  message: string;
  instructions: string[];
  vercelInstructions: string[];
  lovableInstructions: string[];
}

function WildcardSubdomainCard({ baseDomain }: { baseDomain: string }) {
  const [isChecking, setIsChecking] = useState(false);
  const [result, setResult] = useState<WildcardHealthResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runWildcardCheck = async () => {
    if (!baseDomain) {
      setError('Please enter a base domain in the branding settings above');
      return;
    }

    setIsChecking(true);
    setError(null);
    setResult(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('check-wildcard-health', {
        body: { baseDomain },
      });

      if (fnError) throw fnError;
      if (data.error) throw new Error(data.error);

      setResult(data as WildcardHealthResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Wildcard check failed');
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-muted-foreground" />
            <div>
              <CardTitle>Wildcard Subdomain Configuration</CardTitle>
              <CardDescription>Verify wildcard DNS for automatic company subdomains</CardDescription>
            </div>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={runWildcardCheck} 
            disabled={isChecking || !baseDomain}
          >
            {isChecking ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            <span className="ml-2">{isChecking ? 'Checking...' : 'Test Wildcard'}</span>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!baseDomain && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Enter a base domain in the branding settings above to configure wildcard subdomains.
            </AlertDescription>
          </Alert>
        )}

        {error && (
          <Alert variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {result && (
          <div className="space-y-4">
            {/* Wildcard Status */}
            <div className={`p-4 rounded-lg border ${
              result.wildcardConfigured 
                ? 'bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800' 
                : 'bg-yellow-50 border-yellow-200 dark:bg-yellow-950/20 dark:border-yellow-800'
            }`}>
              <div className="flex items-center gap-2">
                {result.wildcardConfigured ? (
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-yellow-600" />
                )}
                <span className="font-medium">{result.message}</span>
              </div>
              {result.expectedIp && (
                <p className="text-sm text-muted-foreground mt-1">
                  Root IP: <code className="bg-background px-1 rounded">{result.expectedIp}</code>
                </p>
              )}
            </div>

            {/* Test Subdomain Results */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Test Subdomain Resolution</h4>
              <div className="grid gap-2">
                {result.testSubdomains.map((test) => (
                  <div key={test.subdomain} className="flex items-center justify-between text-sm p-2 bg-muted rounded">
                    <code>{test.subdomain}.{result.baseDomain}</code>
                    <div className="flex items-center gap-2">
                      {test.resolvable ? (
                        <>
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                          <span className="text-green-600">{test.ipAddress}</span>
                        </>
                      ) : (
                        <>
                          <XCircle className="h-4 w-4 text-red-500" />
                          <span className="text-red-600">Not resolvable</span>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Setup Instructions */}
            {!result.wildcardConfigured && (
              <div className="space-y-4 pt-2 border-t">
                <h4 className="text-sm font-medium">Setup Instructions</h4>
                
                {/* Vercel Instructions */}
                <div className="border rounded-lg p-4 space-y-2">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-medium text-sm">Vercel (Recommended)</span>
                  </div>
                  <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                    {result.vercelInstructions.map((instruction, i) => (
                      <li key={i}>{instruction}</li>
                    ))}
                  </ol>
                </div>

                {/* Lovable Instructions */}
                <div className="border rounded-lg p-4 space-y-2">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-medium text-sm">Lovable Hosting</span>
                  </div>
                  <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                    {result.lovableInstructions.map((instruction, i) => (
                      <li key={i}>{instruction}</li>
                    ))}
                  </ol>
                </div>
              </div>
            )}
          </div>
        )}

        {!result && !error && baseDomain && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Click "Test Wildcard" to check if <strong>*.{baseDomain}</strong> is configured for automatic company subdomain routing.
            </p>
            
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <p className="font-medium mb-2">Quick Setup for Vercel:</p>
                <ol className="text-sm space-y-1 list-decimal list-inside">
                  <li>Add A record: <code className="bg-muted px-1 rounded">*.hr → 76.76.21.21</code> at your DNS provider</li>
                  <li>Add <code className="bg-muted px-1 rounded">{baseDomain}</code> and <code className="bg-muted px-1 rounded">*.{baseDomain}</code> in Vercel domains</li>
                  <li>Wait for DNS propagation (up to 48 hours)</li>
                </ol>
              </AlertDescription>
            </Alert>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function PlatformSettingsPage() {
  const queryClient = useQueryClient();
  
  const [branding, setBranding] = useState<BrandingSettings>({
    logo_url: null,
    primary_color: '#3b82f6',
    platform_name: 'HR Platform',
    base_domain: 'hrplatform.com',
    support_email: 'support@hrplatform.com',
  });
  
  const [registration, setRegistration] = useState<RegistrationSettings>({
    open_registration: false,
    require_invite: true,
    allowed_domains: [],
  });
  
  const [trial, setTrial] = useState<TrialSettings>({
    default_days: 14,
    extend_allowed: true,
    max_extensions: 2,
  });
  
  const [email, setEmail] = useState<EmailSettings>({
    provider: 'console',
    from_name: 'HR Platform',
    from_address: 'noreply@example.com',
  });


  const [notifications, setNotifications] = useState<NotificationSettings>({
    user_invitation: true,
    welcome: true,
    password_reset: true,
    leave_request_submitted: true,
    leave_request_approved: true,
    leave_request_rejected: true,
    payroll_processed: true,
    subscription_expiring: true,
    company_frozen: true,
  });

  const [domainInput, setDomainInput] = useState('');
  const [testEmailAddress, setTestEmailAddress] = useState('');

  const { data: settings, isLoading } = useQuery({
    queryKey: ['platform-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('platform_settings')
        .select('*');

      if (error) throw error;
      
      const settingsMap: Record<string, any> = {};
      data?.forEach(s => {
        settingsMap[s.key] = s.value;
      });
      
      return settingsMap;
    },
  });

  // Update local state when settings are loaded
  useEffect(() => {
    if (settings) {
      if (settings.branding) setBranding(settings.branding);
      if (settings.registration) setRegistration(settings.registration);
      if (settings.trial) setTrial(settings.trial);
      if (settings.email) setEmail(settings.email);
      
      if (settings.notifications) setNotifications(settings.notifications);
    }
  }, [settings]);

  const updateSettingMutation = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: any }) => {
      const { error } = await supabase
        .from('platform_settings')
        .update({ value })
        .eq('key', key);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Settings saved');
      queryClient.invalidateQueries({ queryKey: ['platform-settings'] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleSaveBranding = () => {
    updateSettingMutation.mutate({ key: 'branding', value: branding });
  };

  const handleSaveRegistration = () => {
    updateSettingMutation.mutate({ key: 'registration', value: registration });
  };

  const handleSaveTrial = () => {
    updateSettingMutation.mutate({ key: 'trial', value: trial });
  };

  const handleSaveEmail = () => {
    updateSettingMutation.mutate({ key: 'email', value: email });
  };


  const handleSaveNotifications = () => {
    updateSettingMutation.mutate({ key: 'notifications', value: notifications });
  };

  // Send test email mutation
  const sendTestEmailMutation = useMutation({
    mutationFn: async (toEmail: string) => {
      const { data, error } = await supabase.functions.invoke('send-test-email', {
        body: { to: toEmail },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success(data.message || 'Test email sent');
      setTestEmailAddress('');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to send test email');
    },
  });

  const handleSendTestEmail = () => {
    if (!testEmailAddress) {
      toast.error('Please enter an email address');
      return;
    }
    sendTestEmailMutation.mutate(testEmailAddress);
  };

  const handleAddDomain = () => {
    if (domainInput && !registration.allowed_domains.includes(domainInput)) {
      setRegistration({
        ...registration,
        allowed_domains: [...registration.allowed_domains, domainInput],
      });
      setDomainInput('');
    }
  };

  const handleRemoveDomain = (domain: string) => {
    setRegistration({
      ...registration,
      allowed_domains: registration.allowed_domains.filter(d => d !== domain),
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Platform Settings</h2>
          <p className="text-muted-foreground">Configure platform-wide settings</p>
        </div>
        <div className="grid gap-6">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-48 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Platform Settings</h2>
        <p className="text-muted-foreground">Configure platform-wide settings</p>
      </div>

      <div className="grid gap-6">
        {/* Branding Settings */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Palette className="h-5 w-5 text-muted-foreground" />
              <div>
                <CardTitle>Branding</CardTitle>
                <CardDescription>Customize the platform appearance</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="platform_name">Platform Name</Label>
                <Input
                  id="platform_name"
                  value={branding.platform_name}
                  onChange={(e) => setBranding({ ...branding, platform_name: e.target.value })}
                  placeholder="My HR Platform"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="primary_color">Primary Color</Label>
                <div className="flex gap-2">
                  <Input
                    id="primary_color"
                    type="color"
                    value={branding.primary_color}
                    onChange={(e) => setBranding({ ...branding, primary_color: e.target.value })}
                    className="w-16 h-10 p-1 cursor-pointer"
                  />
                  <Input
                    value={branding.primary_color}
                    onChange={(e) => setBranding({ ...branding, primary_color: e.target.value })}
                    placeholder="#3b82f6"
                    className="flex-1"
                  />
                </div>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="base_domain">Base Domain</Label>
                <Input
                  id="base_domain"
                  value={branding.base_domain}
                  onChange={(e) => setBranding({ ...branding, base_domain: e.target.value })}
                  placeholder="hrplatform.com"
                />
                <p className="text-xs text-muted-foreground">
                  Used for company subdomains (e.g., company.{branding.base_domain || 'hrplatform.com'})
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="support_email">Support Email</Label>
                <Input
                  id="support_email"
                  type="email"
                  value={branding.support_email}
                  onChange={(e) => setBranding({ ...branding, support_email: e.target.value })}
                  placeholder="support@hrplatform.com"
                />
                <p className="text-xs text-muted-foreground">
                  Displayed to users for support inquiries
                </p>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="logo_url">Logo URL</Label>
              <Input
                id="logo_url"
                value={branding.logo_url || ''}
                onChange={(e) => setBranding({ ...branding, logo_url: e.target.value || null })}
                placeholder="https://example.com/logo.png"
              />
            </div>
            <Button onClick={handleSaveBranding} disabled={updateSettingMutation.isPending}>
              <Save className="h-4 w-4 mr-2" />
              Save Branding
            </Button>
          </CardContent>
        </Card>

        {/* Domain Health Check */}
        <DomainHealthCheckCard baseDomain={branding.base_domain} />

        {/* Wildcard Subdomain Configuration */}
        <WildcardSubdomainCard baseDomain={branding.base_domain} />

        {/* Registration Settings */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-muted-foreground" />
              <div>
                <CardTitle>Registration</CardTitle>
                <CardDescription>Control how users can sign up</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                When open registration is disabled, companies can only be created by platform admins or via secure signup links.
              </AlertDescription>
            </Alert>
            
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="open_registration">Public Signup</Label>
                <p className="text-sm text-muted-foreground">Allow anyone to create a company via the signup form</p>
              </div>
              <Switch
                id="open_registration"
                checked={registration.open_registration}
                onCheckedChange={(checked) => setRegistration({ ...registration, open_registration: checked })}
              />
            </div>
            
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="require_invite">Require Invite</Label>
                <p className="text-sm text-muted-foreground">New users must be invited to join</p>
              </div>
              <Switch
                id="require_invite"
                checked={registration.require_invite}
                onCheckedChange={(checked) => setRegistration({ ...registration, require_invite: checked })}
              />
            </div>

            <div className="space-y-2">
              <Label>Allowed Email Domains</Label>
              <p className="text-sm text-muted-foreground">
                If set, only users with these domains can sign up
              </p>
              <div className="flex gap-2">
                <Input
                  value={domainInput}
                  onChange={(e) => setDomainInput(e.target.value)}
                  placeholder="example.com"
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddDomain())}
                />
                <Button type="button" variant="outline" onClick={handleAddDomain}>
                  Add
                </Button>
              </div>
              {registration.allowed_domains.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {registration.allowed_domains.map((domain) => (
                    <span
                      key={domain}
                      className="inline-flex items-center gap-1 px-2 py-1 bg-muted rounded-md text-sm"
                    >
                      {domain}
                      <button
                        type="button"
                        onClick={() => handleRemoveDomain(domain)}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <Button onClick={handleSaveRegistration} disabled={updateSettingMutation.isPending}>
              <Save className="h-4 w-4 mr-2" />
              Save Registration
            </Button>
          </CardContent>
        </Card>

        {/* Trial Settings */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-muted-foreground" />
              <div>
                <CardTitle>Trial Period</CardTitle>
                <CardDescription>Configure trial settings for new companies</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="default_days">Default Trial Length (days)</Label>
                <Input
                  id="default_days"
                  type="number"
                  min="1"
                  max="90"
                  value={trial.default_days}
                  onChange={(e) => setTrial({ ...trial, default_days: parseInt(e.target.value) || 14 })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="max_extensions">Max Extensions</Label>
                <Input
                  id="max_extensions"
                  type="number"
                  min="0"
                  max="10"
                  value={trial.max_extensions}
                  onChange={(e) => setTrial({ ...trial, max_extensions: parseInt(e.target.value) || 0 })}
                />
              </div>
            </div>
            
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="extend_allowed">Allow Trial Extensions</Label>
                <p className="text-sm text-muted-foreground">Platform admins can extend trials</p>
              </div>
              <Switch
                id="extend_allowed"
                checked={trial.extend_allowed}
                onCheckedChange={(checked) => setTrial({ ...trial, extend_allowed: checked })}
              />
            </div>

            <Button onClick={handleSaveTrial} disabled={updateSettingMutation.isPending}>
              <Save className="h-4 w-4 mr-2" />
              Save Trial Settings
            </Button>
          </CardContent>
        </Card>

        {/* Email Settings */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-muted-foreground" />
              <div>
                <CardTitle>Email Configuration</CardTitle>
                <CardDescription>Configure email sending settings</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="email_provider">Email Provider</Label>
                <Select
                  value={email.provider}
                  onValueChange={(value) => setEmail({ ...email, provider: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="console">Console (Development)</SelectItem>
                    <SelectItem value="sendgrid">SendGrid</SelectItem>
                    <SelectItem value="mailersend">MailerSend</SelectItem>
                    <SelectItem value="resend">Resend</SelectItem>
                    <SelectItem value="brevo">Brevo (Sendinblue)</SelectItem>
                    <SelectItem value="aws-ses">AWS SES</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="from_name">From Name</Label>
                <Input
                  id="from_name"
                  value={email.from_name}
                  onChange={(e) => setEmail({ ...email, from_name: e.target.value })}
                  placeholder="My Company"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="from_address">From Address</Label>
                <Input
                  id="from_address"
                  type="email"
                  value={email.from_address}
                  onChange={(e) => setEmail({ ...email, from_address: e.target.value })}
                  placeholder="noreply@example.com"
                />
              </div>
            </div>
            
            {/* Provider Secrets Helper */}
            <ProviderSecretsHelper provider={email.provider} />

            <div className="flex flex-col sm:flex-row gap-4 pt-2 border-t">
              <Button onClick={handleSaveEmail} disabled={updateSettingMutation.isPending}>
                <Save className="h-4 w-4 mr-2" />
                Save Email Settings
              </Button>
              
              <div className="flex gap-2 flex-1">
                <Input
                  type="email"
                  placeholder="test@example.com"
                  value={testEmailAddress}
                  onChange={(e) => setTestEmailAddress(e.target.value)}
                  className="max-w-xs"
                />
                <Button 
                  variant="outline"
                  onClick={handleSendTestEmail}
                  disabled={sendTestEmailMutation.isPending || !testEmailAddress}
                >
                  {sendTestEmailMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4 mr-2" />
                  )}
                  Send Test Email
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Email Notification Settings */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-muted-foreground" />
              <div>
                <CardTitle>Email Notifications</CardTitle>
                <CardDescription>Configure which events trigger automated emails</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4">
              <div className="border-b pb-2">
                <h4 className="font-medium text-sm">User & Authentication</h4>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="notif_invitation">User Invitation</Label>
                  <p className="text-sm text-muted-foreground">When a user is invited to join a company</p>
                </div>
                <Switch
                  id="notif_invitation"
                  checked={notifications.user_invitation}
                  onCheckedChange={(checked) => setNotifications({ ...notifications, user_invitation: checked })}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="notif_welcome">Welcome Email</Label>
                  <p className="text-sm text-muted-foreground">When a new user completes signup</p>
                </div>
                <Switch
                  id="notif_welcome"
                  checked={notifications.welcome}
                  onCheckedChange={(checked) => setNotifications({ ...notifications, welcome: checked })}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="notif_password">Password Reset</Label>
                  <p className="text-sm text-muted-foreground">When a user requests a password reset</p>
                </div>
                <Switch
                  id="notif_password"
                  checked={notifications.password_reset}
                  onCheckedChange={(checked) => setNotifications({ ...notifications, password_reset: checked })}
                />
              </div>

              <div className="border-b pb-2 pt-4">
                <h4 className="font-medium text-sm">Leave Management</h4>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="notif_leave_submitted">Leave Request Submitted</Label>
                  <p className="text-sm text-muted-foreground">When an employee submits a leave request</p>
                </div>
                <Switch
                  id="notif_leave_submitted"
                  checked={notifications.leave_request_submitted}
                  onCheckedChange={(checked) => setNotifications({ ...notifications, leave_request_submitted: checked })}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="notif_leave_approved">Leave Request Approved</Label>
                  <p className="text-sm text-muted-foreground">When a leave request is approved</p>
                </div>
                <Switch
                  id="notif_leave_approved"
                  checked={notifications.leave_request_approved}
                  onCheckedChange={(checked) => setNotifications({ ...notifications, leave_request_approved: checked })}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="notif_leave_rejected">Leave Request Rejected</Label>
                  <p className="text-sm text-muted-foreground">When a leave request is rejected</p>
                </div>
                <Switch
                  id="notif_leave_rejected"
                  checked={notifications.leave_request_rejected}
                  onCheckedChange={(checked) => setNotifications({ ...notifications, leave_request_rejected: checked })}
                />
              </div>

              <div className="border-b pb-2 pt-4">
                <h4 className="font-medium text-sm">Payroll & Billing</h4>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="notif_payroll">Payroll Processed</Label>
                  <p className="text-sm text-muted-foreground">When payroll is processed for employees</p>
                </div>
                <Switch
                  id="notif_payroll"
                  checked={notifications.payroll_processed}
                  onCheckedChange={(checked) => setNotifications({ ...notifications, payroll_processed: checked })}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="notif_subscription">Subscription Expiring</Label>
                  <p className="text-sm text-muted-foreground">When a company's subscription is about to expire</p>
                </div>
                <Switch
                  id="notif_subscription"
                  checked={notifications.subscription_expiring}
                  onCheckedChange={(checked) => setNotifications({ ...notifications, subscription_expiring: checked })}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="notif_frozen">Company Frozen</Label>
                  <p className="text-sm text-muted-foreground">When a company account is frozen</p>
                </div>
                <Switch
                  id="notif_frozen"
                  checked={notifications.company_frozen}
                  onCheckedChange={(checked) => setNotifications({ ...notifications, company_frozen: checked })}
                />
              </div>
            </div>

            <Button onClick={handleSaveNotifications} disabled={updateSettingMutation.isPending}>
              <Save className="h-4 w-4 mr-2" />
              Save Notification Settings
            </Button>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
