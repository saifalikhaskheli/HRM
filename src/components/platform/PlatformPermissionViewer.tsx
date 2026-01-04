import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  useAllPermissions, 
  useRolePermissions, 
  useUserPermissions,
  useSetRolePermission,
  useSetUserPermission,
  useInitializePermissions 
} from '@/hooks/usePermissions';
import { useCompanyUsers } from '@/hooks/useCompanyUsers';
import { useImpersonation } from '@/contexts/ImpersonationContext';
import { useAuth } from '@/contexts/AuthContext';
import { AppRole } from '@/types/auth';
import { 
  PermissionModule, 
  PermissionAction, 
  MODULE_LABELS, 
  ACTION_LABELS,
  UserPermission,
} from '@/types/permissions';
import { 
  Shield, 
  Users, 
  UserCog, 
  Building2, 
  Eye,
  AlertCircle,
  RefreshCw,
  Check,
  X,
  Minus,
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

interface PlatformPermissionViewerProps {
  companyId: string;
  companyName: string;
  readOnly?: boolean;
}

export function PlatformPermissionViewer({ 
  companyId, 
  companyName, 
  readOnly = false 
}: PlatformPermissionViewerProps) {
  const [activeTab, setActiveTab] = useState<'roles' | 'users'>('roles');
  const [selectedRole, setSelectedRole] = useState<AppRole>('company_admin');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  
  const { isPlatformAdmin } = useAuth();
  const { isImpersonating } = useImpersonation();
  
  const { data: allPermissions, isLoading: permissionsLoading } = useAllPermissions();
  const { data: rolePermissions, isLoading: rolePermissionsLoading } = useRolePermissions(selectedRole);
  const { data: userPermissions, isLoading: userPermissionsLoading } = useUserPermissions(selectedUserId);
  const { data: companyUsers, isLoading: usersLoading } = useCompanyUsers();
  
  const setRolePermission = useSetRolePermission();
  const setUserPermission = useSetUserPermission();
  const initializePermissions = useInitializePermissions();

  // Check if we're allowed to manage (platform admin viewing during impersonation)
  const canManage = isPlatformAdmin && !readOnly;

  // Group permissions by module
  const permissionsByModule = allPermissions?.reduce((acc, perm) => {
    if (!acc[perm.module]) {
      acc[perm.module] = [];
    }
    acc[perm.module].push(perm);
    return acc;
  }, {} as Record<PermissionModule, typeof allPermissions>);

  // Create a map of granted role permissions
  const grantedRolePermissions = new Set(
    rolePermissions?.filter(p => p.is_granted).map(p => p.permission_id)
  );

  // Group user permissions by module
  const userPermissionsByModule = userPermissions?.reduce((acc, perm) => {
    if (!acc[perm.module]) {
      acc[perm.module] = [];
    }
    acc[perm.module].push(perm);
    return acc;
  }, {} as Record<PermissionModule, UserPermission[]>);

  const handleToggleRolePermission = (
    module: PermissionModule, 
    action: PermissionAction, 
    currentlyGranted: boolean
  ) => {
    if (!canManage) return;
    setRolePermission.mutate({
      role: selectedRole,
      module,
      action,
      grant: !currentlyGranted,
    });
  };

  const handleSetUserPermission = (
    module: PermissionModule,
    action: PermissionAction,
    granted: boolean | null
  ) => {
    if (!canManage || !selectedUserId) return;
    setUserPermission.mutate({
      userId: selectedUserId,
      module,
      action,
      granted,
    });
  };

  const handleInitializeDefaults = () => {
    if (!canManage) return;
    initializePermissions.mutate();
  };

  const getSourceBadge = (source: string) => {
    switch (source) {
      case 'super_admin':
        return <Badge variant="destructive" className="text-xs">Super Admin</Badge>;
      case 'explicit_allow':
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 text-xs">Allowed</Badge>;
      case 'explicit_deny':
        return <Badge variant="destructive" className="text-xs">Denied</Badge>;
      case 'role':
        return <Badge variant="secondary" className="text-xs">From Role</Badge>;
      default:
        return <Badge variant="outline" className="text-xs">No Access</Badge>;
    }
  };

  if (!isPlatformAdmin) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Only platform admins can view company permissions.
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
              <Eye className="h-5 w-5" />
              Permission Viewer
              {isImpersonating && (
                <Badge variant="outline" className="ml-2">
                  Viewing: {companyName}
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              {canManage 
                ? 'View and manage permissions for this company' 
                : 'View permissions for this company (read-only)'}
            </CardDescription>
          </div>
          {canManage && (
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleInitializeDefaults}
              disabled={initializePermissions.isPending}
            >
              <RefreshCw className={cn("h-4 w-4 mr-2", initializePermissions.isPending && "animate-spin")} />
              Reset to Defaults
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'roles' | 'users')}>
          <TabsList className="mb-4">
            <TabsTrigger value="roles" className="gap-2">
              <Shield className="h-4 w-4" />
              Role Permissions
            </TabsTrigger>
            <TabsTrigger value="users" className="gap-2">
              <Users className="h-4 w-4" />
              User Overrides
            </TabsTrigger>
          </TabsList>

          {/* Role Permissions Tab */}
          <TabsContent value="roles">
            <Tabs value={selectedRole} onValueChange={(v) => setSelectedRole(v as AppRole)}>
              <TabsList className="mb-4 flex-wrap h-auto gap-1">
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

                  {permissionsLoading || rolePermissionsLoading ? (
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
                              const isGranted = grantedRolePermissions.has(perm.id);
                              return (
                                <label
                                  key={perm.id}
                                  className={cn(
                                    "flex items-center gap-2 p-2 rounded border transition-colors",
                                    canManage ? "cursor-pointer" : "cursor-default",
                                    isGranted 
                                      ? "bg-primary/5 border-primary/20" 
                                      : "bg-muted/50 border-transparent hover:border-muted-foreground/20"
                                  )}
                                >
                                  <Checkbox
                                    checked={isGranted}
                                    onCheckedChange={() => handleToggleRolePermission(
                                      perm.module as PermissionModule,
                                      perm.action as PermissionAction,
                                      isGranted
                                    )}
                                    disabled={!canManage || setRolePermission.isPending}
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
          </TabsContent>

          {/* User Overrides Tab */}
          <TabsContent value="users">
            <div className="mb-4">
              <Select
                value={selectedUserId || ''}
                onValueChange={(v) => setSelectedUserId(v || null)}
              >
                <SelectTrigger className="w-full md:w-[300px]">
                  <SelectValue placeholder="Select a user to view/edit permissions" />
                </SelectTrigger>
                <SelectContent>
                  {usersLoading ? (
                    <SelectItem value="" disabled>Loading users...</SelectItem>
                  ) : (
                    companyUsers
                      ?.filter(u => u.role !== 'super_admin')
                      .map((user) => (
                        <SelectItem key={user.user_id} value={user.user_id}>
                          {user.profile?.email || 'Unknown'} ({ROLE_LABELS[user.role as AppRole] || user.role})
                        </SelectItem>
                      ))
                  )}
                </SelectContent>
              </Select>
            </div>

            {!selectedUserId ? (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>Select a user to view their permissions</p>
              </div>
            ) : userPermissionsLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-32 w-full" />
                ))}
              </div>
            ) : (
              <div className="space-y-6">
                {Object.entries(userPermissionsByModule || {}).map(([module, permissions]) => (
                  <div key={module} className="border rounded-lg p-4">
                    <h4 className="font-medium mb-3 flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      {MODULE_LABELS[module as PermissionModule]}
                    </h4>
                    <div className="space-y-2">
                      {permissions?.map((perm) => (
                        <div
                          key={perm.permission_id}
                          className={cn(
                            "flex items-center justify-between p-2 rounded border",
                            perm.has_permission
                              ? "bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800"
                              : "bg-muted/50 border-transparent"
                          )}
                        >
                          <div className="flex items-center gap-2">
                            {perm.has_permission ? (
                              <Check className="h-4 w-4 text-green-600" />
                            ) : (
                              <X className="h-4 w-4 text-muted-foreground" />
                            )}
                            <span className="text-sm font-medium">
                              {ACTION_LABELS[perm.action]}
                            </span>
                            {getSourceBadge(perm.source)}
                          </div>
                          
                          {canManage && perm.source !== 'super_admin' && (
                            <div className="flex gap-1">
                              <Button
                                variant={perm.source === 'explicit_allow' ? 'default' : 'outline'}
                                size="sm"
                                className="h-7 px-2"
                                onClick={() => handleSetUserPermission(perm.module, perm.action, true)}
                                disabled={setUserPermission.isPending}
                              >
                                <Check className="h-3 w-3" />
                              </Button>
                              <Button
                                variant={perm.source === 'explicit_deny' ? 'destructive' : 'outline'}
                                size="sm"
                                className="h-7 px-2"
                                onClick={() => handleSetUserPermission(perm.module, perm.action, false)}
                                disabled={setUserPermission.isPending}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 px-2"
                                onClick={() => handleSetUserPermission(perm.module, perm.action, null)}
                                disabled={setUserPermission.isPending || (perm.source !== 'explicit_allow' && perm.source !== 'explicit_deny')}
                              >
                                <Minus className="h-3 w-3" />
                              </Button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

export default PlatformPermissionViewer;
