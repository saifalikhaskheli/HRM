import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Shield } from 'lucide-react';
import { useUserManagement } from '@/hooks/useUserManagement';
import type { AppRole } from '@/types/auth';
import type { CompanyUser } from '@/hooks/useCompanyUsers';

interface ChangeRoleDialogProps {
  user: CompanyUser | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const AVAILABLE_ROLES: { value: AppRole; label: string }[] = [
  { value: 'company_admin', label: 'Company Admin' },
  { value: 'hr_manager', label: 'HR Manager' },
  { value: 'manager', label: 'Manager' },
  { value: 'employee', label: 'Employee' },
];

export function ChangeRoleDialog({ user, open, onOpenChange }: ChangeRoleDialogProps) {
  const [newRole, setNewRole] = useState<AppRole>(user?.role || 'employee');
  const { updateUserRole } = useUserManagement();

  // Update role state when user changes
  if (user && newRole !== user.role && !open) {
    setNewRole(user.role);
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      await updateUserRole.mutateAsync({
        userId: user.user_id,
        companyUserId: user.id,
        newRole,
        currentRole: user.role,
      });
      onOpenChange(false);
    } catch {
      // Error handled by mutation
    }
  };

  const userName = user?.profile?.first_name || user?.profile?.email || 'User';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Change User Role
          </DialogTitle>
          <DialogDescription>
            Update the role for {userName}
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Current Role</Label>
            <p className="text-sm text-muted-foreground capitalize">
              {user?.role.replace('_', ' ')}
            </p>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="newRole">New Role</Label>
            <Select value={newRole} onValueChange={(v) => setNewRole(v as AppRole)}>
              <SelectTrigger>
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                {AVAILABLE_ROLES.map((r) => (
                  <SelectItem key={r.value} value={r.value} disabled={r.value === user?.role}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          {user?.role === 'super_admin' && (
            <p className="text-sm text-amber-600 bg-amber-500/10 p-2 rounded">
              Super Admin role cannot be changed. This user is the company owner.
            </p>
          )}
          
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={updateUserRole.isPending || newRole === user?.role || user?.role === 'super_admin'}
            >
              {updateUserRole.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating...
                </>
              ) : (
                'Update Role'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
