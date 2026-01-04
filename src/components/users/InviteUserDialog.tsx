import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Loader2, UserPlus, User, Mail, Briefcase, Building2 } from 'lucide-react';
import { useUserManagement } from '@/hooks/useUserManagement';
import { useEmployeesWithoutUser } from '@/hooks/useEmployeesWithoutUser';
import type { AppRole } from '@/types/auth';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';

interface InviteUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const AVAILABLE_ROLES: { value: AppRole; label: string; description: string }[] = [
  { value: 'company_admin', label: 'Company Admin', description: 'Full access to all features' },
  { value: 'hr_manager', label: 'HR Manager', description: 'Manage employees, leave, payroll' },
  { value: 'manager', label: 'Manager', description: 'Manage team members' },
  { value: 'employee', label: 'Employee', description: 'Basic access to self-service features' },
];

export function InviteUserDialog({ open, onOpenChange }: InviteUserDialogProps) {
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [role, setRole] = useState<AppRole>('employee');

  const { createEmployeeUser, isCreatingUser } = useUserManagement();
  const {
    data: employees,
    isLoading: isLoadingEmployees,
    refetch: refetchEmployees,
  } = useEmployeesWithoutUser();

  useEffect(() => {
    if (open) void refetchEmployees();
  }, [open, refetchEmployees]);

  const filteredEmployees = useMemo(() => {
    const list = employees ?? [];
    const q = employeeSearch.trim().toLowerCase();
    if (!q) return list;

    return list.filter((emp) => {
      const hay = `${emp.first_name} ${emp.last_name} ${emp.employee_number} ${emp.email}`.toLowerCase();
      return hay.includes(q);
    });
  }, [employees, employeeSearch]);

  const selectedEmployee = employees?.find(e => e.id === selectedEmployeeId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedEmployeeId) return;
    
    try {
      await createEmployeeUser.mutateAsync({
        employeeId: selectedEmployeeId,
        role,
      });
      
      // Reset form and close
      setSelectedEmployeeId('');
      setRole('employee');
      onOpenChange(false);
    } catch {
      // Error handled by mutation
    }
  };

  const handleClose = () => {
    setSelectedEmployeeId('');
    setRole('employee');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Create User Account
          </DialogTitle>
          <DialogDescription>
            Select an employee to create a user account. They will receive their login credentials via email.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="employee">Select Employee *</Label>
            {isLoadingEmployees ? (
              <div className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-4 w-48" />
              </div>
            ) : employees && employees.length > 0 ? (
              <div className="space-y-2">
                <Input
                  value={employeeSearch}
                  onChange={(e) => setEmployeeSearch(e.target.value)}
                  placeholder="Search by name, employee ID, or email…"
                  aria-label="Search employees"
                />

                {filteredEmployees.length > 0 ? (
                  <Select value={selectedEmployeeId} onValueChange={setSelectedEmployeeId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose an employee..." />
                    </SelectTrigger>
                    <SelectContent>
                      <ScrollArea className="h-60">
                        {filteredEmployees.map((emp) => (
                          <SelectItem key={emp.id} value={emp.id}>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{emp.first_name} {emp.last_name}</span>
                              <span className="text-muted-foreground">({emp.employee_number})</span>
                            </div>
                          </SelectItem>
                        ))}
                      </ScrollArea>
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="p-4 border rounded-md bg-muted/50 text-center text-sm text-muted-foreground">
                    No employees match “{employeeSearch.trim()}”.
                  </div>
                )}
              </div>
            ) : (
              <div className="p-4 border rounded-md bg-muted/50 text-center text-sm text-muted-foreground">
                No employees without user accounts found.
                <br />
                Add employees first in the Employees section.
              </div>
            )}
          </div>

          {/* Selected Employee Details */}
          {selectedEmployee && (
            <div className="p-4 border rounded-lg bg-muted/30 space-y-2">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{selectedEmployee.first_name} {selectedEmployee.last_name}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Mail className="h-4 w-4" />
                <span>{selectedEmployee.email}</span>
              </div>
              {selectedEmployee.job_title && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Briefcase className="h-4 w-4" />
                  <span>{selectedEmployee.job_title}</span>
                </div>
              )}
              {selectedEmployee.department?.name && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Building2 className="h-4 w-4" />
                  <span>{selectedEmployee.department.name}</span>
                </div>
              )}
            </div>
          )}
          
          <div className="space-y-2">
            <Label htmlFor="role">Role *</Label>
            <Select value={role} onValueChange={(v) => setRole(v as AppRole)}>
              <SelectTrigger>
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                {AVAILABLE_ROLES.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    <div>
                      <span className="font-medium">{r.label}</span>
                      <span className="ml-2 text-xs text-muted-foreground">{r.description}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {role === 'company_admin' || role === 'hr_manager' 
                ? 'Admin roles login with email + password'
                : 'Employee roles login with Employee ID + password'
              }
            </p>
          </div>

          <div className="p-3 border rounded-md bg-primary/5 text-sm">
            <p className="font-medium text-primary mb-1">What happens next?</p>
            <ul className="list-disc list-inside text-muted-foreground space-y-1">
              <li>A user account will be created for this employee</li>
              <li>They will receive an email with their login credentials</li>
              <li>They must change their password on first login</li>
            </ul>
          </div>
          
          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={isCreatingUser || !selectedEmployeeId || !employees?.length}
            >
              {isCreatingUser ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating Account...
                </>
              ) : (
                'Create User Account'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
