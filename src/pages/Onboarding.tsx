import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Loader2, Building2, ArrowRight } from 'lucide-react';

const INDUSTRIES = [
  'Technology',
  'Healthcare',
  'Finance',
  'Manufacturing',
  'Retail',
  'Education',
  'Consulting',
  'Other',
];

const SIZE_RANGES = [
  '1-10',
  '11-50',
  '51-200',
  '201-500',
  '500+',
];

export default function Onboarding() {
  const navigate = useNavigate();
  const { refreshUserContext, user, isLoading: authLoading, isPlatformAdmin, isAuthenticated } = useAuth();
  
  const [isLoading, setIsLoading] = useState(false);
  const [companyName, setCompanyName] = useState('');
  const [industry, setIndustry] = useState('');
  const [sizeRange, setSizeRange] = useState('');

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate('/auth', { replace: true });
    }
  }, [authLoading, isAuthenticated, navigate]);

  // Redirect platform admins - they cannot create companies
  useEffect(() => {
    if (!authLoading && isAuthenticated && isPlatformAdmin) {
      toast.error('Platform admins cannot create companies. Use impersonation to access company data.');
      navigate('/platform/dashboard', { replace: true });
    }
  }, [isPlatformAdmin, authLoading, isAuthenticated, navigate]);

  // Redirect to dashboard if user already has companies
  useEffect(() => {
    if (!authLoading && isAuthenticated && user && !isPlatformAdmin) {
      const hasCompanies = user.companies && user.companies.length > 0;
      if (hasCompanies) {
        navigate('/app/dashboard', { replace: true });
      }
    }
  }, [user, authLoading, isPlatformAdmin, isAuthenticated, navigate]);

  const generateSlug = (name: string): string => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 50);
  };

  const handleCreateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!companyName.trim()) {
      toast.error('Please enter a company name');
      return;
    }
    
    setIsLoading(true);
    
    try {
      const slug = generateSlug(companyName) + '-' + Date.now().toString(36);
      
      const { data, error } = await supabase.rpc('create_company_with_admin', {
        _name: companyName.trim(),
        _slug: slug,
        _industry: industry || null,
        _size_range: sizeRange || null,
      });
      
      if (error) {
        if (error.message.includes('duplicate')) {
          toast.error('A company with this name already exists');
        } else {
          toast.error(error.message);
        }
        return;
      }
      
      await refreshUserContext();
      toast.success('Company created successfully!');
      navigate('/app/dashboard', { replace: true });
    } catch (err) {
      console.error('Error creating company:', err);
      toast.error('Failed to create company. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Show loading while checking if user has companies
  if (user && user.companies && user.companies.length > 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/20 p-4">
      <div className="w-full max-w-lg">
        <div className="flex items-center justify-center mb-8">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-primary">
              <Building2 className="h-6 w-6 text-primary-foreground" />
            </div>
            <span className="text-2xl font-bold">HR Platform</span>
          </div>
        </div>

        <Card className="border-border/50 shadow-xl">
          <form onSubmit={handleCreateCompany}>
            <CardHeader>
              <CardTitle>Create Your Company</CardTitle>
              <CardDescription>
                Set up your company profile to start managing your HR operations.
              </CardDescription>
            </CardHeader>
            
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="company-name">Company Name *</Label>
                <Input
                  id="company-name"
                  placeholder="Acme Corporation"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  disabled={isLoading}
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="industry">Industry</Label>
                <Select value={industry} onValueChange={setIndustry} disabled={isLoading}>
                  <SelectTrigger id="industry">
                    <SelectValue placeholder="Select your industry" />
                  </SelectTrigger>
                  <SelectContent>
                    {INDUSTRIES.map((ind) => (
                      <SelectItem key={ind} value={ind}>
                        {ind}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="size">Company Size</Label>
                <Select value={sizeRange} onValueChange={setSizeRange} disabled={isLoading}>
                  <SelectTrigger id="size">
                    <SelectValue placeholder="Select company size" />
                  </SelectTrigger>
                  <SelectContent>
                    {SIZE_RANGES.map((size) => (
                      <SelectItem key={size} value={size}>
                        {size} employees
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="bg-muted/50 rounded-lg p-4">
                <p className="text-sm text-muted-foreground">
                  You'll start on a <span className="font-medium text-foreground">14-day free trial</span> with 
                  access to all features. No credit card required.
                </p>
              </div>
            </CardContent>
            
            <CardFooter>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <ArrowRight className="mr-2 h-4 w-4" />
                )}
                Create Company
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}