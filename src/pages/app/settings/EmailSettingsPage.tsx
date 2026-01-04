// Company Email Settings Configuration
import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Mail, Send, ChevronDown, CheckCircle2, XCircle, HelpCircle, Eye, EyeOff, AlertTriangle, RefreshCw, FileText } from 'lucide-react';
import { useCompanyEmailSettings, type EmailProvider } from '@/hooks/useCompanyEmailSettings';
import { useTenant } from '@/contexts/TenantContext';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { EmailTemplatesSection } from '@/components/settings/EmailTemplatesSection';

const PROVIDER_OPTIONS: { value: EmailProvider; label: string; description: string }[] = [
  { value: 'smtp', label: 'SMTP', description: 'Connect to any SMTP server' },
  { value: 'resend', label: 'Resend', description: 'Modern email API with great deliverability' },
  { value: 'mailersend', label: 'MailerSend', description: 'Transactional email service' },
  { value: 'sendgrid', label: 'SendGrid', description: 'Twilio SendGrid email API' },
  { value: 'brevo', label: 'Brevo', description: 'Brevo (formerly Sendinblue) email API' },
  { value: 'ses', label: 'AWS SES', description: 'Amazon Simple Email Service' },
];

export default function EmailSettingsPage() {
  const queryClient = useQueryClient();
  const { companyId } = useTenant();
  const { settings, isLoading, error, saveSettings, isSaving, sendTestEmail, isTesting } = useCompanyEmailSettings();
  
  const [usePlatformDefault, setUsePlatformDefault] = useState(true);
  const [provider, setProvider] = useState<EmailProvider>('smtp');
  const [fromEmail, setFromEmail] = useState('');
  const [fromName, setFromName] = useState('');
  
  // SMTP settings
  const [smtpHost, setSmtpHost] = useState('');
  const [smtpPort, setSmtpPort] = useState('587');
  const [smtpUsername, setSmtpUsername] = useState('');
  const [smtpPassword, setSmtpPassword] = useState('');
  const [smtpSecure, setSmtpSecure] = useState(true);
  
  // API settings
  const [apiKey, setApiKey] = useState('');
  
  // AWS SES settings
  const [awsRegion, setAwsRegion] = useState('us-east-1');
  const [awsAccessKeyId, setAwsAccessKeyId] = useState('');
  const [awsSecretAccessKey, setAwsSecretAccessKey] = useState('');
  
  // Test email
  const [testEmailAddress, setTestEmailAddress] = useState('');
  
  // Password visibility
  const [showPassword, setShowPassword] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);

  // Sync state when settings load
  useEffect(() => {
    if (settings) {
      setUsePlatformDefault(settings.use_platform_default ?? true);
      setProvider((settings.provider as EmailProvider) ?? 'smtp');
      setFromEmail(settings.from_email ?? '');
      setFromName(settings.from_name ?? '');
      setSmtpHost(settings.smtp_host ?? '');
      setSmtpPort(settings.smtp_port?.toString() ?? '587');
      setSmtpUsername(settings.smtp_username ?? '');
      setSmtpSecure(settings.smtp_secure ?? true);
      setAwsRegion(settings.aws_region ?? 'us-east-1');
    }
  }, [settings]);

  const handleSave = async () => {
    try {
      await saveSettings({
        use_platform_default: usePlatformDefault,
        provider: usePlatformDefault ? undefined : provider,
        from_email: usePlatformDefault ? undefined : fromEmail,
        from_name: usePlatformDefault ? undefined : fromName,
        smtp_host: provider === 'smtp' ? smtpHost : undefined,
        smtp_port: provider === 'smtp' ? parseInt(smtpPort) : undefined,
        smtp_username: provider === 'smtp' ? smtpUsername : undefined,
        smtp_password: provider === 'smtp' && smtpPassword ? smtpPassword : undefined,
        smtp_secure: provider === 'smtp' ? smtpSecure : undefined,
        api_key: ['resend', 'mailersend', 'sendgrid', 'brevo'].includes(provider) && apiKey ? apiKey : undefined,
        aws_region: provider === 'ses' ? awsRegion : undefined,
        aws_access_key_id: provider === 'ses' && awsAccessKeyId ? awsAccessKeyId : undefined,
        aws_secret_access_key: provider === 'ses' && awsSecretAccessKey ? awsSecretAccessKey : undefined,
      });
      toast.success('Email settings saved successfully');
    } catch (error) {
      toast.error('Failed to save email settings');
    }
  };

  const handleTestEmail = async () => {
    if (!testEmailAddress) {
      toast.error('Please enter a test email address');
      return;
    }
    sendTestEmail(testEmailAddress);
  };

  const handleRetry = () => {
    queryClient.invalidateQueries({ queryKey: ['company-email-settings', companyId] });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Handle error state
  if (error) {
    const errorMessage = error.message || 'Failed to load email settings';
    const isAuthError = errorMessage.includes('log in') || errorMessage.includes('expired') || errorMessage.includes('authenticated');
    
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold">Email Configuration</h2>
          <p className="text-sm text-muted-foreground">
            Configure how your company sends email notifications
          </p>
        </div>
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>
              {isAuthError 
                ? 'Your session has expired. Please sign out and sign in again.' 
                : `Couldn't load email settings: ${errorMessage}`}
            </span>
            {!isAuthError && (
              <Button variant="outline" size="sm" onClick={handleRetry}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Retry
              </Button>
            )}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Email Settings</h2>
        <p className="text-sm text-muted-foreground">
          Configure email providers and manage email templates
        </p>
      </div>

      <Tabs defaultValue="configuration" className="w-full">
        <TabsList>
          <TabsTrigger value="configuration">
            <Mail className="h-4 w-4 mr-2" />
            Configuration
          </TabsTrigger>
          <TabsTrigger value="templates">
            <FileText className="h-4 w-4 mr-2" />
            Templates
          </TabsTrigger>
        </TabsList>

        <TabsContent value="configuration" className="space-y-6 mt-6">

      {/* Configuration Mode */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Email Provider</CardTitle>
          <CardDescription>
            Choose to use the platform's default email settings or configure your own
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Use Platform Default</Label>
              <p className="text-sm text-muted-foreground">
                Emails will be sent using the platform's configured provider
              </p>
            </div>
            <Switch
              checked={usePlatformDefault}
              onCheckedChange={setUsePlatformDefault}
            />
          </div>

          {usePlatformDefault && (
            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription>
                Using platform default email settings. No additional configuration needed.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Custom Configuration */}
      {!usePlatformDefault && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Provider Settings</CardTitle>
              <CardDescription>
                Select and configure your email provider
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Email Provider</Label>
                <Select value={provider} onValueChange={(v) => setProvider(v as EmailProvider)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PROVIDER_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        <div className="flex flex-col">
                          <span>{opt.label}</span>
                          <span className="text-xs text-muted-foreground">{opt.description}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>From Name</Label>
                  <Input
                    value={fromName}
                    onChange={(e) => setFromName(e.target.value)}
                    placeholder="Your Company"
                  />
                </div>
                <div className="space-y-2">
                  <Label>From Email</Label>
                  <Input
                    type="email"
                    value={fromEmail}
                    onChange={(e) => setFromEmail(e.target.value)}
                    placeholder="notifications@yourcompany.com"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* SMTP Settings */}
          {provider === 'smtp' && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">SMTP Settings</CardTitle>
                <CardDescription>
                  Configure your SMTP server connection
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>SMTP Host</Label>
                    <Input
                      value={smtpHost}
                      onChange={(e) => setSmtpHost(e.target.value)}
                      placeholder="smtp.example.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>SMTP Port</Label>
                    <Input
                      type="number"
                      value={smtpPort}
                      onChange={(e) => setSmtpPort(e.target.value)}
                      placeholder="587"
                    />
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Username</Label>
                    <Input
                      value={smtpUsername}
                      onChange={(e) => setSmtpUsername(e.target.value)}
                      placeholder="username"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Password</Label>
                    <div className="relative">
                      <Input
                        type={showPassword ? 'text' : 'password'}
                        value={smtpPassword}
                        onChange={(e) => setSmtpPassword(e.target.value)}
                        placeholder={settings?.smtp_password ? '••••••••' : 'Enter password'}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="smtp-secure"
                    checked={smtpSecure}
                    onCheckedChange={setSmtpSecure}
                  />
                  <Label htmlFor="smtp-secure">Use TLS/SSL</Label>
                </div>
              </CardContent>
            </Card>
          )}

          {/* API Key Settings */}
          {['resend', 'mailersend', 'sendgrid', 'brevo'].includes(provider) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{provider.charAt(0).toUpperCase() + provider.slice(1)} API Key</CardTitle>
                <CardDescription>
                  Enter your API key from {provider.charAt(0).toUpperCase() + provider.slice(1)}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Label>API Key</Label>
                  <div className="relative">
                    <Input
                      type={showApiKey ? 'text' : 'password'}
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder={settings?.api_key ? '••••••••' : 'Enter API key'}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3"
                      onClick={() => setShowApiKey(!showApiKey)}
                    >
                      {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* AWS SES Settings */}
          {provider === 'ses' && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">AWS SES Settings</CardTitle>
                <CardDescription>
                  Configure your Amazon SES credentials
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>AWS Region</Label>
                  <Select value={awsRegion} onValueChange={setAwsRegion}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="us-east-1">US East (N. Virginia)</SelectItem>
                      <SelectItem value="us-west-2">US West (Oregon)</SelectItem>
                      <SelectItem value="eu-west-1">EU (Ireland)</SelectItem>
                      <SelectItem value="eu-central-1">EU (Frankfurt)</SelectItem>
                      <SelectItem value="ap-southeast-1">Asia Pacific (Singapore)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Access Key ID</Label>
                  <Input
                    value={awsAccessKeyId}
                    onChange={(e) => setAwsAccessKeyId(e.target.value)}
                    placeholder={settings?.aws_access_key_id ? '••••••••' : 'AKIA...'}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Secret Access Key</Label>
                  <Input
                    type="password"
                    value={awsSecretAccessKey}
                    onChange={(e) => setAwsSecretAccessKey(e.target.value)}
                    placeholder={settings?.aws_secret_access_key ? '••••••••' : 'Enter secret key'}
                  />
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Test Email */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Test Email</CardTitle>
          <CardDescription>
            Send a test email to verify your configuration
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              type="email"
              value={testEmailAddress}
              onChange={(e) => setTestEmailAddress(e.target.value)}
              placeholder="test@example.com"
              className="flex-1"
            />
            <Button onClick={handleTestEmail} disabled={isTesting}>
              {isTesting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Send Test
            </Button>
          </div>
          {settings?.last_test_at && (
            <div className="mt-3 flex items-center gap-2 text-sm">
              {settings.is_verified ? (
                <Badge variant="outline" className="text-green-600 border-green-600">
                  <CheckCircle2 className="h-3 w-3 mr-1" /> Verified
                </Badge>
              ) : (
                <Badge variant="outline" className="text-destructive border-destructive">
                  <XCircle className="h-3 w-3 mr-1" /> Not Verified
                </Badge>
              )}
              <span className="text-muted-foreground">
                Last tested: {new Date(settings.last_test_at).toLocaleString()}
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          Save Settings
        </Button>
      </div>

      {/* Help Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <HelpCircle className="h-4 w-4" />
            Setup Guides
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Collapsible>
            <CollapsibleTrigger className="flex items-center justify-between w-full py-2 text-sm font-medium hover:underline">
              SMTP Setup Guide
              <ChevronDown className="h-4 w-4" />
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2 pb-4 text-sm text-muted-foreground space-y-2">
              <p>Common SMTP settings:</p>
              <ul className="list-disc pl-4 space-y-1">
                <li><strong>Gmail:</strong> smtp.gmail.com, Port 587 (requires App Password)</li>
                <li><strong>Outlook/Office 365:</strong> smtp.office365.com, Port 587</li>
                <li><strong>SendGrid SMTP:</strong> smtp.sendgrid.net, Port 587</li>
              </ul>
              <p className="mt-2">Note: Most providers require TLS/SSL enabled.</p>
            </CollapsibleContent>
          </Collapsible>

          <Collapsible>
            <CollapsibleTrigger className="flex items-center justify-between w-full py-2 text-sm font-medium hover:underline">
              Resend Setup
              <ChevronDown className="h-4 w-4" />
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2 pb-4 text-sm text-muted-foreground space-y-2">
              <ol className="list-decimal pl-4 space-y-1">
                <li>Sign up at <a href="https://resend.com" target="_blank" className="text-primary hover:underline">resend.com</a></li>
                <li>Verify your domain in the Domains section</li>
                <li>Create an API key in API Keys section</li>
                <li>Paste the API key above</li>
              </ol>
            </CollapsibleContent>
          </Collapsible>

          <Collapsible>
            <CollapsibleTrigger className="flex items-center justify-between w-full py-2 text-sm font-medium hover:underline">
              Troubleshooting
              <ChevronDown className="h-4 w-4" />
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2 pb-4 text-sm text-muted-foreground space-y-2">
              <ul className="list-disc pl-4 space-y-1">
                <li><strong>Emails not sending?</strong> Check your API key/credentials are correct</li>
                <li><strong>Going to spam?</strong> Verify your sending domain with your provider</li>
                <li><strong>Connection timeout?</strong> Check firewall settings and port numbers</li>
              </ul>
            </CollapsibleContent>
          </Collapsible>
        </CardContent>
      </Card>
        </TabsContent>

        <TabsContent value="templates" className="mt-6">
          <EmailTemplatesSection />
        </TabsContent>
      </Tabs>
    </div>
  );
}
