import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  useAllPermissions, 
  useRolePermissions, 
  useSetRolePermission,
  useInitializePermissions 
} from '@/hooks/usePermissions';
import { useTenant } from '@/contexts/TenantContext';
import { AppRole } from '@/types/auth';
import { 
  PermissionModule, 
  PermissionAction, 
  MODULE_LABELS, 
  ACTION_LABELS 
} from '@/types/permissions';
import { 
  Shield, 
  Users, 
  UserCog, 
  Building2, 
  Lock, 
  AlertCircle,
  RefreshCw 
} from 'lucide-react';
import { cn } from '@/lib/utils';

const EDITABLE_ROLES: AppRole[] = ['company_admin', 'hr_manager', 'manager', 'employee'];

const ROLE_LABELS: Record<AppRole, string> = {
  super_admin: 'Super Admin',
  company_admin: 'Company Admin',
  hr_manager: 'HR Manager',
  manager: 'Manager',
  employee: 'Employee',
};

const ROLE_DESCRIPTIONS: Record<AppRole, string> = {
  super_admin: 'Full access to all features (cannot be modified)',
  company_admin: 'Manages company settings and users',
  hr_manager: 'Manages HR operations and employees',
  manager: 'Manages team members and approvals',
  employee: 'Basic access to personal features',
};

export function RolePermissionsEditor() {
  const [selectedRole, setSelectedRole] = useState<AppRole>('company_admin');
  const { isAdmin } = useTenant();
  
  const { data: allPermissions, isLoading: permissionsLoading } = useAllPermissions();
  const { data: rolePermissions, isLoading: rolePermissionsLoading } = useRolePermissions(selectedRole);
  const setPermission = useSetRolePermission();
  const initializePermissions = useInitializePermissions();

  const isLoading = permissionsLoading || rolePermissionsLoading;

  // Group permissions by module
  const permissionsByModule = allPermissions?.reduce((acc, perm) => {
    if (!acc[perm.module]) {
      acc[perm.module] = [];
    }
    acc[perm.module].push(perm);
    return acc;
  }, {} as Record<PermissionModule, typeof allPermissions>);

  // Create a map of granted permissions
  const grantedPermissions = new Set(
    rolePermissions?.filter(p => p.is_granted).map(p => p.permission_id)
  );

  const handleTogglePermission = (
    module: PermissionModule, 
    action: PermissionAction, 
    currentlyGranted: boolean
  ) => {
    setPermission.mutate({
      role: selectedRole,
      module,
      action,
      grant: !currentlyGranted,
    });
  };

  const handleInitializeDefaults = () => {
    initializePermissions.mutate();
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
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Role Permissions
            </CardTitle>
            <CardDescription>
              Configure default permissions for each role. These can be overridden per user.
            </CardDescription>
          </div>
          <Button 
            variant="outline" 
            size="sm"
            onClick={handleInitializeDefaults}
            disabled={initializePermissions.isPending}
          >
            <RefreshCw className={cn("h-4 w-4 mr-2", initializePermissions.isPending && "animate-spin")} />
            Reset to Defaults
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs value={selectedRole} onValueChange={(v) => setSelectedRole(v as AppRole)}>
          <TabsList className="mb-4">
            {EDITABLE_ROLES.map((role) => (
              <TabsTrigger key={role} value={role} className="gap-2">
                <UserCog className="h-4 w-4" />
                {ROLE_LABELS[role]}
              </TabsTrigger>
            ))}
          </TabsList>

          {EDITABLE_ROLES.map((role) => (
            <TabsContent key={role} value={role}>
              <div className="mb-4 p-3 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">
                  {ROLE_DESCRIPTIONS[role]}
                </p>
              </div>

              {isLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-32 w-full" />
                  ))}
                </div>
              ) : (
                <div className="space-y-6">
                  {Object.entries(permissionsByModule || {}).map(([module, permissions]) => (
                    <div key={module} className="border rounded-lg p-4">
                      <h4 className="font-medium mb-3 flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        {MODULE_LABELS[module as PermissionModule]}
                      </h4>
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                        {permissions?.map((perm) => {
                          const isGranted = grantedPermissions.has(perm.id);
                          return (
                            <label
                              key={perm.id}
                              className={cn(
                                "flex items-center gap-2 p-2 rounded border cursor-pointer transition-colors",
                                isGranted 
                                  ? "bg-primary/5 border-primary/20" 
                                  : "bg-muted/50 border-transparent hover:border-muted-foreground/20"
                              )}
                            >
                              <Checkbox
                                checked={isGranted}
                                onCheckedChange={() => handleTogglePermission(
                                  perm.module as PermissionModule,
                                  perm.action as PermissionAction,
                                  isGranted
                                )}
                                disabled={setPermission.isPending}
                              />
                              <span className="text-sm">
                                {ACTION_LABELS[perm.action as PermissionAction]}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
}

export default RolePermissionsEditor;
