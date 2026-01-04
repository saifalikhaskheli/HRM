import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Loader2, MapPin } from 'lucide-react';

interface CompanyAddress {
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  country?: string;
  postal_code?: string;
}

interface CompanyAddressSectionProps {
  address: CompanyAddress | null;
  email: string | null;
  phone: string | null;
  industry: string | null;
  sizeRange: string | null;
  disabled?: boolean;
}

const SIZE_RANGES = [
  { value: '1-10', label: '1-10 employees' },
  { value: '11-50', label: '11-50 employees' },
  { value: '51-200', label: '51-200 employees' },
  { value: '201-500', label: '201-500 employees' },
  { value: '501-1000', label: '501-1000 employees' },
  { value: '1000+', label: '1000+ employees' },
];

const INDUSTRIES = [
  'Technology',
  'Healthcare',
  'Finance',
  'Education',
  'Manufacturing',
  'Retail',
  'Construction',
  'Professional Services',
  'Hospitality',
  'Non-profit',
  'Government',
  'Other',
];

export function CompanyAddressSection({
  address: initialAddress,
  email: initialEmail,
  phone: initialPhone,
  industry: initialIndustry,
  sizeRange: initialSizeRange,
  disabled,
}: CompanyAddressSectionProps) {
  const { companyId } = useTenant();
  const queryClient = useQueryClient();

  const [address, setAddress] = useState<CompanyAddress>(initialAddress || {});
  const [email, setEmail] = useState(initialEmail || '');
  const [phone, setPhone] = useState(initialPhone || '');
  const [industry, setIndustry] = useState(initialIndustry || '');
  const [sizeRange, setSizeRange] = useState(initialSizeRange || '');
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    setAddress(initialAddress || {});
    setEmail(initialEmail || '');
    setPhone(initialPhone || '');
    setIndustry(initialIndustry || '');
    setSizeRange(initialSizeRange || '');
    setHasChanges(false);
  }, [initialAddress, initialEmail, initialPhone, initialIndustry, initialSizeRange]);

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!companyId) throw new Error('No company selected');

      const { error } = await supabase
        .from('companies')
        .update({
          address: address as Record<string, string>,
          email: email || null,
          phone: phone || null,
          industry: industry || null,
          size_range: sizeRange || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', companyId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company', companyId] });
      toast.success('Company information updated');
      setHasChanges(false);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update company information');
    },
  });

  const handleAddressChange = (field: keyof CompanyAddress, value: string) => {
    setAddress((prev) => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!disabled) {
      updateMutation.mutate();
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="h-5 w-5" />
          Company Address & Contact
        </CardTitle>
        <CardDescription>
          Your company's physical address and contact information
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="company-email">Company Email</Label>
              <Input
                id="company-email"
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setHasChanges(true); }}
                placeholder="contact@company.com"
                disabled={disabled}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="company-phone">Company Phone</Label>
              <Input
                id="company-phone"
                type="tel"
                value={phone}
                onChange={(e) => { setPhone(e.target.value); setHasChanges(true); }}
                placeholder="+1 (555) 000-0000"
                disabled={disabled}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="industry">Industry</Label>
              <Select
                value={industry}
                onValueChange={(v) => { setIndustry(v); setHasChanges(true); }}
                disabled={disabled}
              >
                <SelectTrigger id="industry">
                  <SelectValue placeholder="Select industry" />
                </SelectTrigger>
                <SelectContent>
                  {INDUSTRIES.map((ind) => (
                    <SelectItem key={ind} value={ind}>{ind}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="size-range">Company Size</Label>
              <Select
                value={sizeRange}
                onValueChange={(v) => { setSizeRange(v); setHasChanges(true); }}
                disabled={disabled}
              >
                <SelectTrigger id="size-range">
                  <SelectValue placeholder="Select company size" />
                </SelectTrigger>
                <SelectContent>
                  {SIZE_RANGES.map((size) => (
                    <SelectItem key={size.value} value={size.value}>{size.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="border-t pt-4 mt-4">
            <Label className="text-base font-medium">Address</Label>
          </div>

          <div className="space-y-2">
            <Label htmlFor="address-line1">Address Line 1</Label>
            <Input
              id="address-line1"
              value={address.line1 || ''}
              onChange={(e) => handleAddressChange('line1', e.target.value)}
              placeholder="123 Main Street"
              disabled={disabled}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="address-line2">Address Line 2</Label>
            <Input
              id="address-line2"
              value={address.line2 || ''}
              onChange={(e) => handleAddressChange('line2', e.target.value)}
              placeholder="Suite 100"
              disabled={disabled}
            />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="address-city">City</Label>
              <Input
                id="address-city"
                value={address.city || ''}
                onChange={(e) => handleAddressChange('city', e.target.value)}
                placeholder="New York"
                disabled={disabled}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address-state">State / Province</Label>
              <Input
                id="address-state"
                value={address.state || ''}
                onChange={(e) => handleAddressChange('state', e.target.value)}
                placeholder="NY"
                disabled={disabled}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address-postal">Postal Code</Label>
              <Input
                id="address-postal"
                value={address.postal_code || ''}
                onChange={(e) => handleAddressChange('postal_code', e.target.value)}
                placeholder="10001"
                disabled={disabled}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address-country">Country</Label>
              <Input
                id="address-country"
                value={address.country || ''}
                onChange={(e) => handleAddressChange('country', e.target.value)}
                placeholder="United States"
                disabled={disabled}
              />
            </div>
          </div>

          {!disabled && (
            <Button type="submit" disabled={!hasChanges || updateMutation.isPending}>
              {updateMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
