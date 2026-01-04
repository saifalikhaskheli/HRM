import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { 
  useUsersWithOverrides,
  useUserPermissions,
  useSetUserPermission,
} from '@/hooks/usePermissions';
import { useCompanyUsers } from '@/hooks/useCompanyUsers';
import { useEmployees } from '@/hooks/useEmployees';
import { useTenant } from '@/contexts/TenantContext';
import { PermissionModule, PermissionAction, MODULE_LABELS, ACTION_LABELS } from '@/types/permissions';
import { 
  AlertCircle,
  Trash2,
  Loader2,
  UserX,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { toast } from 'sonner';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

export function UserOverridesList() {
  const { isAdmin } = useTenant();
  const { data: usersWithOverrides, isLoading } = useUsersWithOverrides();
  const { data: employees } = useEmployees();
  const { data: companyUsers } = useCompanyUsers();

  // Create lookups
  const employeeByUserId = new Map(
    employees?.filter(e => e.user_id).map(e => [e.user_id, e]) || []
  );
  
  const companyUserByUserId = new Map(
    companyUsers?.map(u => [u.user_id, u]) || []
  );

  if (!isAdmin) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Only company admins can manage user permission overrides.
        </AlertDescription>
      </Alert>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (!usersWithOverrides?.length) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <UserX className="h-12 w-12 text-muted-foreground/50 mb-4" />
        <h3 className="text-lg font-medium mb-1">No Permission Overrides</h3>
        <p className="text-sm text-muted-foreground max-w-md">
          No users have custom permission overrides. All users are using their role's default permissions.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-medium">User Overrides</h3>
        <p className="text-sm text-muted-foreground">
          Users with custom permission overrides
        </p>
      </div>

      <div className="space-y-2">
        {usersWithOverrides.map((user) => {
          const employee = employeeByUserId.get(user.user_id);
          const companyUser = companyUserByUserId.get(user.user_id);
          
          const displayName = user.first_name && user.last_name
            ? `${user.first_name} ${user.last_name}`
            : employee?.first_name && employee?.last_name
              ? `${employee.first_name} ${employee.last_name}`
              : user.email || 'Unknown User';
          
          const employeeNumber = employee?.employee_number;
          const role = companyUser?.role || 'employee';

          return (
            <UserOverrideCard
              key={user.user_id}
              userId={user.user_id}
              displayName={displayName}
              email={user.email}
              employeeNumber={employeeNumber}
              role={role}
            />
          );
        })}
      </div>
    </div>
  );
}

interface UserOverrideCardProps {
  userId: string;
  displayName: string;
  email?: string;
  employeeNumber?: string;
  role: string;
}

function UserOverrideCard({ userId, displayName, email, employeeNumber, role }: UserOverrideCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [clearing, setClearing] = useState(false);
  
  const { data: userPermissions, isLoading } = useUserPermissions(userId);
  const setPermission = useSetUserPermission();

  // Filter to only overrides
  const overrides = userPermissions?.filter(
    p => p.source === 'explicit_allow' || p.source === 'explicit_deny'
  ) || [];

  const allowCount = overrides.filter(o => o.source === 'explicit_allow').length;
  const denyCount = overrides.filter(o => o.source === 'explicit_deny').length;

  const handleClearAllOverrides = async () => {
    setClearing(true);
    
    try {
      for (const override of overrides) {
        await setPermission.mutateAsync({
          userId,
          module: override.module,
          action: override.action,
          granted: null, // Remove override
        });
      }
      toast.success('All overrides cleared');
    } catch (error) {
      toast.error('Failed to clear overrides');
    } finally {
      setClearing(false);
    }
  };

  const handleRemoveOverride = async (module: PermissionModule, action: PermissionAction) => {
    try {
      await setPermission.mutateAsync({
        userId,
        module,
        action,
        granted: null,
      });
    } catch (error) {
      toast.error('Failed to remove override');
    }
  };

  return (
    <Collapsible open={expanded} onOpenChange={setExpanded}>
      <div className="border rounded-lg">
        <CollapsibleTrigger className="w-full p-4 flex items-center justify-between hover:bg-muted/30 transition-colors">
          <div className="flex items-center gap-4">
            {expanded ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
            <div className="text-left">
              <div className="font-medium">{displayName}</div>
              <div className="text-xs text-muted-foreground">
                {employeeNumber && `#${employeeNumber} • `}
                {email}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="capitalize">
              {role.replace('_', ' ')}
            </Badge>
            <div className="flex gap-2">
              {allowCount > 0 && (
                <Badge variant="secondary" className="bg-green-500/10 text-green-700">
                  +{allowCount} allowed
                </Badge>
              )}
              {denyCount > 0 && (
                <Badge variant="secondary" className="bg-red-500/10 text-red-700">
                  -{denyCount} denied
                </Badge>
              )}
            </div>
          </div>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <div className="border-t p-4 space-y-4">
            {isLoading ? (
              <Skeleton className="h-20 w-full" />
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Module</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Override</TableHead>
                      <TableHead className="w-[80px]">Remove</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {overrides.map((override) => (
                      <TableRow key={`${override.module}-${override.action}`}>
                        <TableCell className="font-medium">
                          {MODULE_LABELS[override.module]}
                        </TableCell>
                        <TableCell>{ACTION_LABELS[override.action]}</TableCell>
                        <TableCell>
                          <Badge 
                            variant="secondary"
                            className={cn(
                              override.source === 'explicit_allow' 
                                ? 'bg-green-500/10 text-green-700'
                                : 'bg-red-500/10 text-red-700'
                            )}
                          >
                            {override.source === 'explicit_allow' ? 'Allowed' : 'Denied'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveOverride(override.module, override.action)}
                            disabled={setPermission.isPending}
                          >
                            <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                <div className="flex justify-end">
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" size="sm" disabled={clearing}>
                        {clearing ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4 mr-2" />
                        )}
                        Clear All Overrides
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Clear all permission overrides?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will remove all {overrides.length} custom permission overrides for {displayName}. 
                          They will revert to their role's default permissions.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleClearAllOverrides}>
                          Clear All
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

export default UserOverridesList;
