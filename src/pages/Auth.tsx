import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { Loader2, Building2, Mail, Lock, User, Hash, IdCard, Phone } from 'lucide-react';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { ForcePasswordChange } from '@/components/security/ForcePasswordChange';
import { useDomainCompany } from '@/hooks/useDomainCompany';
import { getCompanyPrimaryDomainUrl } from '@/hooks/useCompanyPrimaryDomain';
import { usePlatformSettings } from '@/hooks/usePlatformSettings';

const emailSchema = z.string().email('Please enter a valid email address');
const passwordSchema = z.string().min(8, 'Password must be at least 8 characters');

export default function Auth() {
  const navigate = useNavigate();
  const { signIn, signUp, isAuthenticated, isLoading: authLoading, currentCompanyId, isPlatformAdmin, user, refreshUserContext } = useAuth();
  const { company: domainCompany, isLoading: domainLoading, isDomainBased } = useDomainCompany();
  const { registrationSettings, isLoading: settingsLoading } = usePlatformSettings();
  
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'employee' | 'admin' | 'signup'>('admin');
  const [showForcePasswordChange, setShowForcePasswordChange] = useState(false);
  const [domainAuthTab, setDomainAuthTab] = useState<'employee' | 'admin'>('employee');
  const [lockoutMessage, setLockoutMessage] = useState<string | null>(null);
  const [failedAttempts, setFailedAttempts] = useState(0);
  
  // Check if public signup is enabled
  const isSignupEnabled = registrationSettings?.open_registration ?? false;
  // Admin login form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  // Employee login form states
  const [companySlug, setCompanySlug] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [employeePassword, setEmployeePassword] = useState('');
  
  // Signup form states
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Pre-fill company slug when domain is detected
  useEffect(() => {
    if (isDomainBased && domainCompany) {
      setCompanySlug(domainCompany.slug);
      setActiveTab('employee');
    }
  }, [isDomainBased, domainCompany]);

  useEffect(() => {
    // Wait for both auth loading AND user context to be loaded before redirecting
    if (!authLoading && isAuthenticated && user !== null && !showForcePasswordChange) {
      if (isPlatformAdmin) {
        navigate('/platform/dashboard', { replace: true });
      } else if (currentCompanyId) {
        // If on base domain (not subdomain/custom domain), redirect to company's primary domain
        if (!isDomainBased) {
          redirectToCompanyDomain(currentCompanyId);
        } else {
          navigate('/app/dashboard', { replace: true });
        }
      } else {
        navigate('/onboarding', { replace: true });
      }
    }
  }, [isAuthenticated, authLoading, currentCompanyId, isPlatformAdmin, user, navigate, showForcePasswordChange, isDomainBased]);

  async function redirectToCompanyDomain(companyId: string) {
    try {
      const primaryDomainUrl = await getCompanyPrimaryDomainUrl(companyId);
      
      if (primaryDomainUrl) {
        // Check if we're already on this domain
        const currentHost = window.location.hostname;
        const targetUrl = new URL(primaryDomainUrl);
        
        if (currentHost !== targetUrl.hostname) {
          // Redirect to the primary domain with the dashboard path
          window.location.href = `${primaryDomainUrl}/app/dashboard`;
          return;
        }
      }
      
      // Fallback: stay on current domain
      navigate('/app/dashboard', { replace: true });
    } catch (error) {
      console.error('Error redirecting to company domain:', error);
      navigate('/app/dashboard', { replace: true });
    }
  }

  const validateAdminForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    try {
      emailSchema.parse(email);
    } catch (e) {
      if (e instanceof z.ZodError) {
        newErrors.email = e.errors[0].message;
      }
    }
    
    try {
      passwordSchema.parse(password);
    } catch (e) {
      if (e instanceof z.ZodError) {
        newErrors.password = e.errors[0].message;
      }
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateEmployeeForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    if (!companySlug.trim()) {
      newErrors.companySlug = 'Company code is required';
    }
    
    if (!employeeId.trim()) {
      newErrors.employeeId = 'Employee ID is required';
    }
    
    if (!employeePassword || employeePassword.length < 8) {
      newErrors.employeePassword = 'Password must be at least 8 characters';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const checkForcePasswordChange = async (userId: string) => {
    const { data: profile } = await supabase
      .from('profiles')
      .select('force_password_change')
      .eq('id', userId)
      .single();
    
    if (profile?.force_password_change) {
      setShowForcePasswordChange(true);
      return true;
    }
    return false;
  };

  const checkAccountLockout = async (userId: string): Promise<{ locked: boolean; minutesRemaining?: number }> => {
    try {
      const { data, error } = await supabase.rpc('is_account_locked', { _user_id: userId });
      if (error) {
        console.error('Error checking lockout:', error);
        return { locked: false };
      }
      
      if (data) {
        // Get lock expiry time
        const { data: profile } = await supabase
          .from('profiles')
          .select('locked_until')
          .eq('id', userId)
          .single();
        
        if (profile?.locked_until) {
          const lockedUntil = new Date(profile.locked_until);
          const now = new Date();
          const minutesRemaining = Math.ceil((lockedUntil.getTime() - now.getTime()) / 60000);
          return { locked: true, minutesRemaining: Math.max(1, minutesRemaining) };
        }
        return { locked: true };
      }
      return { locked: false };
    } catch {
      return { locked: false };
    }
  };

  const recordFailedLogin = async (userId: string) => {
    try {
      await supabase.rpc('record_failed_login', { _user_id: userId });
    } catch (error) {
      console.error('Error recording failed login:', error);
    }
  };

  const recordSuccessfulLogin = async (userId: string) => {
    try {
      await supabase.rpc('record_successful_login', { _user_id: userId });
    } catch (error) {
      console.error('Error recording successful login:', error);
    }
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateAdminForm()) return;
    
    setIsLoading(true);
    setLockoutMessage(null);
    
    const { error } = await signIn(email, password);
    
    if (error) {
      setIsLoading(false);
      const newFailedAttempts = failedAttempts + 1;
      setFailedAttempts(newFailedAttempts);
      
      if (error.message.includes('Invalid login credentials')) {
        if (newFailedAttempts >= 3) {
          toast.error(`Invalid password. ${5 - newFailedAttempts} attempts remaining before lockout.`);
        } else {
          toast.error('Invalid email or password');
        }
      } else if (error.message.includes('Email not confirmed')) {
        toast.error('Please confirm your email address before signing in');
      } else {
        toast.error(error.message);
      }
    } else {
      // Check if password change is required
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (authUser) {
        // Record successful login
        await recordSuccessfulLogin(authUser.id);
        setFailedAttempts(0);
        
        const needsPasswordChange = await checkForcePasswordChange(authUser.id);
        if (!needsPasswordChange) {
          toast.success('Welcome back!');
        }
      }
      setIsLoading(false);
    }
  };

  const handleEmployeeLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateEmployeeForm()) return;
    
    setIsLoading(true);
    setLockoutMessage(null);
    
    try {
      let companyId: string;
      
      // If we're on a domain-based login, use the company ID we already have
      if (isDomainBased && domainCompany) {
        companyId = domainCompany.id;
      } else {
        // Otherwise, look up company by slug using RPC (bypasses RLS)
        const { data: foundCompanyId, error: companyError } = await supabase
          .rpc('get_company_id_by_slug', { company_slug: companySlug.toLowerCase().trim() });
        
        if (companyError || !foundCompanyId) {
          toast.error('Company not found. Please check the company code.');
          setIsLoading(false);
          return;
        }
        companyId = foundCompanyId;
      }
      
      // Find employee using RPC (bypasses RLS)
      const { data: employeeData, error: empError } = await supabase
        .rpc('get_employee_login_info', { 
          p_company_id: companyId, 
          p_employee_number: employeeId.trim().toUpperCase() 
        });
      
      if (empError || !employeeData || employeeData.length === 0) {
        toast.error('Employee not found. Please check your Employee ID.');
        setIsLoading(false);
        return;
      }
      
      const employee = employeeData[0];
      
      if (!employee.user_id) {
        toast.error('No user account linked to this employee. Please contact your administrator.');
        setIsLoading(false);
        return;
      }

      // Check if account is locked before attempting login
      const lockoutStatus = await checkAccountLockout(employee.user_id);
      if (lockoutStatus.locked) {
        setLockoutMessage(
          lockoutStatus.minutesRemaining 
            ? `Account temporarily locked. Try again in ${lockoutStatus.minutesRemaining} minute(s).`
            : 'Account temporarily locked due to too many failed attempts.'
        );
        setIsLoading(false);
        return;
      }
      
      // Sign in with the employee's email
      const { error: signInError } = await signIn(employee.email, employeePassword);
      
      if (signInError) {
        // Record failed login attempt
        await recordFailedLogin(employee.user_id);
        const newFailedAttempts = failedAttempts + 1;
        setFailedAttempts(newFailedAttempts);
        
        if (signInError.message.includes('Invalid login credentials')) {
          if (newFailedAttempts >= 3) {
            toast.error(`Invalid password. ${5 - newFailedAttempts} attempts remaining before lockout.`);
          } else {
            toast.error('Invalid password');
          }
        } else {
          toast.error(signInError.message);
        }
        setIsLoading(false);
        return;
      }
      
      // Record successful login and reset counter
      await recordSuccessfulLogin(employee.user_id);
      setFailedAttempts(0);
      
      // Check if password change is required
      const needsPasswordChange = await checkForcePasswordChange(employee.user_id);
      if (!needsPasswordChange) {
        toast.success('Welcome back!');
      }
    } catch (err: any) {
      toast.error(err.message || 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateAdminForm()) return;
    
    setIsLoading(true);
    const { error } = await signUp(email, password, firstName, lastName);
    setIsLoading(false);
    
    if (error) {
      if (error.message.includes('already registered')) {
        toast.error('This email is already registered. Please sign in instead.');
        setActiveTab('admin');
      } else {
        toast.error(error.message);
      }
    } else {
      toast.success('Account created! Check your email to confirm your account.');
    }
  };

  const handlePasswordChangeSuccess = async () => {
    setShowForcePasswordChange(false);
    await refreshUserContext();
    toast.success('Password changed! Redirecting...');
  };

  // Show loading while auth is loading OR when authenticated but user context is still loading
  if (authLoading || domainLoading || settingsLoading || (isAuthenticated && user === null && !showForcePasswordChange)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          {isAuthenticated && user === null && (
            <p className="text-sm text-muted-foreground">Loading your account...</p>
          )}
        </div>
      </div>
    );
  }

  // Domain-based login - simplified UI for company subdomain/custom domain
  if (isDomainBased && domainCompany) {
    return (
      <>
        <ForcePasswordChange 
          open={showForcePasswordChange} 
          onSuccess={handlePasswordChangeSuccess} 
        />
        
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/20 p-4">
          <div className="w-full max-w-md">
            <div className="flex flex-col items-center justify-center mb-8">
              {domainCompany.logo_url ? (
                <img 
                  src={domainCompany.logo_url} 
                  alt={domainCompany.name} 
                  className="h-16 w-auto mb-4"
                />
              ) : (
                <div className="p-3 rounded-xl bg-primary mb-4">
                  <Building2 className="h-8 w-8 text-primary-foreground" />
                </div>
              )}
              <h1 className="text-2xl font-bold">{domainCompany.name}</h1>
              <p className="text-muted-foreground">Employee Portal</p>
            </div>

            <Card className="border-border/50 shadow-xl">
              <Tabs value={domainAuthTab} onValueChange={(v) => setDomainAuthTab(v as 'employee' | 'admin')}>
                <CardHeader className="pb-4">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="employee">
                      <IdCard className="h-4 w-4 mr-2" />
                      Employee
                    </TabsTrigger>
                    <TabsTrigger value="admin">
                      <Mail className="h-4 w-4 mr-2" />
                      Admin
                    </TabsTrigger>
                  </TabsList>
                </CardHeader>

                {/* Employee Login Tab */}
                <TabsContent value="employee">
                  <form onSubmit={handleEmployeeLogin}>
                    <CardContent className="space-y-4">
                      <CardDescription className="text-center">
                        Sign in with your Employee ID
                      </CardDescription>
                      
                      <div className="space-y-2">
                        <Label htmlFor="domain-employee-id">Employee ID</Label>
                        <div className="relative">
                          <Hash className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                          <Input
                            id="domain-employee-id"
                            placeholder="e.g., EMP-001"
                            value={employeeId}
                            onChange={(e) => setEmployeeId(e.target.value)}
                            className="pl-10"
                            disabled={isLoading}
                            autoFocus
                          />
                        </div>
                        {errors.employeeId && <p className="text-sm text-destructive">{errors.employeeId}</p>}
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="domain-employee-password">Password</Label>
                        <div className="relative">
                          <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                          <Input
                            id="domain-employee-password"
                            type="password"
                            placeholder="••••••••"
                            value={employeePassword}
                            onChange={(e) => setEmployeePassword(e.target.value)}
                            className="pl-10"
                            disabled={isLoading}
                          />
                        </div>
                        {errors.employeePassword && <p className="text-sm text-destructive">{errors.employeePassword}</p>}
                      </div>
                    </CardContent>
                    
                    <CardFooter>
                      <Button type="submit" className="w-full" disabled={isLoading}>
                        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Sign In
                      </Button>
                    </CardFooter>
                  </form>
                </TabsContent>

                {/* Admin Login Tab */}
                <TabsContent value="admin">
                  <form onSubmit={handleAdminLogin}>
                    <CardContent className="space-y-4">
                      <CardDescription className="text-center">
                        Sign in with your admin email
                      </CardDescription>
                      
                      <div className="space-y-2">
                        <Label htmlFor="domain-admin-email">Email</Label>
                        <div className="relative">
                          <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                          <Input
                            id="domain-admin-email"
                            type="email"
                            placeholder="admin@company.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="pl-10"
                            disabled={isLoading}
                          />
                        </div>
                        {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="domain-admin-password">Password</Label>
                        <div className="relative">
                          <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                          <Input
                            id="domain-admin-password"
                            type="password"
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="pl-10"
                            disabled={isLoading}
                          />
                        </div>
                        {errors.password && <p className="text-sm text-destructive">{errors.password}</p>}
                      </div>
                    </CardContent>
                    
                    <CardFooter>
                      <Button type="submit" className="w-full" disabled={isLoading}>
                        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Sign In
                      </Button>
                    </CardFooter>
                  </form>
                </TabsContent>
              </Tabs>
            </Card>
            
            <p className="text-center text-sm text-muted-foreground mt-4">
              Need help? Contact your HR administrator.
            </p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <ForcePasswordChange 
        open={showForcePasswordChange} 
        onSuccess={handlePasswordChangeSuccess} 
      />
      
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/20 p-4">
        <div className="w-full max-w-md">
          <div className="flex items-center justify-center mb-8">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-primary">
                <Building2 className="h-6 w-6 text-primary-foreground" />
              </div>
              <span className="text-2xl font-bold">HR Platform</span>
            </div>
          </div>

          <Card className="border-border/50 shadow-xl">
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'employee' | 'admin' | 'signup')}>
              <CardHeader className="pb-4">
                <TabsList className={`grid w-full ${isSignupEnabled ? 'grid-cols-3' : 'grid-cols-2'}`}>
                  <TabsTrigger value="employee" className="text-xs sm:text-sm">
                    <IdCard className="h-4 w-4 mr-1 hidden sm:inline" />
                    Employee
                  </TabsTrigger>
                  <TabsTrigger value="admin" className="text-xs sm:text-sm">
                    <Mail className="h-4 w-4 mr-1 hidden sm:inline" />
                    Admin
                  </TabsTrigger>
                  {isSignupEnabled && (
                    <TabsTrigger value="signup" className="text-xs sm:text-sm">
                      <User className="h-4 w-4 mr-1 hidden sm:inline" />
                      Sign Up
                    </TabsTrigger>
                  )}
                </TabsList>
              </CardHeader>

              {/* Employee Login Tab */}
              <TabsContent value="employee">
                <form onSubmit={handleEmployeeLogin}>
                  <CardContent className="space-y-4">
                    <CardDescription className="text-center">
                      Sign in with your Employee ID
                    </CardDescription>
                    
                    <div className="space-y-2">
                      <Label htmlFor="company-slug">Company Code</Label>
                      <div className="relative">
                        <Building2 className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="company-slug"
                          placeholder="e.g., acme-corp"
                          value={companySlug}
                          onChange={(e) => setCompanySlug(e.target.value)}
                          className="pl-10"
                          disabled={isLoading}
                        />
                      </div>
                      {errors.companySlug && <p className="text-sm text-destructive">{errors.companySlug}</p>}
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="employee-id">Employee ID</Label>
                      <div className="relative">
                        <Hash className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="employee-id"
                          placeholder="e.g., EMP-001"
                          value={employeeId}
                          onChange={(e) => setEmployeeId(e.target.value)}
                          className="pl-10"
                          disabled={isLoading}
                        />
                      </div>
                      {errors.employeeId && <p className="text-sm text-destructive">{errors.employeeId}</p>}
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="employee-password">Password</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="employee-password"
                          type="password"
                          placeholder="••••••••"
                          value={employeePassword}
                          onChange={(e) => setEmployeePassword(e.target.value)}
                          className="pl-10"
                          disabled={isLoading}
                        />
                      </div>
                      {errors.employeePassword && <p className="text-sm text-destructive">{errors.employeePassword}</p>}
                    </div>
                  </CardContent>
                  
                  <CardFooter>
                    <Button type="submit" className="w-full" disabled={isLoading}>
                      {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Sign In as Employee
                    </Button>
                  </CardFooter>
                </form>
              </TabsContent>

              {/* Admin Login Tab */}
              <TabsContent value="admin">
                <form onSubmit={handleAdminLogin}>
                  <CardContent className="space-y-4">
                    <CardDescription className="text-center">
                      Admin sign in with email
                    </CardDescription>
                    
                    <div className="space-y-2">
                      <Label htmlFor="login-email">Email</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="login-email"
                          type="email"
                          placeholder="you@company.com"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="pl-10"
                          disabled={isLoading}
                        />
                      </div>
                      {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="login-password">Password</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="login-password"
                          type="password"
                          placeholder="••••••••"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="pl-10"
                          disabled={isLoading}
                        />
                      </div>
                      {errors.password && <p className="text-sm text-destructive">{errors.password}</p>}
                    </div>
                  </CardContent>
                  
                  <CardFooter>
                    <Button type="submit" className="w-full" disabled={isLoading}>
                      {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Sign In
                    </Button>
                  </CardFooter>
                </form>
              </TabsContent>

              {/* Sign Up Tab - Only shown if signup is enabled */}
              {isSignupEnabled ? (
                <TabsContent value="signup">
                  <form onSubmit={handleSignup}>
                    <CardContent className="space-y-4">
                      <CardDescription className="text-center">
                        Create your account to get started.
                      </CardDescription>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="first-name">First Name</Label>
                          <div className="relative">
                            <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                            <Input
                              id="first-name"
                              placeholder="John"
                              value={firstName}
                              onChange={(e) => setFirstName(e.target.value)}
                              className="pl-10"
                              disabled={isLoading}
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="last-name">Last Name</Label>
                          <Input
                            id="last-name"
                            placeholder="Doe"
                            value={lastName}
                            onChange={(e) => setLastName(e.target.value)}
                            disabled={isLoading}
                          />
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="signup-email">Email</Label>
                        <div className="relative">
                          <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                          <Input
                            id="signup-email"
                            type="email"
                            placeholder="you@company.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="pl-10"
                            disabled={isLoading}
                          />
                        </div>
                        {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="signup-password">Password</Label>
                        <div className="relative">
                          <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                          <Input
                            id="signup-password"
                            type="password"
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="pl-10"
                            disabled={isLoading}
                          />
                        </div>
                        {errors.password && <p className="text-sm text-destructive">{errors.password}</p>}
                      </div>
                    </CardContent>
                    
                    <CardFooter>
                      <Button type="submit" className="w-full" disabled={isLoading}>
                        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Create Account
                      </Button>
                    </CardFooter>
                  </form>
                </TabsContent>
              ) : (
                <TabsContent value="signup">
                  <CardContent className="space-y-4 text-center py-8">
                    <div className="p-4 rounded-full bg-muted w-fit mx-auto">
                      <Building2 className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">Contact Sales</h3>
                      <p className="text-muted-foreground text-sm mt-2">
                        Public signup is currently disabled. Please contact our sales team to get started with your company account.
                      </p>
                    </div>
                    <Button variant="outline" asChild className="mt-4">
                      <a href="mailto:sales@example.com">Contact Sales</a>
                    </Button>
                  </CardContent>
                </TabsContent>
              )}
            </Tabs>
          </Card>
          
          <p className="text-center text-sm text-muted-foreground mt-4">
            By continuing, you agree to our Terms of Service and Privacy Policy.
          </p>
        </div>
      </div>
    </>
  );
}
