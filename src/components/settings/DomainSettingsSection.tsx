import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { 
  Globe, 
  Plus, 
  Trash2, 
  CheckCircle, 
  AlertCircle, 
  Clock, 
  RefreshCw,
  Copy,
  ExternalLink,
  Activity,
  Server,
  Star
} from 'lucide-react';

type HostingProvider = 'lovable' | 'vercel';

interface DomainRecord {
  id: string;
  custom_domain: string | null;
  subdomain: string | null;
  is_verified: boolean | null;
  is_primary: boolean | null;
  is_active: boolean | null;
  verification_token: string | null;
  hosting_provider: HostingProvider | null;
  created_at: string | null;
  vercel_status: string | null;
  vercel_verified: boolean | null;
  vercel_error: string | null;
}

interface HealthCheckResult {
  domain: string;
  rootResolved: boolean;
  rootIp: string | null;
  wildcardConfigured: boolean;
  wwwResolved: boolean;
  wwwIp: string | null;
  isHealthy: boolean;
  messages: string[];
  expectedIp?: string;
  ipMismatch?: boolean;
}

const HOSTING_IPS: Record<HostingProvider, string> = {
  lovable: '185.158.133.1',
  vercel: '76.76.21.21'
};

export function DomainSettingsSection() {
  const { companyId, companySlug } = useTenant();
  const { user } = useAuth();
  
  const [domains, setDomains] = useState<DomainRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newDomain, setNewDomain] = useState('');
  const [hostingProvider, setHostingProvider] = useState<HostingProvider>('vercel');
  const [isAdding, setIsAdding] = useState(false);
  const [verifyingDomain, setVerifyingDomain] = useState<string | null>(null);
  const [deletingDomain, setDeletingDomain] = useState<string | null>(null);
  
  // Dialog states
  const [showDnsDialog, setShowDnsDialog] = useState(false);
  const [selectedDomain, setSelectedDomain] = useState<DomainRecord | null>(null);
  const [showHealthDialog, setShowHealthDialog] = useState(false);
  const [healthResult, setHealthResult] = useState<HealthCheckResult | null>(null);
  const [isCheckingHealth, setIsCheckingHealth] = useState(false);
  const [showSubdomainRequestDialog, setShowSubdomainRequestDialog] = useState(false);
  const [subdomainRequestReason, setSubdomainRequestReason] = useState('');
  const [requestedSubdomain, setRequestedSubdomain] = useState('');
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);
  const [pendingSubdomainRequest, setPendingSubdomainRequest] = useState<any>(null);
  const [settingPrimary, setSettingPrimary] = useState<string | null>(null);

  // Load domains on mount
  useEffect(() => {
    loadDomains();
    loadPendingSubdomainRequest();
  }, [companyId]);

  async function loadDomains() {
    if (!companyId) return;
    
    try {
      const { data, error } = await supabase
        .from('company_domains')
        .select('*')
        .eq('company_id', companyId)
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      // Cast the hosting_provider to the correct type
      const typedData: DomainRecord[] = (data || []).map(d => ({
        ...d,
        hosting_provider: (d.hosting_provider as HostingProvider) || 'vercel',
        vercel_status: d.vercel_status,
        vercel_verified: d.vercel_verified,
        vercel_error: d.vercel_error,
      }));
      setDomains(typedData);
    } catch (error) {
      console.error('Error loading domains:', error);
    } finally {
      setIsLoading(false);
    }
  }

  async function loadPendingSubdomainRequest() {
    if (!companyId) return;
    
    try {
      const { data } = await supabase
        .from('subdomain_change_requests')
        .select('*')
        .eq('company_id', companyId)
        .eq('status', 'pending')
        .single();
      
      setPendingSubdomainRequest(data);
    } catch {
      // No pending request
    }
  }

  async function handleAddDomain() {
    if (!newDomain.trim() || !companyId) return;
    
    const domain = newDomain.toLowerCase().trim().replace(/^(https?:\/\/)?(www\.)?/, '').replace(/\/$/, '');
    
    if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(domain)) {
      toast.error('Please enter a valid domain name');
      return;
    }
    
    setIsAdding(true);
    
    try {
      const verificationToken = `hrplatform-${crypto.randomUUID().slice(0, 12)}`;
      
      // First, add to database
      const { data, error } = await supabase
        .from('company_domains')
        .insert({
          company_id: companyId,
          custom_domain: domain,
          verification_token: verificationToken,
          is_verified: false,
          is_active: false,
          hosting_provider: hostingProvider,
          vercel_status: hostingProvider === 'vercel' ? 'adding' : null,
        })
        .select()
        .single();
      
      if (error) {
        if (error.code === '23505') {
          toast.error('This domain is already registered');
        } else {
          throw error;
        }
        return;
      }
      
      const typedData: DomainRecord = {
        ...data,
        hosting_provider: (data.hosting_provider as HostingProvider) || 'vercel',
        vercel_status: data.vercel_status,
        vercel_verified: data.vercel_verified,
        vercel_error: data.vercel_error,
      };
      
      // If Vercel hosting, add domain to Vercel project
      if (hostingProvider === 'vercel') {
        toast.info('Adding domain to Vercel...');
        
        const { data: vercelResult, error: vercelError } = await supabase.functions.invoke('manage-vercel-domain', {
          body: { 
            action: 'add',
            domain,
            domainId: data.id,
            companyId
          }
        });
        
        if (vercelError || !vercelResult?.success) {
          const errorMsg = vercelResult?.error || vercelError?.message || 'Failed to add domain to Vercel';
          toast.error(errorMsg);
          
          // Update local state with error
          typedData.vercel_status = 'error';
          typedData.vercel_error = errorMsg;
        } else {
          typedData.vercel_status = vercelResult.data?.verified ? 'active' : 'pending';
          typedData.vercel_verified = vercelResult.data?.verified || false;
          toast.success('Domain added to Vercel! Configure your DNS records.');
        }
      }
      
      setDomains(prev => [...prev, typedData]);
      setNewDomain('');
      setSelectedDomain(typedData);
      setShowDnsDialog(true);
    } catch (error) {
      console.error('Error adding domain:', error);
      toast.error('Failed to add domain');
    } finally {
      setIsAdding(false);
    }
  }

  async function handleVerifyDomain(domain: DomainRecord) {
    if (!domain.custom_domain) return;
    
    setVerifyingDomain(domain.id);
    
    try {
      // For Vercel domains, use Vercel verification
      if (domain.hosting_provider === 'vercel') {
        const { data: vercelResult, error: vercelError } = await supabase.functions.invoke('manage-vercel-domain', {
          body: { 
            action: 'verify',
            domain: domain.custom_domain,
            domainId: domain.id,
            companyId
          }
        });
        
        if (vercelError) throw vercelError;
        
        if (vercelResult?.success && vercelResult?.verified) {
          setDomains(prev => prev.map(d => 
            d.id === domain.id ? { 
              ...d, 
              is_verified: true, 
              is_active: true,
              vercel_status: 'active',
              vercel_verified: true 
            } : d
          ));
          toast.success('Domain verified successfully!');
        } else {
          toast.error(vercelResult?.error || 'Domain verification failed. Please check your DNS records.');
        }
      } else {
        // Use existing verification for non-Vercel domains
        const { data, error } = await supabase.functions.invoke('verify-domain', {
          body: { 
            domain: domain.custom_domain,
            companyId: companyId
          }
        });
        
        if (error) throw error;
        
        if (data.verified) {
          await supabase
            .from('company_domains')
            .update({ 
              is_verified: true, 
              is_active: true,
              verified_at: new Date().toISOString()
            })
            .eq('id', domain.id);
          
          setDomains(prev => prev.map(d => 
            d.id === domain.id ? { ...d, is_verified: true, is_active: true } : d
          ));
          toast.success('Domain verified successfully!');
        } else {
          toast.error(data.message || 'Domain verification failed. Please check your DNS records.');
        }
      }
    } catch (error) {
      console.error('Error verifying domain:', error);
      toast.error('Failed to verify domain');
    } finally {
      setVerifyingDomain(null);
    }
  }

  async function handleDeleteDomain(domain: DomainRecord) {
    setDeletingDomain(domain.id);
    
    try {
      // For Vercel domains, remove from Vercel first
      if (domain.hosting_provider === 'vercel' && domain.custom_domain) {
        const { data: vercelResult, error: vercelError } = await supabase.functions.invoke('manage-vercel-domain', {
          body: { 
            action: 'remove',
            domain: domain.custom_domain,
            domainId: domain.id,
            companyId
          }
        });
        
        if (vercelError) {
          console.warn('Failed to remove domain from Vercel:', vercelError);
          // Continue with database deletion even if Vercel removal fails
        } else if (!vercelResult?.success) {
          console.warn('Vercel domain removal failed:', vercelResult?.error);
        }
      }
      
      const { error } = await supabase
        .from('company_domains')
        .delete()
        .eq('id', domain.id);
      
      if (error) throw error;
      
      setDomains(prev => prev.filter(d => d.id !== domain.id));
      toast.success('Domain removed');
    } catch (error) {
      console.error('Error deleting domain:', error);
      toast.error('Failed to remove domain');
    } finally {
      setDeletingDomain(null);
    }
  }

  async function handleCheckHealth(domain: DomainRecord) {
    if (!domain.custom_domain) return;
    
    setSelectedDomain(domain);
    setIsCheckingHealth(true);
    setShowHealthDialog(true);
    setHealthResult(null);
    
    try {
      const provider = (domain.hosting_provider || 'vercel') as HostingProvider;
      const { data, error } = await supabase.functions.invoke('check-domain-health', {
        body: { 
          domain: domain.custom_domain,
          hostingProvider: provider
        }
      });
      
      if (error) throw error;
      setHealthResult(data);
    } catch (error) {
      console.error('Error checking domain health:', error);
      toast.error('Failed to check domain health');
      setShowHealthDialog(false);
    } finally {
      setIsCheckingHealth(false);
    }
  }

  async function handleRegenerateToken(domain: DomainRecord) {
    const newToken = `hrplatform-${crypto.randomUUID().slice(0, 12)}`;
    
    try {
      const { error } = await supabase
        .from('company_domains')
        .update({ verification_token: newToken })
        .eq('id', domain.id);
      
      if (error) throw error;
      
      setDomains(prev => prev.map(d => 
        d.id === domain.id ? { ...d, verification_token: newToken } : d
      ));
      setSelectedDomain(prev => prev ? { ...prev, verification_token: newToken } : null);
      toast.success('Verification token regenerated');
    } catch (error) {
      console.error('Error regenerating token:', error);
      toast.error('Failed to regenerate token');
    }
  }

  async function handleSubmitSubdomainRequest() {
    if (!requestedSubdomain.trim() || !subdomainRequestReason.trim() || !companyId || !user?.user_id) return;
    
    setIsSubmittingRequest(true);
    
    try {
      const { error } = await supabase
        .from('subdomain_change_requests')
        .insert({
          company_id: companyId,
          requested_by: user.user_id,
          current_subdomain: companySlug || '',
          requested_subdomain: requestedSubdomain.toLowerCase().trim(),
          reason: subdomainRequestReason.trim()
        });
      
      if (error) throw error;
      
      toast.success('Subdomain change request submitted');
      setShowSubdomainRequestDialog(false);
      setRequestedSubdomain('');
      setSubdomainRequestReason('');
      loadPendingSubdomainRequest();
    } catch (error) {
      console.error('Error submitting request:', error);
      toast.error('Failed to submit request');
    } finally {
      setIsSubmittingRequest(false);
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  }

  async function handleSetPrimaryDomain(domainId: string) {
    if (!companyId) return;
    
    setSettingPrimary(domainId);
    
    try {
      // First, clear any existing primary domain for this company
      await supabase
        .from('company_domains')
        .update({ is_primary: false })
        .eq('company_id', companyId);
      
      // Then set the new primary
      const { error } = await supabase
        .from('company_domains')
        .update({ is_primary: true })
        .eq('id', domainId);
      
      if (error) throw error;
      
      // Update local state
      setDomains(prev => prev.map(d => ({
        ...d,
        is_primary: d.id === domainId
      })));
      
      toast.success('Primary domain updated. Users will be redirected here after login.');
    } catch (error) {
      console.error('Error setting primary domain:', error);
      toast.error('Failed to set primary domain');
    } finally {
      setSettingPrimary(null);
    }
  }

  const platformSubdomain = domains.find(d => d.subdomain && !d.custom_domain);
  const customDomains = domains.filter(d => d.custom_domain);

  if (!companyId) return null;

  return (
    <div className="space-y-6">
      <Separator />
      
      <div>
        <h3 className="text-lg font-medium">Domain Settings</h3>
        <p className="text-sm text-muted-foreground">
          Manage your platform subdomain and custom domains
        </p>
      </div>

      {/* Platform Subdomain */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Server className="h-4 w-4" />
            Platform Subdomain
          </CardTitle>
          <CardDescription>
            Your default subdomain on the platform
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <p className="font-medium">{companySlug}.thefruitbazaar.com</p>
                {platformSubdomain?.is_primary && (
                  <Badge variant="default" className="bg-primary/10 text-primary border-primary/20">
                    <Star className="h-3 w-3 mr-1 fill-current" />
                    Primary
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                {platformSubdomain?.is_primary 
                  ? 'Users logging in from the base URL will be redirected here'
                  : 'Your default access URL'
                }
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  setIsCheckingHealth(true);
                  setSelectedDomain(platformSubdomain || null);
                  setShowHealthDialog(true);
                  setHealthResult(null);
                  try {
                    const { data, error } = await supabase.functions.invoke('check-domain-health', {
                      body: { 
                        domain: `${companySlug}.thefruitbazaar.com`,
                        hostingProvider: 'vercel'
                      }
                    });
                    if (error) throw error;
                    setHealthResult(data);
                  } catch (error) {
                    console.error('Error checking subdomain health:', error);
                    toast.error('Failed to check subdomain health');
                    setShowHealthDialog(false);
                  } finally {
                    setIsCheckingHealth(false);
                  }
                }}
                disabled={isCheckingHealth}
              >
                {isCheckingHealth ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Activity className="h-4 w-4 mr-1" />
                    Health Check
                  </>
                )}
              </Button>
              {platformSubdomain && !platformSubdomain.is_primary && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleSetPrimaryDomain(platformSubdomain.id)}
                  disabled={settingPrimary === platformSubdomain.id}
                >
                  {settingPrimary === platformSubdomain.id ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Star className="h-4 w-4 mr-1" />
                      Set Primary
                    </>
                  )}
                </Button>
              )}
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setShowSubdomainRequestDialog(true)}
                disabled={!!pendingSubdomainRequest}
              >
                Request Change
              </Button>
            </div>
          </div>
          
          {pendingSubdomainRequest && (
            <Alert>
              <Clock className="h-4 w-4" />
              <AlertDescription>
                You have a pending request to change your subdomain to <strong>{pendingSubdomainRequest.requested_subdomain}</strong>. 
                Our team will review it shortly.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Custom Domains */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Globe className="h-4 w-4" />
            Custom Domains
          </CardTitle>
          <CardDescription>
            Connect your own domain to access the platform
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Existing domains */}
          {customDomains.length > 0 && (
            <div className="space-y-3">
              {customDomains.map(domain => (
                <div key={domain.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">{domain.custom_domain}</span>
                        {domain.is_primary && (
                          <Badge variant="default" className="bg-primary/10 text-primary border-primary/20">
                            <Star className="h-3 w-3 mr-1 fill-current" />
                            Primary
                          </Badge>
                        )}
                        {domain.is_verified ? (
                          <Badge variant="default" className="bg-green-500/10 text-green-600 border-green-500/20">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Verified
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">
                            <AlertCircle className="h-3 w-3 mr-1" />
                            Pending
                          </Badge>
                        )}
                        <Badge variant="outline" className="text-xs">
                          {domain.hosting_provider === 'lovable' ? 'Lovable' : 'Vercel'}
                        </Badge>
                        {/* Vercel-specific status */}
                        {domain.hosting_provider === 'vercel' && domain.vercel_status && (
                          <>
                            {domain.vercel_status === 'active' && (
                              <Badge variant="default" className="bg-blue-500/10 text-blue-600 border-blue-500/20 text-xs">
                                Vercel Active
                              </Badge>
                            )}
                            {domain.vercel_status === 'adding' && (
                              <Badge variant="secondary" className="bg-blue-500/10 text-blue-600 border-blue-500/20 text-xs">
                                <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                                Adding to Vercel
                              </Badge>
                            )}
                            {domain.vercel_status === 'pending' && (
                              <Badge variant="secondary" className="bg-orange-500/10 text-orange-600 border-orange-500/20 text-xs">
                                <Clock className="h-3 w-3 mr-1" />
                                Vercel Pending DNS
                              </Badge>
                            )}
                            {domain.vercel_status === 'misconfigured' && (
                              <Badge variant="destructive" className="text-xs">
                                <AlertCircle className="h-3 w-3 mr-1" />
                                DNS Misconfigured
                              </Badge>
                            )}
                            {domain.vercel_status === 'error' && (
                              <Badge variant="destructive" className="text-xs">
                                <AlertCircle className="h-3 w-3 mr-1" />
                                Error
                              </Badge>
                            )}
                          </>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Added {new Date(domain.created_at!).toLocaleDateString()}
                        {domain.vercel_error && (
                          <span className="text-destructive ml-2">• {domain.vercel_error}</span>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {!domain.is_verified && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleVerifyDomain(domain)}
                        disabled={verifyingDomain === domain.id}
                      >
                        {verifyingDomain === domain.id ? (
                          <RefreshCw className="h-4 w-4 animate-spin" />
                        ) : (
                          'Verify'
                        )}
                      </Button>
                    )}
                    {domain.is_verified && !domain.is_primary && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleSetPrimaryDomain(domain.id)}
                        disabled={settingPrimary === domain.id}
                      >
                        {settingPrimary === domain.id ? (
                          <RefreshCw className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <Star className="h-4 w-4 mr-1" />
                            Set Primary
                          </>
                        )}
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedDomain(domain);
                        setShowDnsDialog(true);
                      }}
                    >
                      DNS Setup
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCheckHealth(domain)}
                    >
                      <Activity className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteDomain(domain)}
                      disabled={deletingDomain === domain.id}
                      className="text-destructive hover:text-destructive"
                    >
                      {deletingDomain === domain.id ? (
                        <RefreshCw className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Add new domain */}
          <div className="space-y-3 pt-2">
            <Label>Add Custom Domain</Label>
            <div className="flex gap-2">
              <Input
                placeholder="hr.yourcompany.com"
                value={newDomain}
                onChange={(e) => setNewDomain(e.target.value)}
                className="flex-1"
              />
              <Select value={hostingProvider} onValueChange={(v) => setHostingProvider(v as HostingProvider)}>
                <SelectTrigger className="w-[130px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="vercel">Vercel</SelectItem>
                  <SelectItem value="lovable">Lovable</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={handleAddDomain} disabled={isAdding || !newDomain.trim()}>
                {isAdding ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Select your hosting provider to get the correct DNS configuration
            </p>
          </div>
        </CardContent>
      </Card>

      {/* DNS Setup Dialog */}
      <Dialog open={showDnsDialog} onOpenChange={setShowDnsDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>DNS Configuration</DialogTitle>
            <DialogDescription>
              Add these DNS records at your domain registrar for {selectedDomain?.custom_domain}
            </DialogDescription>
          </DialogHeader>
          
          {selectedDomain && (
            <div className="space-y-4">
              <Alert>
                <Server className="h-4 w-4" />
                <AlertDescription>
                  Hosting Provider: <strong>{selectedDomain.hosting_provider === 'lovable' ? 'Lovable' : 'Vercel'}</strong>
                </AlertDescription>
              </Alert>

              <div className="space-y-3">
                <div>
                  <Label className="text-sm font-medium">A Record (Root Domain)</Label>
                  <div className="mt-1 p-3 bg-muted rounded-lg font-mono text-sm space-y-1">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Type:</span>
                      <span>A</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Name:</span>
                      <span>@ or {selectedDomain.custom_domain?.split('.')[0]}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Value:</span>
                      <div className="flex items-center gap-2">
                        <span>{HOSTING_IPS[(selectedDomain.hosting_provider || 'vercel') as HostingProvider]}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() => copyToClipboard(HOSTING_IPS[(selectedDomain.hosting_provider || 'vercel') as HostingProvider])}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <Label className="text-sm font-medium">A Record (www subdomain)</Label>
                  <div className="mt-1 p-3 bg-muted rounded-lg font-mono text-sm space-y-1">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Type:</span>
                      <span>A</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Name:</span>
                      <span>www</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Value:</span>
                      <div className="flex items-center gap-2">
                        <span>{HOSTING_IPS[(selectedDomain.hosting_provider || 'vercel') as HostingProvider]}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() => copyToClipboard(HOSTING_IPS[(selectedDomain.hosting_provider || 'vercel') as HostingProvider])}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">TXT Record (Verification)</Label>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRegenerateToken(selectedDomain)}
                    >
                      <RefreshCw className="h-3 w-3 mr-1" />
                      Regenerate
                    </Button>
                  </div>
                  <div className="mt-1 p-3 bg-muted rounded-lg font-mono text-sm space-y-1">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Type:</span>
                      <span>TXT</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Name:</span>
                      <span>_hrplatform-verify</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Value:</span>
                      <div className="flex items-center gap-2">
                        <span className="truncate max-w-[200px]">{selectedDomain.verification_token}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() => copyToClipboard(selectedDomain.verification_token || '')}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  DNS changes can take up to 48 hours to propagate. After adding these records, click "Verify" to check the configuration.
                </AlertDescription>
              </Alert>

              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <ExternalLink className="h-4 w-4" />
                <a 
                  href={selectedDomain.hosting_provider === 'lovable' 
                    ? 'https://docs.lovable.dev/features/custom-domain'
                    : 'https://vercel.com/docs/projects/domains'
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:underline"
                >
                  {selectedDomain.hosting_provider === 'lovable' ? 'Lovable' : 'Vercel'} Domain Documentation
                </a>
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDnsDialog(false)}>
              Close
            </Button>
            {selectedDomain && !selectedDomain.is_verified && (
              <Button 
                onClick={() => {
                  handleVerifyDomain(selectedDomain);
                  setShowDnsDialog(false);
                }}
              >
                Verify Domain
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Health Check Dialog */}
      <Dialog open={showHealthDialog} onOpenChange={setShowHealthDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Domain Health Check</DialogTitle>
            <DialogDescription>
              DNS configuration status for {selectedDomain?.custom_domain}
            </DialogDescription>
          </DialogHeader>
          
          {isCheckingHealth ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : healthResult && (
            <div className="space-y-4">
              <div className={`p-4 rounded-lg ${healthResult.isHealthy ? 'bg-green-500/10' : 'bg-yellow-500/10'}`}>
                <div className="flex items-center gap-2">
                  {healthResult.isHealthy ? (
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-yellow-600" />
                  )}
                  <span className={`font-medium ${healthResult.isHealthy ? 'text-green-600' : 'text-yellow-600'}`}>
                    {healthResult.isHealthy ? 'Domain is healthy' : 'Configuration issues detected'}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between p-2 border rounded">
                  <span>Root Domain Resolution</span>
                  {healthResult.rootResolved ? (
                    <Badge variant="default" className="bg-green-500/10 text-green-600">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      {healthResult.rootIp}
                    </Badge>
                  ) : (
                    <Badge variant="destructive">Not Resolved</Badge>
                  )}
                </div>
                <div className="flex items-center justify-between p-2 border rounded">
                  <span>WWW Subdomain</span>
                  {healthResult.wwwResolved ? (
                    <Badge variant="default" className="bg-green-500/10 text-green-600">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      {healthResult.wwwIp}
                    </Badge>
                  ) : (
                    <Badge variant="secondary">Not Configured</Badge>
                  )}
                </div>
                {healthResult.ipMismatch && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      IP mismatch! Expected {healthResult.expectedIp} but found {healthResult.rootIp}. 
                      Please update your DNS A record.
                    </AlertDescription>
                  </Alert>
                )}
              </div>

              {healthResult.messages.length > 0 && (
                <div className="space-y-1">
                  <Label className="text-sm font-medium">Details</Label>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    {healthResult.messages.map((msg, i) => (
                      <li key={i}>• {msg}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowHealthDialog(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Subdomain Change Request Dialog */}
      <Dialog open={showSubdomainRequestDialog} onOpenChange={setShowSubdomainRequestDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Subdomain Change</DialogTitle>
            <DialogDescription>
              Submit a request to change your platform subdomain. Our team will review it.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Current Subdomain</Label>
              <Input value={`${companySlug}.thefruitbazaar.com`} disabled />
            </div>
            
            <div className="space-y-2">
              <Label>Requested Subdomain</Label>
              <div className="flex items-center gap-2">
                <Input
                  placeholder="new-subdomain"
                  value={requestedSubdomain}
                  onChange={(e) => setRequestedSubdomain(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                />
                <span className="text-muted-foreground">.thefruitbazaar.com</span>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>Reason for Change</Label>
              <Input
                placeholder="e.g., Rebranding, typo correction..."
                value={subdomainRequestReason}
                onChange={(e) => setSubdomainRequestReason(e.target.value)}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSubdomainRequestDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSubmitSubdomainRequest}
              disabled={isSubmittingRequest || !requestedSubdomain.trim() || !subdomainRequestReason.trim()}
            >
              {isSubmittingRequest ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : null}
              Submit Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
