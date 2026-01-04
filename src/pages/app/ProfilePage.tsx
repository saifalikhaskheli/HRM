import { useState, Suspense, lazy } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/contexts/TenantContext';
import { PageContainer, PageHeader } from '@/components/layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { 
  User, Mail, Phone, MapPin, Building2, Calendar, Users, 
  AlertTriangle, CreditCard, Contact, Pencil, Shield, UserCircle
} from 'lucide-react';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import { SalarySection } from '@/components/employees/SalarySection';
import { ProfilePhotoUpload } from '@/components/profile/ProfilePhotoUpload';
import { 
  ProfileDocumentsSkeleton, 
  ProfilePayslipsSkeleton, 
  ProfileShiftSkeleton 
} from '@/components/profile/ProfileCardSkeleton';

// Lazy load heavy tab components
const ProfilePayslips = lazy(() => import('@/components/profile/ProfilePayslips').then(m => ({ default: m.ProfilePayslips })));
const ProfileShiftAttendance = lazy(() => import('@/components/profile/ProfileShiftAttendance').then(m => ({ default: m.ProfileShiftAttendance })));
const ProfileDocuments = lazy(() => import('@/components/profile/ProfileDocuments').then(m => ({ default: m.ProfileDocuments })));

interface EmployeeRecord {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  personal_email: string | null;
  hire_date: string;
  job_title: string | null;
  employee_number: string;
  employment_type: string;
  employment_status: string;
  date_of_birth: string | null;
  gender: string | null;
  national_id: string | null;
  work_location: string | null;
  address: Record<string, string> | null;
  emergency_contact: Record<string, string> | null;
  bank_details: Record<string, string> | null;
  department: { name: string } | null;
  manager: { first_name: string; last_name: string } | null;
}

function maskAccountNumber(value: string | undefined): string {
  if (!value || value.length < 4) return '****';
  return '****' + value.slice(-4);
}

function InfoRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-2">
      <Icon className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium">{value || '-'}</p>
      </div>
    </div>
  );
}

interface EditContactDialogProps {
  employee: EmployeeRecord;
  onSuccess: () => void;
}

function EditContactDialog({ employee, onSuccess }: EditContactDialogProps) {
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState(employee.phone || '');
  const [personalEmail, setPersonalEmail] = useState(employee.personal_email || '');
  const queryClient = useQueryClient();

  const updateMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('employees')
        .update({
          phone: phone || null,
          personal_email: personalEmail || null,
        })
        .eq('id', employee.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-employee'] });
      toast.success('Contact information updated');
      setOpen(false);
      onSuccess();
    },
    onError: () => {
      toast.error('Failed to update contact information');
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1">
          <Pencil className="h-3 w-3" />
          Edit
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Contact Information</DialogTitle>
          <DialogDescription>Update your phone number and personal email.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="phone">Phone Number</Label>
            <Input
              id="phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+1 (555) 123-4567"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="personal-email">Personal Email</Label>
            <Input
              id="personal-email"
              type="email"
              value={personalEmail}
              onChange={(e) => setPersonalEmail(e.target.value)}
              placeholder="your.personal@email.com"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending}>
            {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditEmergencyContactDialog({ employee, onSuccess }: EditContactDialogProps) {
  const [open, setOpen] = useState(false);
  const existing = (employee.emergency_contact as Record<string, string>) || {};
  const [name, setName] = useState(existing.name || '');
  const [relationship, setRelationship] = useState(existing.relationship || '');
  const [phone, setPhone] = useState(existing.phone || '');
  const [email, setEmail] = useState(existing.email || '');
  const queryClient = useQueryClient();

  const updateMutation = useMutation({
    mutationFn: async () => {
      const emergencyContact = {
        name: name || null,
        relationship: relationship || null,
        phone: phone || null,
        email: email || null,
      };
      const { error } = await supabase
        .from('employees')
        .update({ emergency_contact: emergencyContact })
        .eq('id', employee.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-employee'] });
      toast.success('Emergency contact updated');
      setOpen(false);
      onSuccess();
    },
    onError: () => {
      toast.error('Failed to update emergency contact');
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1">
          <Pencil className="h-3 w-3" />
          Edit
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Emergency Contact</DialogTitle>
          <DialogDescription>Update your emergency contact information.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="ec-name">Name</Label>
            <Input
              id="ec-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Contact name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ec-relationship">Relationship</Label>
            <Input
              id="ec-relationship"
              value={relationship}
              onChange={(e) => setRelationship(e.target.value)}
              placeholder="e.g., Spouse, Parent, Sibling"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ec-phone">Phone Number</Label>
            <Input
              id="ec-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+1 (555) 123-4567"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ec-email">Email (optional)</Label>
            <Input
              id="ec-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="contact@email.com"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending}>
            {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function ProfilePage() {
  const { user } = useAuth();
  const { companyId, role } = useTenant();
  const queryClient = useQueryClient();

  // Get employee ID from context (already available from get_user_context)
  const employeeId = user?.current_employee_id;

  // Fetch full employee details using the employee ID from context
  const { data: employee, isLoading, refetch } = useQuery({
    queryKey: ['my-employee', employeeId, companyId],
    queryFn: async () => {
      if (!employeeId || !companyId) return null;

      const { data, error } = await supabase
        .from('employees')
        .select(`
          id,
          first_name,
          last_name,
          email,
          phone,
          personal_email,
          hire_date,
          job_title,
          employee_number,
          employment_type,
          employment_status,
          date_of_birth,
          gender,
          national_id,
          work_location,
          address,
          emergency_contact,
          bank_details,
          department:departments!employees_department_id_fkey(name),
          manager:employees!employees_manager_id_fkey(first_name, last_name)
        `)
        .eq('id', employeeId)
        .eq('company_id', companyId)
        .maybeSingle();

      if (error) throw error;
      
      if (data) {
        const managerData = data.manager as unknown;
        return {
          ...data,
          manager: Array.isArray(managerData) ? managerData[0] || null : managerData,
        } as EmployeeRecord;
      }
      return null;
    },
    enabled: !!employeeId && !!companyId,
  });

  if (isLoading) {
    return (
      <PageContainer className="max-w-4xl mx-auto">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full mt-4" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </PageContainer>
    );
  }

  const formatRoleName = (r: string | null) => {
    if (!r) return 'Member';
    return r.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  };

  // No employee record found
  if (!employee) {
    return (
      <PageContainer className="max-w-4xl mx-auto">
        <PageHeader title="My Profile" description="Your account information" />

        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <ProfilePhotoUpload
                userId={user?.user_id || ''}
                currentAvatarUrl={user?.avatar_url || null}
                name={user?.first_name ? `${user.first_name} ${user.last_name || ''}` : user?.email || 'User'}
              />
              <div className="flex-1">
                <h2 className="text-xl font-semibold">
                  {user?.first_name ? `${user.first_name} ${user.last_name || ''}` : user?.email}
                </h2>
                <p className="text-muted-foreground">{user?.email}</p>
                <div className="flex flex-wrap gap-2 mt-2">
                  <Badge variant="default">{formatRoleName(role)}</Badge>
                </div>
              </div>
              <Button variant="outline" asChild>
                <Link to="/app/my-security">
                  <Shield className="h-4 w-4 mr-2" />
                  Security Settings
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardContent className="py-12 text-center">
            <UserCircle className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="font-semibold text-lg mb-2">No Employee Record Found</h3>
            <p className="text-muted-foreground text-sm max-w-md mx-auto">
              Your account is not linked to an employee record in this company. 
              Please contact your HR administrator to set up your employee profile.
            </p>
          </CardContent>
        </Card>
      </PageContainer>
    );
  }

  const address = employee.address as Record<string, string> | null;
  const emergency = employee.emergency_contact as Record<string, string> | null;
  const bank = employee.bank_details as Record<string, string> | null;

  return (
    <PageContainer className="max-w-6xl mx-auto">
      <PageHeader title="My Profile" description="View and manage your employee information" />

      {/* Header Card */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <ProfilePhotoUpload
              userId={user?.user_id || ''}
              currentAvatarUrl={user?.avatar_url || null}
              name={`${employee.first_name} ${employee.last_name}`}
            />
            <div className="flex-1">
              <h2 className="text-xl font-semibold">{employee.first_name} {employee.last_name}</h2>
              <p className="text-muted-foreground">{employee.job_title || 'Employee'}</p>
              <div className="flex flex-wrap gap-2 mt-2">
                <Badge variant="outline">{employee.employee_number}</Badge>
                <Badge variant={employee.employment_status === 'active' ? 'default' : 'secondary'}>
                  {employee.employment_status}
                </Badge>
                <Badge variant="secondary">{employee.employment_type?.replace('_', ' ')}</Badge>
              </div>
            </div>
            <Button variant="outline" asChild>
              <Link to="/app/my-security">
                <Shield className="h-4 w-4 mr-2" />
                Security Settings
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tabbed Sections */}
      <Tabs defaultValue="personal" className="space-y-4 mt-6">
        <TabsList className="flex flex-wrap">
          <TabsTrigger value="personal">Personal</TabsTrigger>
          <TabsTrigger value="employment">Employment</TabsTrigger>
          <TabsTrigger value="salary">Salary</TabsTrigger>
          <TabsTrigger value="shift">Shift & Attendance</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="payslips">Payslips</TabsTrigger>
        </TabsList>

        {/* Personal Information Tab */}
        <TabsContent value="personal" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Contact Information */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    Contact Information
                  </CardTitle>
                  <EditContactDialog employee={employee} onSuccess={() => refetch()} />
                </div>
              </CardHeader>
              <CardContent className="space-y-1">
                <InfoRow icon={Mail} label="Work Email" value={employee.email} />
                <InfoRow icon={Mail} label="Personal Email" value={employee.personal_email} />
                <InfoRow icon={Phone} label="Phone" value={employee.phone} />
              </CardContent>
            </Card>

            {/* Personal Details */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Personal Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                <InfoRow 
                  icon={Calendar} 
                  label="Date of Birth" 
                  value={employee.date_of_birth ? format(new Date(employee.date_of_birth), 'MMMM d, yyyy') : null} 
                />
                <InfoRow icon={User} label="Gender" value={employee.gender} />
                <InfoRow icon={CreditCard} label="National ID" value={employee.national_id} />
              </CardContent>
            </Card>

            {/* Address */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Address
                </CardTitle>
              </CardHeader>
              <CardContent>
                {address && (address.street || address.city) ? (
                  <div className="text-sm">
                    {address.street && <p>{address.street}</p>}
                    {(address.city || address.state || address.zip) && (
                      <p>{[address.city, address.state, address.zip].filter(Boolean).join(', ')}</p>
                    )}
                    {address.country && <p>{address.country}</p>}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No address on file</p>
                )}
              </CardContent>
            </Card>

            {/* Emergency Contact */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Contact className="h-4 w-4" />
                    Emergency Contact
                  </CardTitle>
                  <EditEmergencyContactDialog employee={employee} onSuccess={() => refetch()} />
                </div>
              </CardHeader>
              <CardContent>
                {emergency && emergency.name ? (
                  <div className="space-y-1">
                    <InfoRow icon={User} label="Name" value={emergency.name} />
                    <InfoRow icon={Users} label="Relationship" value={emergency.relationship} />
                    <InfoRow icon={Phone} label="Phone" value={emergency.phone} />
                    {emergency.email && <InfoRow icon={Mail} label="Email" value={emergency.email} />}
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <AlertTriangle className="h-8 w-8 mx-auto text-amber-500 mb-2" />
                    <p className="text-sm text-muted-foreground">No emergency contact on file</p>
                    <p className="text-xs text-muted-foreground mt-1">Please add an emergency contact</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Employment Tab */}
        <TabsContent value="employment" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  Employment Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                <InfoRow icon={CreditCard} label="Employee ID" value={employee.employee_number} />
                <InfoRow icon={Building2} label="Department" value={employee.department?.name} />
                <InfoRow icon={User} label="Job Title" value={employee.job_title} />
                <InfoRow 
                  icon={Users} 
                  label="Manager" 
                  value={employee.manager ? `${employee.manager.first_name} ${employee.manager.last_name}` : null} 
                />
                <InfoRow icon={MapPin} label="Work Location" value={employee.work_location} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Employment Status
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                <InfoRow 
                  icon={Calendar} 
                  label="Hire Date" 
                  value={format(new Date(employee.hire_date), 'MMMM d, yyyy')} 
                />
                <InfoRow 
                  icon={User} 
                  label="Employment Type" 
                  value={employee.employment_type?.replace('_', ' ')} 
                />
                <InfoRow icon={User} label="Status" value={employee.employment_status} />
              </CardContent>
            </Card>

            {/* Bank Details */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <CreditCard className="h-4 w-4" />
                  Bank Details
                </CardTitle>
                <CardDescription>Your bank account information (masked for security)</CardDescription>
              </CardHeader>
              <CardContent>
                {bank && (bank.bank_name || bank.account_number) ? (
                  <div className="space-y-1">
                    <InfoRow icon={Building2} label="Bank Name" value={bank.bank_name} />
                    <InfoRow icon={CreditCard} label="Account Number" value={maskAccountNumber(bank.account_number)} />
                    {bank.routing_number && (
                      <InfoRow icon={CreditCard} label="Routing Number" value={maskAccountNumber(bank.routing_number)} />
                    )}
                    {bank.account_type && (
                      <InfoRow icon={CreditCard} label="Account Type" value={bank.account_type} />
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No bank details on file</p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Salary Tab - Read only for employees */}
        <TabsContent value="salary">
          <SalarySection employeeId={employee.id} readOnly={true} />
        </TabsContent>

        {/* Shift & Attendance Tab */}
        <TabsContent value="shift">
          <Suspense fallback={<ProfileShiftSkeleton />}>
            <ProfileShiftAttendance employeeId={employee.id} />
          </Suspense>
        </TabsContent>

        {/* Documents Tab */}
        <TabsContent value="documents">
          <Suspense fallback={<ProfileDocumentsSkeleton />}>
            <ProfileDocuments employeeId={employee.id} />
          </Suspense>
        </TabsContent>

        {/* Payslips Tab */}
        <TabsContent value="payslips">
          <Suspense fallback={<ProfilePayslipsSkeleton />}>
            <ProfilePayslips employeeId={employee.id} />
          </Suspense>
        </TabsContent>
      </Tabs>
    </PageContainer>
  );
}
