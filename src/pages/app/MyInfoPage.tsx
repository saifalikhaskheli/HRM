import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { 
  User, 
  Mail, 
  Phone, 
  MapPin, 
  Building2, 
  Calendar, 
  Users, 
  AlertTriangle,
  CreditCard,
  Contact,
  Pencil
} from 'lucide-react';
import { format } from 'date-fns';
import { WriteGate } from '@/components/PermissionGate';

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
      queryClient.invalidateQueries({ queryKey: ['my-employee-record'] });
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

interface EditEmergencyContactDialogProps {
  employee: EmployeeRecord;
  onSuccess: () => void;
}

function EditEmergencyContactDialog({ employee, onSuccess }: EditEmergencyContactDialogProps) {
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
      queryClient.invalidateQueries({ queryKey: ['my-employee-record'] });
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

export default function MyInfoPage() {
  const { companyId } = useTenant();
  const { user } = useAuth();
  const userId = user?.user_id;

  const { data: employee, isLoading, refetch } = useQuery({
    queryKey: ['my-employee-record', companyId, userId],
    queryFn: async () => {
      if (!companyId || !userId) return null;

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
          address,
          emergency_contact,
          bank_details,
          department:departments(name),
          manager:employees!employees_manager_id_fkey(first_name, last_name)
        `)
        .eq('user_id', userId)
        .eq('company_id', companyId)
        .maybeSingle();

      if (error) throw error;
      
      // Handle the manager being an array from the join
      if (data) {
        const managerData = data.manager as unknown;
        return {
          ...data,
          manager: Array.isArray(managerData) ? managerData[0] || null : managerData,
        } as EmployeeRecord;
      }
      return null;
    },
    enabled: !!companyId && !!userId,
  });

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="p-4 md:p-6">
        <div className="text-center py-12 text-muted-foreground">
          <User className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No employee record found.</p>
          <p className="text-sm">Please contact HR if you believe this is an error.</p>
        </div>
      </div>
    );
  }

  const address = employee.address as Record<string, string> | null;
  const emergency = employee.emergency_contact as Record<string, string> | null;
  const bank = employee.bank_details as Record<string, string> | null;

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">My Information</h1>
          <p className="text-muted-foreground">View and update your employee record</p>
        </div>
      </div>

      {/* Header Card */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">{employee.first_name} {employee.last_name}</h2>
              <p className="text-muted-foreground">{employee.job_title || 'Employee'}</p>
              <div className="flex gap-2 mt-1">
                <Badge variant="outline">{employee.employee_number}</Badge>
                <Badge variant={employee.employment_status === 'active' ? 'default' : 'secondary'}>
                  {employee.employment_status}
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Contact Information */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Contact Information
              </CardTitle>
              <WriteGate>
                <EditContactDialog employee={employee} onSuccess={() => refetch()} />
              </WriteGate>
            </div>
          </CardHeader>
          <CardContent className="space-y-1">
            <InfoRow icon={Mail} label="Work Email" value={employee.email} />
            <InfoRow icon={Mail} label="Personal Email" value={employee.personal_email} />
            <InfoRow icon={Phone} label="Phone" value={employee.phone} />
            {address && (
              <InfoRow 
                icon={MapPin} 
                label="Address" 
                value={
                  [address.line1, address.line2, address.city, address.state, address.postal_code, address.country]
                    .filter(Boolean)
                    .join(', ') || null
                } 
              />
            )}
          </CardContent>
        </Card>

        {/* Employment Details */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Employment Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <InfoRow icon={Building2} label="Department" value={employee.department?.name} />
            <InfoRow 
              icon={Users} 
              label="Manager" 
              value={employee.manager ? `${employee.manager.first_name} ${employee.manager.last_name}` : null} 
            />
            <InfoRow icon={Calendar} label="Hire Date" value={employee.hire_date ? format(new Date(employee.hire_date), 'MMM d, yyyy') : null} />
            <InfoRow icon={User} label="Employment Type" value={employee.employment_type?.replace('_', ' ')} />
          </CardContent>
        </Card>

        {/* Emergency Contact */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Emergency Contact
                </CardTitle>
                <CardDescription>Contact in case of emergency</CardDescription>
              </div>
              <WriteGate>
                <EditEmergencyContactDialog employee={employee} onSuccess={() => refetch()} />
              </WriteGate>
            </div>
          </CardHeader>
          <CardContent>
            {emergency && (emergency.name || emergency.phone) ? (
              <div className="space-y-1">
                <InfoRow icon={Contact} label="Name" value={emergency.name} />
                <InfoRow icon={User} label="Relationship" value={emergency.relationship} />
                <InfoRow icon={Phone} label="Phone" value={emergency.phone} />
                {emergency.email && <InfoRow icon={Mail} label="Email" value={emergency.email} />}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No emergency contact on file. Click Edit to add one.</p>
            )}
          </CardContent>
        </Card>

        {/* Bank Details (Masked) */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              Bank Details
            </CardTitle>
            <CardDescription>Your payment information (masked for security)</CardDescription>
          </CardHeader>
          <CardContent>
            {bank && (bank.bank_name || bank.account_number) ? (
              <div className="space-y-1">
                <InfoRow icon={Building2} label="Bank Name" value={bank.bank_name} />
                <InfoRow icon={CreditCard} label="Account Number" value={maskAccountNumber(bank.account_number)} />
                <InfoRow icon={CreditCard} label="Account Holder" value={bank.account_holder} />
                {bank.ifsc_code && <InfoRow icon={CreditCard} label="IFSC / Branch" value={bank.ifsc_code} />}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No bank details on file. Please contact HR.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
