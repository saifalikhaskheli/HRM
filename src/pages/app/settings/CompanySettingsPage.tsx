import { useState, useEffect, useCallback } from 'react';
import { useTenant } from '@/contexts/TenantContext';
import { useCurrentCompany } from '@/hooks/useCompany';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Building2, Check, X } from 'lucide-react';
import { MultiCompanyRequestDialog } from '@/components/MultiCompanyRequestDialog';
import { CompanyLogoUpload } from '@/components/settings/CompanyLogoUpload';
import { CompanyAddressSection } from '@/components/settings/CompanyAddressSection';
import { FiscalYearSettings } from '@/components/settings/FiscalYearSettings';

export default function CompanySettingsPage() {
  const { companyId, isFrozen } = useTenant();
  const { data: company, isLoading, error } = useCurrentCompany();
  const queryClient = useQueryClient();
  const canEdit = !isFrozen;

  const [companyName, setCompanyName] = useState('');
  const [companySlug, setCompanySlug] = useState('');
  const [timezone, setTimezone] = useState('');
  const [hasChanges, setHasChanges] = useState(false);
  const [slugError, setSlugError] = useState<string | null>(null);
  const [isCheckingSlug, setIsCheckingSlug] = useState(false);
  const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null);


  // Validate slug format
  const validateSlug = useCallback((slug: string): string | null => {
    if (!slug) return 'Company code is required';
    if (slug.length < 3) return 'Must be at least 3 characters';
    if (slug.length > 50) return 'Must be 50 characters or less';
    if (!/^[a-z0-9]/.test(slug)) return 'Must start with a letter or number';
    if (!/[a-z0-9]$/.test(slug)) return 'Must end with a letter or number';
    if (!/^[a-z0-9-]+$/.test(slug)) return 'Only lowercase letters, numbers, and hyphens allowed';
    if (/--/.test(slug)) return 'Cannot have consecutive hyphens';
    return null;
  }, []);

  // Check slug availability with debounce
  const checkSlugAvailability = useCallback(async (slug: string) => {
    if (!companyId || !slug || slug === company?.slug) {
      setSlugAvailable(slug === company?.slug ? true : null);
      return;
    }
    
    const validationError = validateSlug(slug);
    if (validationError) {
      setSlugAvailable(null);
      return;
    }

    setIsCheckingSlug(true);
    try {
      const { data } = await supabase
        .from('companies')
        .select('id')
        .eq('slug', slug)
        .neq('id', companyId)
        .maybeSingle();
      
      setSlugAvailable(!data);
      if (data) {
        setSlugError('This code is already in use');
      }
    } catch {
      setSlugAvailable(null);
    } finally {
      setIsCheckingSlug(false);
    }
  }, [companyId, company?.slug, validateSlug]);

  // Debounced slug check
  useEffect(() => {
    if (!companySlug || companySlug === company?.slug) {
      setSlugError(null);
      setSlugAvailable(companySlug === company?.slug ? true : null);
      return;
    }

    const error = validateSlug(companySlug);
    setSlugError(error);
    
    if (!error) {
      const timeout = setTimeout(() => {
        checkSlugAvailability(companySlug);
      }, 500);
      return () => clearTimeout(timeout);
    } else {
      setSlugAvailable(null);
    }
  }, [companySlug, company?.slug, validateSlug, checkSlugAvailability]);

  // Initialize form when data loads
  useEffect(() => {
    if (company) {
      setCompanyName(company.name);
      setCompanySlug(company.slug);
      setTimezone(company.timezone || 'UTC');
    }
  }, [company]);

  const updateCompany = useMutation({
    mutationFn: async (updates: { name: string; slug: string; timezone: string }) => {
      if (!companyId) throw new Error('No company selected');

      const { error } = await supabase
        .from('companies')
        .update({
          name: updates.name,
          slug: updates.slug,
          timezone: updates.timezone,
          updated_at: new Date().toISOString(),
        })
        .eq('id', companyId);

      if (error) {
        if (error.code === '23505') {
          throw new Error('This company code is already in use. Please choose another.');
        }
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company', companyId] });
      toast.success('Company settings updated successfully');
      setHasChanges(false);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update company settings');
    },
  });


  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) return;
    if (slugError || (slugAvailable === false)) return;
    updateCompany.mutate({ name: companyName, slug: companySlug, timezone });
  };

  const handleSlugChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Auto-convert to lowercase and replace invalid chars
    const value = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '');
    setCompanySlug(value);
    setHasChanges(true);
    setSlugAvailable(null);
  };

  const isSlugValid = !slugError && slugAvailable !== false;

  const handleChange = (setter: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setter(e.target.value);
    setHasChanges(true);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Company Settings</CardTitle>
          <CardDescription>Manage your company profile and preferences</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-10 w-full" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-10 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Company Settings</CardTitle>
          <CardDescription>Manage your company profile and preferences</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-destructive">
            Failed to load company settings. Please try again.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>Company Settings</CardTitle>
            <CardDescription>
              Manage your company profile and preferences
              {isFrozen && <span className="ml-2 text-destructive">(Read-only while account is frozen)</span>}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <CompanyLogoUpload
              currentLogoUrl={company?.logo_url || null}
              companyName={company?.name || ''}
              disabled={!canEdit}
            />

            <div className="space-y-2">
              <Label htmlFor="company-name">Company Name</Label>
              <Input 
                id="company-name" 
                value={companyName}
                onChange={handleChange(setCompanyName)}
                disabled={!canEdit} 
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="company-slug">Company Code (for Employee Sign-in)</Label>
              <div className="relative">
                <Input 
                  id="company-slug" 
                  value={companySlug}
                  onChange={handleSlugChange}
                  disabled={!canEdit}
                  placeholder="e.g., acme-corp"
                  className={slugError || slugAvailable === false ? 'border-destructive pr-10' : slugAvailable === true ? 'border-green-500 pr-10' : 'pr-10'}
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  {isCheckingSlug && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                  {!isCheckingSlug && slugAvailable === true && <Check className="h-4 w-4 text-green-500" />}
                  {!isCheckingSlug && (slugError || slugAvailable === false) && <X className="h-4 w-4 text-destructive" />}
                </div>
              </div>
              {slugError && (
                <p className="text-xs text-destructive">{slugError}</p>
              )}
              {!slugError && (
                <p className="text-xs text-muted-foreground">
                  Employees use this code when signing in. Only lowercase letters, numbers, and hyphens.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="timezone">Timezone</Label>
              <Input 
                id="timezone" 
                value={timezone}
                onChange={handleChange(setTimezone)}
                disabled={!canEdit}
                placeholder="e.g., America/New_York" 
              />
              <p className="text-xs text-muted-foreground">
                Enter a valid IANA timezone (e.g., UTC, America/New_York, Europe/London)
              </p>
            </div>

            {canEdit && (
              <Button 
                type="submit" 
                disabled={!hasChanges || updateCompany.isPending || !isSlugValid}
              >
                {updateCompany.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Save Changes
              </Button>
            )}
          </CardContent>
        </Card>
      </form>

      {/* Company Address & Contact */}
      <CompanyAddressSection
        address={(company?.address as Record<string, string>) || null}
        email={company?.email || null}
        phone={company?.phone || null}
        industry={company?.industry || null}
        sizeRange={company?.size_range || null}
        disabled={!canEdit}
      />

      {/* Fiscal Year Settings */}
      <FiscalYearSettings />

      {/* Multi-Company Access */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Multi-Company Access
          </CardTitle>
          <CardDescription>
            Need to manage or join multiple companies? Request access to expand your account capabilities.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <MultiCompanyRequestDialog />
        </CardContent>
      </Card>
    </div>
  );
}
