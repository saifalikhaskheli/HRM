import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { SubPermissionDropdown } from './SubPermissionDropdown';
import { toast } from 'sonner';
import { 
  useAllPermissions, 
  useRolePermissions, 
  useSetRolePermission,
  useResetRolePermissions 
} from '@/hooks/usePermissions';
import { useTenant } from '@/contexts/TenantContext';
import { AppRole } from '@/types/auth';
import { 
  PermissionModule, 
  PermissionAction, 
  MODULE_LABELS, 
} from '@/types/permissions';
import { 
  Shield, 
  Plus, 
  RefreshCw,
  AlertCircle,
  Users,
  Settings,
  Briefcase,
  UserCog,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const SYSTEM_ROLES: AppRole[] = ['super_admin', 'company_admin', 'hr_manager', 'manager', 'employee'];

const ROLE_LABELS: Record<AppRole, string> = {
  super_admin: 'Super Admin',
  company_admin: 'Company Admin',
  hr_manager: 'HR Manager',
  manager: 'Manager',
  employee: 'Employee',
};

const ROLE_DESCRIPTIONS: Record<AppRole, string> = {
  super_admin: 'Full access to all features',
  company_admin: 'Manages company settings and users',
  hr_manager: 'Manages HR operations and employees',
  manager: 'Manages team members and approvals',
  employee: 'Basic access to personal features',
};

const ROLE_ICONS: Record<AppRole, React.ComponentType<{ className?: string }>> = {
  super_admin: Shield,
  company_admin: Settings,
  hr_manager: Users,
  manager: Briefcase,
  employee: UserCog,
};

// Modules to display
const DISPLAY_MODULES: PermissionModule[] = [
  'dashboard',
  'employees',
  'departments',
  'leave',
  'time_tracking',
  'payroll',
  'performance',
  'recruitment',
  'documents',
  'expenses',
  'my_team',
  'compliance',
  'audit',
  'settings',
  'users',
];

export function RolePermissionsManager() {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const { isAdmin } = useTenant();
  
  const { data: allPermissions, isLoading: permissionsLoading } = useAllPermissions();
  const resetPermissions = useResetRolePermissions();

  const handleResetToDefaults = () => {
    resetPermissions.mutate();
  };

  if (!isAdmin) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Only company admins can manage role permissions.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Role Permissions</h3>
          <p className="text-sm text-muted-foreground">
            Configure default permissions for each role
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={handleResetToDefaults}
            disabled={resetPermissions.isPending}
          >
            <RefreshCw className={cn("h-4 w-4 mr-2", resetPermissions.isPending && "animate-spin")} />
            Reset to Defaults
          </Button>
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Create Role
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Custom Role</DialogTitle>
                <DialogDescription>
                  Create a new custom role with specific permissions.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="role-name">Role Name</Label>
                  <Input id="role-name" placeholder="e.g., Finance Manager" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role-description">Description</Label>
                  <Textarea 
                    id="role-description" 
                    placeholder="Describe the responsibilities and access level..."
                    rows={3}
                  />
                </div>
                <p className="text-sm text-muted-foreground">
                  Custom roles inherit permissions from a base role. You can then customize individual permissions after creation.
                </p>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={() => {
                  toast.success('Custom role creation coming in next update');
                  setCreateDialogOpen(false);
                }}>
                  Create Role
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Roles Table */}
      <div className="border rounded-lg">
        <ScrollArea className="w-full">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="min-w-[200px] sticky left-0 bg-background z-10">Role</TableHead>
                {DISPLAY_MODULES.map(module => (
                  <TableHead key={module} className="min-w-[90px] text-center">
                    <span className="text-xs">{MODULE_LABELS[module]}</span>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {SYSTEM_ROLES.map((role) => (
                <RolePermissionRow
                  key={role}
                  role={role}
                  allPermissions={allPermissions}
                  isLoading={permissionsLoading}
                />
              ))}
            </TableBody>
          </Table>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </div>
    </div>
  );
}

interface RolePermissionRowProps {
  role: AppRole;
  allPermissions: any[] | undefined;
  isLoading: boolean;
}

function RolePermissionRow({ role, allPermissions, isLoading }: RolePermissionRowProps) {
  const { data: rolePermissions, isLoading: rolePermsLoading } = useRolePermissions(role);
  const setPermission = useSetRolePermission();
  
  const isSuperAdmin = role === 'super_admin';
  const Icon = ROLE_ICONS[role];

  // Group permissions by module
  const permissionsByModule = DISPLAY_MODULES.reduce((acc, module) => {
    const modulePerms = allPermissions?.filter(p => p.module === module) || [];
    
    acc[module] = modulePerms.map(perm => {
      const rolePerm = rolePermissions?.find(
        rp => rp.module === module && rp.action === perm.action
      );
      
      return {
        action: perm.action as PermissionAction,
        hasPermission: isSuperAdmin ? true : (rolePerm?.is_granted ?? false),
        isOverride: false,
      };
    });
    
    return acc;
  }, {} as Record<PermissionModule, { action: PermissionAction; hasPermission: boolean; isOverride: boolean }[]>);

  const handleToggle = (module: PermissionModule, action: PermissionAction, value: boolean) => {
    if (isSuperAdmin) return;
    
    setPermission.mutate({
      role,
      module,
      action,
      grant: value,
    });
  };

  const handleToggleAll = (module: PermissionModule, enable: boolean) => {
    if (isSuperAdmin) return;
    
    const modulePerms = allPermissions?.filter(p => p.module === module);
    modulePerms?.forEach(perm => {
      setPermission.mutate({
        role,
        module,
        action: perm.action as PermissionAction,
        grant: enable,
      });
    });
  };

  if (isLoading || rolePermsLoading) {
    return (
      <TableRow>
        <TableCell className="sticky left-0 bg-background">
          <div className="flex items-center gap-3">
            <Skeleton className="h-8 w-8 rounded" />
            <Skeleton className="h-5 w-24" />
          </div>
        </TableCell>
        {DISPLAY_MODULES.map((module) => (
          <TableCell key={module}>
            <Skeleton className="h-5 w-12 mx-auto" />
          </TableCell>
        ))}
      </TableRow>
    );
  }

  return (
    <TableRow>
      <TableCell className="sticky left-0 bg-background z-10">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded bg-muted flex items-center justify-center">
            <Icon className="h-4 w-4 text-muted-foreground" />
          </div>
          <div>
            <div className="font-medium">{ROLE_LABELS[role]}</div>
            <div className="text-xs text-muted-foreground">{ROLE_DESCRIPTIONS[role]}</div>
          </div>
        </div>
      </TableCell>
      {DISPLAY_MODULES.map((module) => {
        const modulePerms = permissionsByModule[module] || [];
        const enabledCount = modulePerms.filter(p => p.hasPermission).length;
        const allEnabled = enabledCount === modulePerms.length;
        const someEnabled = enabledCount > 0 && enabledCount < modulePerms.length;
        
        return (
          <TableCell key={module} className="text-center">
            {isSuperAdmin ? (
              <span className="text-xs text-muted-foreground">All</span>
            ) : (
              <div className="flex items-center justify-center gap-1.5">
                <Checkbox
                  checked={allEnabled}
                  ref={(ref) => {
                    if (ref) {
                      (ref as HTMLButtonElement).dataset.state = someEnabled ? 'indeterminate' : allEnabled ? 'checked' : 'unchecked';
                    }
                  }}
                  onCheckedChange={(checked) => {
                    handleToggleAll(module, checked === true);
                  }}
                  disabled={setPermission.isPending}
                />
                <SubPermissionDropdown
                  moduleLabel={MODULE_LABELS[module]}
                  permissions={modulePerms}
                  onToggle={(action, value) => handleToggle(module, action, value)}
                  disabled={setPermission.isPending}
                />
              </div>
            )}
          </TableCell>
        );
      })}
    </TableRow>
  );
}

export default RolePermissionsManager;
