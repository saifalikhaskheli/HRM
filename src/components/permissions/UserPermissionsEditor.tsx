import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { 
  useUserPermissions, 
  useSetUserPermission,
  useUsersWithOverrides,
} from '@/hooks/usePermissions';
import { useCompanyUsers } from '@/hooks/useCompanyUsers';
import { useEmployees } from '@/hooks/useEmployees';
import { useTenant } from '@/contexts/TenantContext';
import { 
  PermissionModule, 
  PermissionAction, 
  MODULE_LABELS, 
  ACTION_LABELS 
} from '@/types/permissions';
import { 
  UserCog, 
  Check, 
  X, 
  RotateCcw,
  AlertCircle,
  Shield,
  ShieldOff,
  ShieldCheck,
  Search,
  ChevronDown,
  ChevronRight,
  Users,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export function UserPermissionsEditor() {
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(true);
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());
  const { isAdmin } = useTenant();
  
  const { data: users, isLoading: usersLoading } = useCompanyUsers();
  const { data: employees } = useEmployees();
  const { data: userPermissions, isLoading: permissionsLoading } = useUserPermissions(selectedUserId);
  const { data: usersWithOverrides, isLoading: overridesLoading } = useUsersWithOverrides();
  const setPermission = useSetUserPermission();

  const isLoading = usersLoading || permissionsLoading;

  // Create a map of user_id to employee data for quick lookup
  const employeeByUserId = useMemo(() => {
    const map = new Map<string, { employee_number: string; email: string }>();
    employees?.forEach(emp => {
      if (emp.user_id) {
        map.set(emp.user_id, { employee_number: emp.employee_number, email: emp.email });
      }
    });
    return map;
  }, [employees]);

  // Filter users based on search query - only show when searching
  const filteredUsers = useMemo(() => {
    if (!users) return [];
    const query = searchQuery.toLowerCase().trim();
    
    // Don't show users until search query is entered
    if (!query) return [];
    
    return users.filter(u => {
      if (u.role === 'super_admin') return false;
      
      const firstName = u.profile?.first_name?.toLowerCase() || '';
      const lastName = u.profile?.last_name?.toLowerCase() || '';
      const email = u.profile?.email?.toLowerCase() || '';
      const employeeData = employeeByUserId.get(u.user_id);
      const empNumber = employeeData?.employee_number?.toLowerCase() || '';
      const empEmail = employeeData?.email?.toLowerCase() || '';
      
      return (
        firstName.includes(query) ||
        lastName.includes(query) ||
        `${firstName} ${lastName}`.includes(query) ||
        email.includes(query) ||
        empEmail.includes(query) ||
        empNumber.includes(query)
      );
    });
  }, [users, searchQuery, employeeByUserId]);

  // Handle user selection - hide search after selection
  const handleSelectUser = (userId: string) => {
    setSelectedUserId(userId);
    setShowSearch(false);
    setSearchQuery('');
  };

  // Handle changing user - show search again
  const handleChangeUser = () => {
    setSelectedUserId(null);
    setShowSearch(true);
  };

  // Group permissions by module
  const permissionsByModule = userPermissions?.reduce((acc, perm) => {
    if (!acc[perm.module]) {
      acc[perm.module] = [];
    }
    acc[perm.module].push(perm);
    return acc;
  }, {} as Record<PermissionModule, typeof userPermissions>);

  // Count overrides per module
  const overrideCountByModule = useMemo(() => {
    const counts: Record<string, number> = {};
    if (permissionsByModule) {
      Object.entries(permissionsByModule).forEach(([module, perms]) => {
        counts[module] = perms?.filter(p => 
          p.source === 'explicit_allow' || p.source === 'explicit_deny'
        ).length || 0;
      });
    }
    return counts;
  }, [permissionsByModule]);

  const handleSetPermission = (
    module: PermissionModule, 
    action: PermissionAction, 
    granted: boolean | null
  ) => {
    if (!selectedUserId) return;
    
    setPermission.mutate({
      userId: selectedUserId,
      module,
      action,
      granted,
    });
  };

  const toggleModule = (module: string) => {
    setExpandedModules(prev => {
      const next = new Set(prev);
      if (next.has(module)) {
        next.delete(module);
      } else {
        next.add(module);
      }
      return next;
    });
  };

  const selectedUser = users?.find(u => u.user_id === selectedUserId);
  const selectedEmployeeData = selectedUserId ? employeeByUserId.get(selectedUserId) : null;
  const totalUsers = users?.filter(u => u.role !== 'super_admin').length || 0;

  if (!isAdmin) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Only company admins can manage user permissions.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserCog className="h-5 w-5" />
          User Permission Overrides
        </CardTitle>
        <CardDescription>
          Grant or deny specific permissions for individual users.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Users with Overrides Section */}
        {usersWithOverrides && usersWithOverrides.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="h-4 w-4" />
              <span>Users with custom permissions:</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {overridesLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-7 w-24" />
                ))
              ) : (
                usersWithOverrides.map((user) => {
                  const isSelected = selectedUserId === user.user_id;
                  const empData = employeeByUserId.get(user.user_id);
                  const displayName = user.first_name && user.last_name 
                    ? `${user.first_name} ${user.last_name}`
                    : empData?.employee_number || user.email || 'Unknown';
                  
                  return (
                    <Badge
                      key={user.user_id}
                      variant={isSelected ? "default" : "secondary"}
                      className="cursor-pointer hover:bg-primary/80 transition-colors"
                      onClick={() => handleSelectUser(user.user_id)}
                    >
                      {displayName}
                    </Badge>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* Search Section - only show when showSearch is true and no user selected */}
        {showSearch && (
          <div className="space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, or employee ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            {searchQuery.trim() && (
              <p className="text-xs text-muted-foreground">
                Showing {filteredUsers.length} of {totalUsers} users
              </p>
            )}
          </div>
        )}

        {/* User table - only show when searching */}
        {showSearch && searchQuery.trim() && (
          <div className="border rounded-lg">
            <ScrollArea className="h-[280px]">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-[200px]">Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead className="w-[120px]">Employee ID</TableHead>
                    <TableHead className="w-[100px]">Role</TableHead>
                  </TableRow>
              </TableHeader>
              <TableBody>
                {usersLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-40" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                    </TableRow>
                  ))
                ) : filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                      No users found matching your search
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map((user) => {
                    const empData = employeeByUserId.get(user.user_id);
                    
                    return (
                      <TableRow
                        key={user.user_id}
                        className="cursor-pointer transition-colors hover:bg-muted/50"
                        onClick={() => handleSelectUser(user.user_id)}
                      >
                        <TableCell className="font-medium">
                          {user.profile?.first_name} {user.profile?.last_name}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {user.profile?.email || empData?.email || '—'}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {empData?.employee_number || '—'}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs capitalize">
                            {user.role?.replace('_', ' ')}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </div>
        )}

        {/* Empty state - only show when no user selected and search is active */}
        {!selectedUserId && showSearch && (
          <div className="flex items-center justify-center py-8 border rounded-lg bg-muted/20">
            <div className="text-center text-muted-foreground">
              <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Search for a user above and click to select</p>
            </div>
          </div>
        )}

        {/* Selected user - Permissions Panel */}
        {selectedUserId && selectedUser?.role === 'super_admin' ? (
          <Alert>
            <Shield className="h-4 w-4" />
            <AlertDescription>
              Super admins have all permissions and cannot be modified.
            </AlertDescription>
          </Alert>
        ) : selectedUserId && (
          <div className="border rounded-lg">
            {/* Selected user header */}
            <div className="p-3 border-b bg-muted/30 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div>
                  <span className="font-medium">
                    {selectedUser?.profile?.first_name} {selectedUser?.profile?.last_name}
                  </span>
                  {selectedEmployeeData?.employee_number && (
                    <span className="text-sm text-muted-foreground ml-2">
                      #{selectedEmployeeData.employee_number}
                    </span>
                  )}
                </div>
                <Badge variant="secondary" className="capitalize">
                  {selectedUser?.role?.replace('_', ' ')}
                </Badge>
              </div>
              
              <div className="flex items-center gap-4">
                {/* Legend */}
                <div className="hidden sm:flex gap-4 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <div className="h-3 w-3 rounded bg-green-500/20 border border-green-300" />
                    <span>Allowed</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="h-3 w-3 rounded bg-red-500/20 border border-red-300" />
                    <span>Denied</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="h-3 w-3 rounded bg-muted border" />
                    <span>Inherited</span>
                  </div>
                </div>
                {/* Change User button */}
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleChangeUser}
                >
                  Change User
                </Button>
              </div>
            </div>

            {/* Permissions list */}
            <ScrollArea className="max-h-[400px]">
              {isLoading ? (
                <div className="p-4 space-y-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                  ))}
                </div>
              ) : (
                <div className="divide-y">
                  {Object.entries(permissionsByModule || {}).map(([module, permissions]) => {
                    const isExpanded = expandedModules.has(module);
                    const overrideCount = overrideCountByModule[module] || 0;
                    
                    return (
                      <Collapsible 
                        key={module} 
                        open={isExpanded} 
                        onOpenChange={() => toggleModule(module)}
                      >
                        <CollapsibleTrigger className="w-full px-4 py-3 flex items-center justify-between hover:bg-muted/50 transition-colors">
                          <div className="flex items-center gap-2">
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            )}
                            <span className="font-medium">
                              {MODULE_LABELS[module as PermissionModule]}
                            </span>
                            {overrideCount > 0 && (
                              <Badge variant="secondary" className="text-xs">
                                {overrideCount} override{overrideCount > 1 ? 's' : ''}
                              </Badge>
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {permissions?.length} permissions
                          </span>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div className="px-4 pb-3 space-y-1">
                            {permissions?.map((perm) => {
                              const isExplicitAllow = perm.source === 'explicit_allow';
                              const isExplicitDeny = perm.source === 'explicit_deny';
                              const hasOverride = isExplicitAllow || isExplicitDeny;

                              return (
                                <div
                                  key={perm.permission_id}
                                  className={cn(
                                    "flex items-center justify-between py-2 px-3 rounded-md text-sm",
                                    isExplicitAllow && "bg-green-500/10",
                                    isExplicitDeny && "bg-red-500/10",
                                    !hasOverride && "bg-muted/30"
                                  )}
                                >
                                  <div className="flex items-center gap-2">
                                    <span>{ACTION_LABELS[perm.action]}</span>
                                    {perm.has_permission && !hasOverride && (
                                      <Check className="h-3 w-3 text-green-600" />
                                    )}
                                    {!perm.has_permission && !hasOverride && (
                                      <X className="h-3 w-3 text-muted-foreground" />
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className={cn(
                                        "h-7 w-7 p-0",
                                        isExplicitAllow && "bg-green-600 text-white hover:bg-green-700"
                                      )}
                                      onClick={() => handleSetPermission(
                                        perm.module,
                                        perm.action,
                                        isExplicitAllow ? null : true
                                      )}
                                      disabled={setPermission.isPending}
                                      title="Allow"
                                    >
                                      <ShieldCheck className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className={cn(
                                        "h-7 w-7 p-0",
                                        isExplicitDeny && "bg-red-600 text-white hover:bg-red-700"
                                      )}
                                      onClick={() => handleSetPermission(
                                        perm.module,
                                        perm.action,
                                        isExplicitDeny ? null : false
                                      )}
                                      disabled={setPermission.isPending}
                                      title="Deny"
                                    >
                                      <ShieldOff className="h-3.5 w-3.5" />
                                    </Button>
                                    {hasOverride && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 w-7 p-0"
                                        onClick={() => handleSetPermission(
                                          perm.module,
                                          perm.action,
                                          null
                                        )}
                                        disabled={setPermission.isPending}
                                        title="Reset to role default"
                                      >
                                        <RotateCcw className="h-3.5 w-3.5" />
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default UserPermissionsEditor;
