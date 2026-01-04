import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTenant } from '@/contexts/TenantContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useEmployeesWithoutUser } from '@/hooks/useEmployeesWithoutUser';
import { useDepartments } from '@/hooks/useDepartments';
import { useUserManagement } from '@/hooks/useUserManagement';
import { 
  ArrowLeft, 
  Search, 
  UserPlus, 
  Users, 
  X,
  Loader2
} from 'lucide-react';
import type { AppRole } from '@/types/auth';

const ROLES: { value: AppRole; label: string; description: string }[] = [
  { value: 'employee', label: 'Employee', description: 'Basic access' },
  { value: 'manager', label: 'Manager', description: 'Team management' },
  { value: 'hr_manager', label: 'HR Manager', description: 'HR operations' },
  { value: 'company_admin', label: 'Company Admin', description: 'Full access' },
];

export default function InviteUsersPage() {
  const navigate = useNavigate();
  const { isFrozen } = useTenant();
  const { data: employees, isLoading: employeesLoading } = useEmployeesWithoutUser();
  const { data: departments } = useDepartments();
  const { createEmployeeUser, isCreatingUser, canManageUsers } = useUserManagement();

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');
  const [positionFilter, setPositionFilter] = useState<string>('all');

  // Selection
  const [selectedEmployees, setSelectedEmployees] = useState<Set<string>>(new Set());
  const [bulkRole, setBulkRole] = useState<AppRole>('employee');

  // Individual role selection
  const [employeeRoles, setEmployeeRoles] = useState<Record<string, AppRole>>({});

  // Processing state
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());

  // Get unique positions from employees
  const positions = useMemo(() => {
    if (!employees) return [];
    const uniquePositions = new Set(
      employees.map(e => e.job_title).filter(Boolean) as string[]
    );
    return Array.from(uniquePositions).sort();
  }, [employees]);

  // Filter employees
  const filteredEmployees = useMemo(() => {
    if (!employees) return [];
    
    return employees.filter(employee => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesSearch = 
          employee.first_name.toLowerCase().includes(query) ||
          employee.last_name.toLowerCase().includes(query) ||
          employee.email.toLowerCase().includes(query) ||
          employee.employee_number.toLowerCase().includes(query) ||
          (employee.job_title?.toLowerCase().includes(query));
        
        if (!matchesSearch) return false;
      }

      // Department filter
      if (departmentFilter !== 'all') {
        if (employee.department?.name !== departmentFilter) return false;
      }

      // Position filter
      if (positionFilter !== 'all') {
        if (employee.job_title !== positionFilter) return false;
      }

      return true;
    });
  }, [employees, searchQuery, departmentFilter, positionFilter]);

  // Selection handlers
  const toggleSelectAll = () => {
    if (selectedEmployees.size === filteredEmployees.length) {
      setSelectedEmployees(new Set());
    } else {
      setSelectedEmployees(new Set(filteredEmployees.map(e => e.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const newSelection = new Set(selectedEmployees);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    setSelectedEmployees(newSelection);
  };

  const getEmployeeRole = (employeeId: string): AppRole => {
    return employeeRoles[employeeId] || 'employee';
  };

  const setEmployeeRole = (employeeId: string, role: AppRole) => {
    setEmployeeRoles(prev => ({ ...prev, [employeeId]: role }));
  };

  const clearFilters = () => {
    setSearchQuery('');
    setDepartmentFilter('all');
    setPositionFilter('all');
  };

  const hasActiveFilters = searchQuery || departmentFilter !== 'all' || positionFilter !== 'all';

  // Create single user account
  const handleCreateSingle = async (employeeId: string) => {
    if (processingIds.has(employeeId)) return;
    
    setProcessingIds(prev => new Set(prev).add(employeeId));
    
    try {
      await createEmployeeUser.mutateAsync({
        employeeId,
        role: getEmployeeRole(employeeId),
      });
      
      // Remove from selection after success
      setSelectedEmployees(prev => {
        const newSet = new Set(prev);
        newSet.delete(employeeId);
        return newSet;
      });
    } finally {
      setProcessingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(employeeId);
        return newSet;
      });
    }
  };

  // Bulk create user accounts
  const handleBulkCreate = async () => {
    const employeeIds = Array.from(selectedEmployees);
    
    for (const employeeId of employeeIds) {
      setProcessingIds(prev => new Set(prev).add(employeeId));
      
      try {
        await createEmployeeUser.mutateAsync({
          employeeId,
          role: bulkRole,
        });
        
        setSelectedEmployees(prev => {
          const newSet = new Set(prev);
          newSet.delete(employeeId);
          return newSet;
        });
      } catch (error) {
        // Error is already handled by the mutation
        console.error(`Failed to create user for employee ${employeeId}:`, error);
      } finally {
        setProcessingIds(prev => {
          const newSet = new Set(prev);
          newSet.delete(employeeId);
          return newSet;
        });
      }
    }
  };

  if (!canManageUsers) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center text-muted-foreground">
            You don't have permission to manage users.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/app/settings/users')}
          className="gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Users & Roles
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Create User Accounts</CardTitle>
          <CardDescription>
            Select employees to create user accounts for. They will receive login credentials via email.
            {isFrozen && <span className="ml-2 text-destructive">(Disabled while account is frozen)</span>}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, employee number..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Department" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Departments</SelectItem>
                {departments?.map((dept) => (
                  <SelectItem key={dept.id} value={dept.name}>
                    {dept.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={positionFilter} onValueChange={setPositionFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Position" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Positions</SelectItem>
                {positions.map((position) => (
                  <SelectItem key={position} value={position}>
                    {position}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="h-4 w-4 mr-1" />
                Clear
              </Button>
            )}
          </div>

          {/* Bulk Actions Bar */}
          {selectedEmployees.size > 0 && (
            <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg border">
              <span className="text-sm font-medium">
                {selectedEmployees.size} employee{selectedEmployees.size > 1 ? 's' : ''} selected
              </span>
              
              <div className="flex items-center gap-2 ml-auto">
                <span className="text-sm text-muted-foreground">Assign role:</span>
                <Select value={bulkRole} onValueChange={(value) => setBulkRole(value as AppRole)}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map((role) => (
                      <SelectItem key={role.value} value={role.value}>
                        {role.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                <Button
                  onClick={handleBulkCreate}
                  disabled={isFrozen || processingIds.size > 0}
                >
                  {processingIds.size > 0 ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <UserPlus className="h-4 w-4 mr-2" />
                      Create {selectedEmployees.size} Account{selectedEmployees.size > 1 ? 's' : ''}
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Table */}
          {employeesLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : filteredEmployees.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">
                    <Checkbox
                      checked={selectedEmployees.size === filteredEmployees.length && filteredEmployees.length > 0}
                      onCheckedChange={toggleSelectAll}
                      disabled={isFrozen}
                    />
                  </TableHead>
                  <TableHead>Employee #</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Position</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="w-[140px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEmployees.map((employee) => {
                  const isSelected = selectedEmployees.has(employee.id);
                  const isProcessing = processingIds.has(employee.id);
                  
                  return (
                    <TableRow key={employee.id} className={isSelected ? 'bg-muted/50' : ''}>
                      <TableCell>
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleSelect(employee.id)}
                          disabled={isFrozen || isProcessing}
                        />
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {employee.employee_number}
                      </TableCell>
                      <TableCell className="font-medium">
                        {employee.first_name} {employee.last_name}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {employee.email}
                      </TableCell>
                      <TableCell>
                        {employee.department?.name ? (
                          <Badge variant="outline">{employee.department.name}</Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {employee.job_title || <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell>
                        <Select
                          value={getEmployeeRole(employee.id)}
                          onValueChange={(value) => setEmployeeRole(employee.id, value as AppRole)}
                          disabled={isSelected || isFrozen || isProcessing}
                        >
                          <SelectTrigger className="w-[130px] h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ROLES.map((role) => (
                              <SelectItem key={role.value} value={role.value}>
                                {role.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => handleCreateSingle(employee.id)}
                          disabled={isFrozen || isProcessing || isSelected}
                        >
                          {isProcessing ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <UserPlus className="h-4 w-4 mr-1" />
                              Create
                            </>
                          )}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-12">
              <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              {employees?.length === 0 ? (
                <>
                  <p className="text-lg font-medium">All employees have user accounts</p>
                  <p className="text-muted-foreground mt-1">
                    There are no employees without user accounts.
                  </p>
                </>
              ) : (
                <>
                  <p className="text-lg font-medium">No matching employees</p>
                  <p className="text-muted-foreground mt-1">
                    Try adjusting your filters to find employees.
                  </p>
                  <Button variant="ghost" className="mt-4" onClick={clearFilters}>
                    Clear Filters
                  </Button>
                </>
              )}
            </div>
          )}

          {/* Summary */}
          {!employeesLoading && employees && employees.length > 0 && (
            <div className="flex items-center justify-between text-sm text-muted-foreground pt-4 border-t">
              <span>
                Showing {filteredEmployees.length} of {employees.length} employees without user accounts
              </span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
