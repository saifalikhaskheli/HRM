import { useState, useMemo, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { TablePagination } from '@/components/ui/table-pagination';
import { ModulePermissionCell } from './ModulePermissionCell';
import { 
  useUserPermissions, 
  useSetUserPermission,
  useAllPermissions,
  useBatchSetUserPermissions,
} from '@/hooks/usePermissions';
import { useCompanyUsers } from '@/hooks/useCompanyUsers';
import { useEmployees } from '@/hooks/useEmployees';
import { useTenant } from '@/contexts/TenantContext';
import { 
  PermissionModule, 
  PermissionAction, 
  MODULE_LABELS, 
  UserPermission,
} from '@/types/permissions';
import { Search, RotateCcw, Save, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

// Modules to display as columns
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
  'compliance',
  'audit',
  'settings',
  'users',
];

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super Admin',
  company_admin: 'Company Admin',
  hr_manager: 'HR Manager',
  manager: 'Manager',
  employee: 'Employee',
};

const ROLE_VARIANTS: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  super_admin: 'default',
  company_admin: 'default',
  hr_manager: 'secondary',
  manager: 'secondary',
  employee: 'outline',
};

interface PendingChange {
  module: PermissionModule;
  action: PermissionAction;
  granted: boolean;
}

interface UserPermissionState {
  userId: string;
  permissions: UserPermission[];
  pendingChanges: PendingChange[];
}

const PAGE_SIZE = 10;

export function UserPermissionsTable() {
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [savingUserId, setSavingUserId] = useState<string | null>(null);
  const [pendingChanges, setPendingChanges] = useState<Record<string, PendingChange[]>>({});
  
  const { isAdmin } = useTenant();
  const { data: users, isLoading: usersLoading } = useCompanyUsers();
  const { data: employees, isLoading: employeesLoading } = useEmployees();
  const { data: allPermissions } = useAllPermissions();
  const setPermission = useSetUserPermission();
  const batchSetPermissions = useBatchSetUserPermissions();

  // Create a map of user_id to employee data
  const employeeByUserId = useMemo(() => {
    const map = new Map<string, { employee_number: string; email: string }>();
    employees?.forEach(emp => {
      if (emp.user_id) {
        map.set(emp.user_id, { employee_number: emp.employee_number, email: emp.email });
      }
    });
    return map;
  }, [employees]);

  // Filter users based on search
  const filteredUsers = useMemo(() => {
    if (!users) return [];
    const query = searchQuery.toLowerCase().trim();
    
    return users.filter(u => {
      // Don't filter out any roles - show all users
      if (!query) return true;
      
      const firstName = u.profile?.first_name?.toLowerCase() || '';
      const lastName = u.profile?.last_name?.toLowerCase() || '';
      const email = u.profile?.email?.toLowerCase() || '';
      const employeeData = employeeByUserId.get(u.user_id);
      const empNumber = employeeData?.employee_number?.toLowerCase() || '';
      
      return (
        firstName.includes(query) ||
        lastName.includes(query) ||
        `${firstName} ${lastName}`.includes(query) ||
        email.includes(query) ||
        empNumber.includes(query)
      );
    });
  }, [users, searchQuery, employeeByUserId]);

  // Reset to page 1 when search changes
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setCurrentPage(1);
  };

  // Paginate filtered users
  const paginatedUsers = useMemo(() => {
    const startIndex = (currentPage - 1) * PAGE_SIZE;
    return filteredUsers.slice(startIndex, startIndex + PAGE_SIZE);
  }, [filteredUsers, currentPage]);

  const handleTogglePermission = useCallback((
    userId: string,
    module: PermissionModule,
    action: PermissionAction,
    newValue: boolean
  ) => {
    setPendingChanges(prev => {
      const userChanges = [...(prev[userId] || [])];
      const existingIdx = userChanges.findIndex(
        c => c.module === module && c.action === action
      );
      
      if (existingIdx >= 0) {
        userChanges[existingIdx] = { module, action, granted: newValue };
      } else {
        userChanges.push({ module, action, granted: newValue });
      }
      
      return { ...prev, [userId]: userChanges };
    });
  }, []);

  const handleToggleAllModulePermissions = useCallback((
    userId: string,
    module: PermissionModule,
    enable: boolean
  ) => {
    const modulePerms = allPermissions?.filter(p => p.module === module);
    if (!modulePerms) return;

    setPendingChanges(prev => {
      const userChanges = [...(prev[userId] || [])];
      
      modulePerms.forEach(perm => {
        const existingIdx = userChanges.findIndex(
          c => c.module === module && c.action === perm.action
        );
        
        if (existingIdx >= 0) {
          userChanges[existingIdx] = { module, action: perm.action as PermissionAction, granted: enable };
        } else {
          userChanges.push({ module, action: perm.action as PermissionAction, granted: enable });
        }
      });
      
      return { ...prev, [userId]: userChanges };
    });
  }, [allPermissions]);

  const handleSaveUser = async (userId: string) => {
    const changes = pendingChanges[userId];
    if (!changes?.length) return;

    setSavingUserId(userId);
    
    try {
      // Use batch mutation for better performance
      await batchSetPermissions.mutateAsync({
        userId,
        permissions: changes,
      });
      
      setPendingChanges(prev => {
        const next = { ...prev };
        delete next[userId];
        return next;
      });
      
      toast.success('Permissions saved successfully');
    } catch (error) {
      toast.error('Failed to save permissions');
    } finally {
      setSavingUserId(null);
    }
  };

  const handleLoadDefaults = async (userId: string) => {
    // Clear all pending changes and remove overrides (set to null)
    setPendingChanges(prev => {
      const next = { ...prev };
      delete next[userId];
      return next;
    });
    
    toast.info('Defaults loaded - changes will take effect on save');
  };

  const isLoading = usersLoading || employeesLoading;

  return (
    <div className="space-y-4 min-w-0 w-full">
      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search employees..."
          value={searchQuery}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Table with contained scroll - fixed height container */}
      <div className="border rounded-lg min-w-0 w-full overflow-hidden">
        <div className="max-h-[500px] overflow-auto">
          <Table>
            <TableHeader className="sticky top-0 bg-background z-20">
              <TableRow className="hover:bg-transparent">
                <TableHead className="min-w-[180px] sticky left-0 bg-background z-30">Name</TableHead>
                <TableHead className="min-w-[100px]">Employee ID</TableHead>
                <TableHead className="min-w-[200px]">Email</TableHead>
                <TableHead className="min-w-[120px]">Role</TableHead>
                {DISPLAY_MODULES.map(module => (
                  <TableHead key={module} className="min-w-[90px] text-center">
                    <span className="text-xs">{MODULE_LABELS[module]}</span>
                  </TableHead>
                ))}
                <TableHead className="min-w-[100px] sticky right-0 bg-background z-30">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-40" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                    {DISPLAY_MODULES.map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-5 w-12" /></TableCell>
                    ))}
                    <TableCell><Skeleton className="h-8 w-16" /></TableCell>
                  </TableRow>
                ))
              ) : paginatedUsers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5 + DISPLAY_MODULES.length} className="h-24 text-center text-muted-foreground">
                    {searchQuery ? 'No users found matching your search' : 'No users found'}
                  </TableCell>
                </TableRow>
              ) : (
                paginatedUsers.map((user) => (
                  <UserPermissionRow
                    key={user.user_id}
                    userId={user.user_id}
                    userName={`${user.profile?.first_name || ''} ${user.profile?.last_name || ''}`.trim() || 'Unknown'}
                    employeeNumber={employeeByUserId.get(user.user_id)?.employee_number}
                    email={user.profile?.email || employeeByUserId.get(user.user_id)?.email}
                    role={user.role}
                    pendingChanges={pendingChanges[user.user_id] || []}
                    onTogglePermission={(module, action, value) => 
                      handleTogglePermission(user.user_id, module, action, value)
                    }
                    onToggleAllModule={(module, enable) =>
                      handleToggleAllModulePermissions(user.user_id, module, enable)
                    }
                    onSave={() => handleSaveUser(user.user_id)}
                    onLoadDefaults={() => handleLoadDefaults(user.user_id)}
                    isSaving={savingUserId === user.user_id}
                    hasPendingChanges={(pendingChanges[user.user_id]?.length || 0) > 0}
                  />
                ))
              )}
            </TableBody>
          </Table>
        </div>
        
        {/* Pagination */}
        <TablePagination
          currentPage={currentPage}
          totalItems={filteredUsers.length}
          pageSize={PAGE_SIZE}
          onPageChange={setCurrentPage}
        />
      </div>
    </div>
  );
}

interface UserPermissionRowProps {
  userId: string;
  userName: string;
  employeeNumber?: string;
  email?: string;
  role: string;
  pendingChanges: PendingChange[];
  onTogglePermission: (module: PermissionModule, action: PermissionAction, value: boolean) => void;
  onToggleAllModule: (module: PermissionModule, enable: boolean) => void;
  onSave: () => void;
  onLoadDefaults: () => void;
  isSaving: boolean;
  hasPendingChanges: boolean;
}

function UserPermissionRow({
  userId,
  userName,
  employeeNumber,
  email,
  role,
  pendingChanges,
  onTogglePermission,
  onToggleAllModule,
  onSave,
  onLoadDefaults,
  isSaving,
  hasPendingChanges,
}: UserPermissionRowProps) {
  const { data: userPermissions, isLoading } = useUserPermissions(userId);
  const { data: allPermissions } = useAllPermissions();
  
  const isSuperAdmin = role === 'super_admin';

  // Group permissions by module with pending changes applied
  const permissionsByModule = useMemo(() => {
    const result: Record<PermissionModule, { action: PermissionAction; hasPermission: boolean; isOverride: boolean }[]> = {} as any;
    
    DISPLAY_MODULES.forEach(module => {
      const modulePerms = allPermissions?.filter(p => p.module === module) || [];
      
      result[module] = modulePerms.map(perm => {
        const userPerm = userPermissions?.find(
          up => up.module === module && up.action === perm.action
        );
        
        // Check if there's a pending change
        const pendingChange = pendingChanges.find(
          pc => pc.module === module && pc.action === perm.action
        );
        
        const hasPermission = pendingChange 
          ? pendingChange.granted 
          : (userPerm?.has_permission ?? false);
        
        const isOverride = userPerm?.source === 'explicit_allow' || userPerm?.source === 'explicit_deny' || !!pendingChange;
        
        return {
          action: perm.action as PermissionAction,
          hasPermission,
          isOverride,
        };
      });
    });
    
    return result;
  }, [allPermissions, userPermissions, pendingChanges]);

  if (isLoading) {
    return (
      <TableRow>
        <TableCell className="sticky left-0 bg-background">{userName}</TableCell>
        <TableCell>{employeeNumber || '—'}</TableCell>
        <TableCell className="text-muted-foreground">{email || '—'}</TableCell>
        <TableCell>
          <Badge variant={ROLE_VARIANTS[role] || 'outline'}>
            {ROLE_LABELS[role] || role}
          </Badge>
        </TableCell>
        {DISPLAY_MODULES.map((module) => (
          <TableCell key={module}>
            <Skeleton className="h-5 w-12" />
          </TableCell>
        ))}
        <TableCell className="sticky right-0 bg-background">
          <Skeleton className="h-8 w-16" />
        </TableCell>
      </TableRow>
    );
  }

  return (
    <TableRow className={hasPendingChanges ? 'bg-primary/5' : undefined}>
      <TableCell className="font-medium sticky left-0 bg-background z-10">
        {userName}
      </TableCell>
      <TableCell className="text-muted-foreground">
        {employeeNumber || '—'}
      </TableCell>
      <TableCell className="text-muted-foreground">
        {email || '—'}
      </TableCell>
      <TableCell>
        <Badge variant={ROLE_VARIANTS[role] || 'outline'}>
          {ROLE_LABELS[role] || role}
        </Badge>
      </TableCell>
      {DISPLAY_MODULES.map((module) => (
        <TableCell key={module} className="text-center">
          {isSuperAdmin ? (
            <span className="text-xs text-muted-foreground">All</span>
          ) : (
            <ModulePermissionCell
              module={module}
              permissions={permissionsByModule[module] || []}
              onToggle={(action, value) => onTogglePermission(module, action, value)}
              onToggleAll={(enable) => onToggleAllModule(module, enable)}
              disabled={isSaving}
            />
          )}
        </TableCell>
      ))}
      <TableCell className="sticky right-0 bg-background z-10">
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={onLoadDefaults}
            disabled={isSaving || isSuperAdmin}
            className="h-8 w-8 p-0"
            title="Load Defaults"
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
          <Button
            variant={hasPendingChanges ? 'default' : 'ghost'}
            size="sm"
            onClick={onSave}
            disabled={isSaving || !hasPendingChanges || isSuperAdmin}
            className="h-8"
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}
