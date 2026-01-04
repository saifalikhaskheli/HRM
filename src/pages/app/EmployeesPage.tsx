import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Plus, Search, MoreHorizontal, Eye, Pencil, Trash2, Loader2, Upload, Download, FileSpreadsheet, LayoutList, Network, LayoutGrid, Building2 } from 'lucide-react';
import { WriteGate, RoleGate, PermGate } from '@/components/PermissionGate';
import { usePermission } from '@/contexts/PermissionContext';
import { useUserRole } from '@/hooks/useUserRole';
import { ModuleGuard } from '@/components/ModuleGuard';
import { useEmployees, useDeleteEmployee, useUpdateEmployee, type Employee } from '@/hooks/useEmployees';
import { useDepartments } from '@/hooks/useDepartments';
import { EmployeeForm } from '@/components/employees/EmployeeForm';
import { EmployeeDetail } from '@/components/employees/EmployeeDetail';
import { BulkImportDialog } from '@/components/employees/BulkImportDialog';
import { OrgChart } from '@/components/employees/OrgChart';
import { EmployeeFilters, type EmployeeFiltersState } from '@/components/employees/EmployeeFilters';
import { ReadOnlyPageBanner } from '@/components/platform/ImpersonationRestricted';
import { exportEmployeesToCSV, downloadEmployeeImportTemplate } from '@/lib/export-utils';
import { EmployeeCard } from '@/components/employees/EmployeeCard';
import { EmployeeStatsBar } from '@/components/employees/EmployeeStatsBar';
import { StatusIndicator, type EmployeeStatus } from '@/components/employees/StatusIndicator';
import { TablePagination, LoadMoreButton } from '@/components/ui/table-pagination';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'on_leave', label: 'On Leave' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'terminated', label: 'Terminated' },
];

const LIST_PAGE_SIZE = 10;
const GRID_LOAD_INCREMENT = 12;

export default function EmployeesPage() {
  const { data: employees, isLoading } = useEmployees();
  const { data: departments } = useDepartments();
  const deleteEmployee = useDeleteEmployee();
  const { isHROrAbove } = useUserRole();
  const { can } = usePermission();
  const queryClient = useQueryClient();
  
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<EmployeeFiltersState>({
    departmentId: '',
    status: '',
    type: '',
  });
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('list');
  
  // Pagination states
  const [listCurrentPage, setListCurrentPage] = useState(1);
  const [gridDisplayCount, setGridDisplayCount] = useState(GRID_LOAD_INCREMENT);
  
  // Status change states
  const [showTerminateConfirm, setShowTerminateConfirm] = useState(false);
  const [pendingStatusChange, setPendingStatusChange] = useState<{ employeeId: string; status: string } | null>(null);

  const updateStatus = useMutation({
    mutationFn: async ({ employeeId, newStatus }: { employeeId: string; newStatus: string }) => {
      const { error } = await supabase
        .from('employees')
        .update({ employment_status: newStatus as 'active' | 'on_leave' | 'terminated' | 'suspended' })
        .eq('id', employeeId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      toast.success('Employee status updated');
    },
    onError: (error) => {
      toast.error('Failed to update status');
      console.error(error);
    },
  });

  const handleStatusChange = (employeeId: string, newStatus: string) => {
    if (newStatus === 'terminated') {
      setPendingStatusChange({ employeeId, status: newStatus });
      setShowTerminateConfirm(true);
    } else {
      updateStatus.mutate({ employeeId, newStatus });
    }
  };

  const confirmTerminate = () => {
    if (pendingStatusChange) {
      updateStatus.mutate({ employeeId: pendingStatusChange.employeeId, newStatus: pendingStatusChange.status });
    }
    setShowTerminateConfirm(false);
    setPendingStatusChange(null);
  };

  const handleExportEmployees = () => {
    if (employees && employees.length > 0) {
      exportEmployeesToCSV(employees as any);
    }
  };

  const filteredEmployees = useMemo(() => {
    return employees?.filter(emp => {
      // Search filter
      const searchLower = search.toLowerCase();
      const matchesSearch = !search || (
        emp.first_name.toLowerCase().includes(searchLower) ||
        emp.last_name.toLowerCase().includes(searchLower) ||
        emp.email.toLowerCase().includes(searchLower) ||
        emp.employee_number.toLowerCase().includes(searchLower) ||
        (emp.job_title?.toLowerCase().includes(searchLower))
      );

      // Department filter
      const matchesDepartment = !filters.departmentId || emp.department_id === filters.departmentId;

      // Status filter
      const matchesStatus = !filters.status || emp.employment_status === filters.status;

      // Type filter
      const matchesType = !filters.type || emp.employment_type === filters.type;

      return matchesSearch && matchesDepartment && matchesStatus && matchesType;
    }) || [];
  }, [employees, search, filters]);

  // Reset pagination when filters/search change
  const handleSearchChange = (value: string) => {
    setSearch(value);
    setListCurrentPage(1);
    setGridDisplayCount(GRID_LOAD_INCREMENT);
  };

  // Paginated list data
  const paginatedListEmployees = useMemo(() => {
    const startIndex = (listCurrentPage - 1) * LIST_PAGE_SIZE;
    return filteredEmployees.slice(startIndex, startIndex + LIST_PAGE_SIZE);
  }, [filteredEmployees, listCurrentPage]);

  // Grid view data with load more
  const gridEmployees = useMemo(() => {
    return filteredEmployees.slice(0, gridDisplayCount);
  }, [filteredEmployees, gridDisplayCount]);

  const handleView = (employee: Employee) => {
    setSelectedEmployee(employee);
    setIsDetailOpen(true);
  };

  const handleEdit = (employee: Employee) => {
    setEditingEmployee(employee);
    setIsFormOpen(true);
  };

  const handleDelete = async () => {
    if (deletingId) {
      await deleteEmployee.mutateAsync(deletingId);
      setDeletingId(null);
    }
  };

  const handleFormClose = () => {
    setIsFormOpen(false);
    setEditingEmployee(null);
  };

  const activeFilterCount = [filters.departmentId, filters.status, filters.type].filter(Boolean).length;

  return (
    <ModuleGuard moduleId="employees">
      <div className="p-4 md:p-6 space-y-6">
        <ReadOnlyPageBanner />
        
        {/* Enhanced Header */}
        <div className="space-y-1">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                {isHROrAbove ? 'Employees' : 'Company Directory'}
              </h1>
              <p className="text-muted-foreground mt-1">
                {isHROrAbove ? "Manage your organization's workforce" : 'View your colleagues and team members'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {/* Export/Import Dropdown */}
              <PermGate module="employees" action="read">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="border-border/60">
                      <FileSpreadsheet className="h-4 w-4 mr-2" />
                      <span className="hidden sm:inline">Import/Export</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem onClick={handleExportEmployees} disabled={!employees?.length}>
                      <Download className="h-4 w-4 mr-2" />
                      Export Employees
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={downloadEmployeeImportTemplate}>
                      <FileSpreadsheet className="h-4 w-4 mr-2" />
                      Download Template
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <PermGate module="employees" action="create">
                      <WriteGate>
                        <DropdownMenuItem onClick={() => setIsImportOpen(true)}>
                          <Upload className="h-4 w-4 mr-2" />
                          Bulk Import
                        </DropdownMenuItem>
                      </WriteGate>
                    </PermGate>
                  </DropdownMenuContent>
                </DropdownMenu>
              </PermGate>

              <PermGate module="employees" action="create">
                <WriteGate>
                  <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                    <DialogTrigger asChild>
                      <Button onClick={() => setEditingEmployee(null)} className="shadow-sm">
                        <Plus className="h-4 w-4 mr-2" />
                        Add Employee
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle className="text-xl">
                          {editingEmployee ? 'Edit Employee' : 'Add New Employee'}
                        </DialogTitle>
                      </DialogHeader>
                      <EmployeeForm 
                        employee={editingEmployee} 
                        onSuccess={handleFormClose}
                        onCancel={handleFormClose}
                      />
                    </DialogContent>
                  </Dialog>
                </WriteGate>
              </PermGate>
            </div>
          </div>
        </div>

        {/* Stats Bar */}
        <EmployeeStatsBar employees={employees || []} isLoading={isLoading} />

        {/* Main Content with Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <TabsList className="bg-muted/50 p-1">
              <TabsTrigger value="list" className="gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
                <LayoutList className="h-4 w-4" />
                <span>List</span>
                <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                  {filteredEmployees.length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="grid" className="gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
                <LayoutGrid className="h-4 w-4" />
                Grid
              </TabsTrigger>
              <TabsTrigger value="org" className="gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
                <Network className="h-4 w-4" />
                Org Chart
              </TabsTrigger>
            </TabsList>

            {/* Filters - only show in list/grid view */}
            {(activeTab === 'list' || activeTab === 'grid') && (
              <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                <div className="relative flex-1 sm:w-80">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input 
                    placeholder="Search employees..." 
                    className="pl-10 bg-background border-border/60"
                    value={search}
                    onChange={(e) => handleSearchChange(e.target.value)}
                  />
                </div>
                <EmployeeFilters 
                  filters={filters} 
                  onFiltersChange={setFilters}
                  departments={departments || []}
                />
              </div>
            )}
          </div>

          {/* Active filters display */}
          {(activeTab === 'list' || activeTab === 'grid') && activeFilterCount > 0 && (
            <div className="flex flex-wrap gap-2 mt-4">
              {filters.departmentId && (
                <Badge variant="secondary" className="gap-1.5 pl-2 pr-1 py-1">
                  <Building2 className="h-3 w-3" />
                  {departments?.find(d => d.id === filters.departmentId)?.name}
                  <button 
                    onClick={() => setFilters(f => ({ ...f, departmentId: '' }))}
                    className="ml-1 hover:bg-muted rounded-full p-0.5"
                  >
                    <span className="sr-only">Remove filter</span>
                    ×
                  </button>
                </Badge>
              )}
              {filters.status && (
                <Badge variant="secondary" className="gap-1.5 pl-2 pr-1 py-1">
                  Status: {filters.status.replace('_', ' ')}
                  <button 
                    onClick={() => setFilters(f => ({ ...f, status: '' }))}
                    className="ml-1 hover:bg-muted rounded-full p-0.5"
                  >
                    ×
                  </button>
                </Badge>
              )}
              {filters.type && (
                <Badge variant="secondary" className="gap-1.5 pl-2 pr-1 py-1">
                  Type: {filters.type.replace('_', ' ')}
                  <button 
                    onClick={() => setFilters(f => ({ ...f, type: '' }))}
                    className="ml-1 hover:bg-muted rounded-full p-0.5"
                  >
                    ×
                  </button>
                </Badge>
              )}
            </div>
          )}

          {/* List View */}
          <TabsContent value="list" className="mt-6">
            <Card className="border-border/60">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">Employee Directory</CardTitle>
                    <CardDescription>
                      {filteredEmployees.length} employee{filteredEmployees.length !== 1 ? 's' : ''}
                      {activeFilterCount > 0 && ` (filtered from ${employees?.length || 0})`}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex items-center justify-center py-16">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : filteredEmployees.length === 0 ? (
                  <div className="text-center py-16 text-muted-foreground">
                    <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                      <LayoutList className="h-6 w-6" />
                    </div>
                    <p className="font-medium">No employees found</p>
                    <p className="text-sm mt-1">
                      {search || activeFilterCount > 0 
                        ? 'Try adjusting your search or filters.' 
                        : 'Add your first employee to get started.'}
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="rounded-lg border border-border/60 overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/30 hover:bg-muted/30">
                            <TableHead className="font-semibold">Employee</TableHead>
                            <TableHead className="font-semibold">Department</TableHead>
                            <TableHead className="font-semibold">Job Title</TableHead>
                            <TableHead className="font-semibold">Status</TableHead>
                            <TableHead className="font-semibold">Type</TableHead>
                            <TableHead className="w-[50px]"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {paginatedListEmployees.map((employee) => (
                            <TableRow 
                              key={employee.id} 
                              className="cursor-pointer group"
                              onClick={() => handleView(employee)}
                            >
                              <TableCell>
                                <div className="flex items-center gap-3">
                                  <Avatar className="h-10 w-10 ring-1 ring-border">
                                    <AvatarFallback className="bg-primary/10 text-primary font-medium">
                                      {employee.first_name[0]}{employee.last_name[0]}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div>
                                    <div className="font-medium text-foreground">
                                      {employee.first_name} {employee.last_name}
                                    </div>
                                    <div className="text-sm text-muted-foreground flex items-center gap-2">
                                      <span>{employee.email}</span>
                                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 font-normal">
                                        {employee.employee_number}
                                      </Badge>
                                    </div>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell>
                                <span className="text-foreground">
                                  {(employee as any).department?.name || '-'}
                                </span>
                              </TableCell>
                              <TableCell>
                                <span className="text-foreground">
                                  {employee.job_title || '-'}
                                </span>
                              </TableCell>
                              <TableCell onClick={(e) => e.stopPropagation()}>
                                <PermGate module="employees" action="update">
                                  <WriteGate fallback={
                                    <StatusIndicator status={employee.employment_status as EmployeeStatus} />
                                  }>
                                    <Select 
                                      value={employee.employment_status} 
                                      onValueChange={(value) => handleStatusChange(employee.id, value)}
                                      disabled={updateStatus.isPending}
                                    >
                                      <SelectTrigger className="h-8 w-[130px] text-xs border-0 bg-transparent hover:bg-muted">
                                        {updateStatus.isPending ? (
                                          <Loader2 className="h-3 w-3 animate-spin" />
                                        ) : (
                                          <StatusIndicator status={employee.employment_status as EmployeeStatus} />
                                        )}
                                      </SelectTrigger>
                                      <SelectContent>
                                        {STATUS_OPTIONS.map(option => (
                                          <SelectItem key={option.value} value={option.value}>
                                            <span className={option.value === 'terminated' ? 'text-destructive' : ''}>
                                              {option.label}
                                            </span>
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </WriteGate>
                                </PermGate>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className="font-normal capitalize">
                                  {employee.employment_type.replace('_', ' ')}
                                </Badge>
                              </TableCell>
                              <TableCell onClick={(e) => e.stopPropagation()}>
                                {can('employees', 'read') && (
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button 
                                        variant="ghost" 
                                        size="icon"
                                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                                      >
                                        <MoreHorizontal className="h-4 w-4" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-40">
                                      <DropdownMenuItem onClick={() => handleView(employee)}>
                                        <Eye className="h-4 w-4 mr-2" />
                                        View
                                      </DropdownMenuItem>
                                      <PermGate module="employees" action="update">
                                        <WriteGate>
                                          <DropdownMenuItem onClick={() => handleEdit(employee)}>
                                            <Pencil className="h-4 w-4 mr-2" />
                                            Edit
                                          </DropdownMenuItem>
                                        </WriteGate>
                                      </PermGate>
                                      <PermGate module="employees" action="delete">
                                        <WriteGate>
                                          <DropdownMenuItem 
                                            onClick={() => setDeletingId(employee.id)}
                                            className="text-destructive focus:text-destructive"
                                          >
                                            <Trash2 className="h-4 w-4 mr-2" />
                                            Delete
                                          </DropdownMenuItem>
                                        </WriteGate>
                                      </PermGate>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    <TablePagination
                      currentPage={listCurrentPage}
                      totalItems={filteredEmployees.length}
                      pageSize={LIST_PAGE_SIZE}
                      onPageChange={setListCurrentPage}
                    />
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Grid View */}
          <TabsContent value="grid" className="mt-6">
            <Card className="border-border/60">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">Employee Directory</CardTitle>
                    <CardDescription>
                      {filteredEmployees.length} employee{filteredEmployees.length !== 1 ? 's' : ''}
                      {activeFilterCount > 0 && ` (filtered from ${employees?.length || 0})`}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex items-center justify-center py-16">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : filteredEmployees.length === 0 ? (
                  <div className="text-center py-16 text-muted-foreground">
                    <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                      <LayoutGrid className="h-6 w-6" />
                    </div>
                    <p className="font-medium">No employees found</p>
                    <p className="text-sm mt-1">
                      {search || activeFilterCount > 0 
                        ? 'Try adjusting your search or filters.' 
                        : 'Add your first employee to get started.'}
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                      {gridEmployees.map((employee) => (
                        <EmployeeCard
                          key={employee.id}
                          employee={employee}
                          onView={() => handleView(employee)}
                          onEdit={can('employees', 'update') ? () => handleEdit(employee) : undefined}
                          onDelete={can('employees', 'delete') ? () => setDeletingId(employee.id) : undefined}
                        />
                      ))}
                    </div>
                    <LoadMoreButton
                      currentCount={gridDisplayCount}
                      totalCount={filteredEmployees.length}
                      onLoadMore={() => setGridDisplayCount(prev => prev + GRID_LOAD_INCREMENT)}
                    />
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Org Chart View */}
          <TabsContent value="org" className="mt-6">
            <Card className="border-border/60">
              <CardHeader className="pb-3">
                <div>
                  <CardTitle className="text-lg">Organization Chart</CardTitle>
                  <CardDescription>
                    View department hierarchy and reporting structure
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex items-center justify-center py-16">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <OrgChart 
                    employees={employees || []}
                    departments={departments || []}
                    onEmployeeClick={handleView}
                  />
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Employee Detail Dialog */}
        <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden">
            <DialogHeader>
              <DialogTitle className="text-xl">Employee Details</DialogTitle>
            </DialogHeader>
            {selectedEmployee && <EmployeeDetail employee={selectedEmployee} canEdit={isHROrAbove} />}
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation */}
        <AlertDialog open={!!deletingId} onOpenChange={() => setDeletingId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Employee</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this employee? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Terminate Confirmation */}
        <AlertDialog open={showTerminateConfirm} onOpenChange={setShowTerminateConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirm Termination</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to mark this employee as terminated? This action can be reversed later if needed.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setPendingStatusChange(null)}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={confirmTerminate} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Confirm Termination
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Bulk Import Dialog */}
        <BulkImportDialog open={isImportOpen} onOpenChange={setIsImportOpen} />
      </div>
    </ModuleGuard>
  );
}
