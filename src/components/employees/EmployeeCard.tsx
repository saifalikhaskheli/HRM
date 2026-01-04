import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { MoreHorizontal, Eye, Pencil, Trash2, Mail, Phone, Loader2, Building2 } from 'lucide-react';
import { WriteGate, PermGate } from '@/components/PermissionGate';
import { usePermission } from '@/contexts/PermissionContext';
import { type Employee } from '@/hooks/useEmployees';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { StatusIndicator, getStatusBarColor, type EmployeeStatus } from './StatusIndicator';
import { cn } from '@/lib/utils';

interface EmployeeCardProps {
  employee: Employee & { department?: { name: string } | null };
  onView: (employee: Employee) => void;
  onEdit?: (employee: Employee) => void;
  onDelete?: (employeeId: string) => void;
}

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'on_leave', label: 'On Leave' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'terminated', label: 'Terminated' },
];

export function EmployeeCard({ employee, onView, onEdit, onDelete }: EmployeeCardProps) {
  const { can } = usePermission();
  const queryClient = useQueryClient();
  const [showTerminateConfirm, setShowTerminateConfirm] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<string | null>(null);
  const [isHovered, setIsHovered] = useState(false);

  const updateStatus = useMutation({
    mutationFn: async (newStatus: string) => {
      const { error } = await supabase
        .from('employees')
        .update({ employment_status: newStatus as EmployeeStatus })
        .eq('id', employee.id);
      
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

  const handleStatusChange = (newStatus: string) => {
    if (newStatus === 'terminated') {
      setPendingStatus(newStatus);
      setShowTerminateConfirm(true);
    } else {
      updateStatus.mutate(newStatus);
    }
  };

  const confirmTerminate = () => {
    if (pendingStatus) {
      updateStatus.mutate(pendingStatus);
    }
    setShowTerminateConfirm(false);
    setPendingStatus(null);
  };

  const statusBarColor = getStatusBarColor(employee.employment_status as EmployeeStatus);

  return (
    <>
      <Card 
        className={cn(
          "group relative overflow-hidden transition-all duration-200 cursor-pointer",
          "hover:shadow-lg hover:-translate-y-0.5 border-border/60",
          isHovered && "ring-1 ring-primary/20"
        )}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={() => onView(employee)}
      >
        {/* Status accent bar */}
        <div className={cn("h-1 w-full", statusBarColor)} />
        
        <CardContent className="p-5">
          {/* Header with Avatar and Actions */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex flex-col items-center text-center flex-1">
              <Avatar className="h-16 w-16 mb-3 ring-2 ring-background shadow-md">
                <AvatarFallback className="bg-gradient-to-br from-primary/80 to-primary text-primary-foreground text-lg font-semibold">
                  {employee.first_name[0]}{employee.last_name[0]}
                </AvatarFallback>
              </Avatar>
              <h3 className="font-semibold text-foreground text-base leading-tight">
                {employee.first_name} {employee.last_name}
              </h3>
              <p className="text-sm text-muted-foreground mt-0.5">
                {employee.job_title || 'No title assigned'}
              </p>
              <Badge variant="secondary" className="mt-2 text-xs font-normal">
                {employee.employee_number}
              </Badge>
            </div>
            
            {/* Actions Menu */}
            {can('employees', 'read') && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className={cn(
                      "h-8 w-8 absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity",
                      "bg-background/80 hover:bg-background shadow-sm"
                    )}
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-40">
                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onView(employee); }}>
                    <Eye className="h-4 w-4 mr-2" />
                    View Details
                  </DropdownMenuItem>
                  {onEdit && (
                    <PermGate module="employees" action="update">
                      <WriteGate>
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(employee); }}>
                          <Pencil className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                      </WriteGate>
                    </PermGate>
                  )}
                  {onDelete && (
                    <PermGate module="employees" action="delete">
                      <WriteGate>
                        <DropdownMenuItem 
                          onClick={(e) => { e.stopPropagation(); onDelete(employee.id); }}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </WriteGate>
                    </PermGate>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>

          {/* Divider */}
          <div className="border-t border-border/50 my-4" />

          {/* Info Section */}
          <div className="space-y-2.5">
            <div className="flex items-center gap-2.5 text-sm">
              <div className="flex items-center justify-center h-7 w-7 rounded-md bg-muted text-muted-foreground">
                <Building2 className="h-3.5 w-3.5" />
              </div>
              <span className="text-foreground truncate">
                {(employee as any).department?.name || 'No Department'}
              </span>
            </div>
            <div className="flex items-center gap-2.5 text-sm">
              <div className="flex items-center justify-center h-7 w-7 rounded-md bg-muted text-muted-foreground">
                <Mail className="h-3.5 w-3.5" />
              </div>
              <span className="text-muted-foreground truncate">{employee.email}</span>
            </div>
            {employee.phone && (
              <div className="flex items-center gap-2.5 text-sm">
                <div className="flex items-center justify-center h-7 w-7 rounded-md bg-muted text-muted-foreground">
                  <Phone className="h-3.5 w-3.5" />
                </div>
                <span className="text-muted-foreground">{employee.phone}</span>
              </div>
            )}
          </div>

          {/* Footer with Status */}
          <div className="flex items-center justify-between gap-3 mt-4 pt-4 border-t border-border/50">
            <Badge variant="outline" className="text-xs font-normal capitalize">
              {employee.employment_type.replace('_', ' ')}
            </Badge>
            
            <div onClick={(e) => e.stopPropagation()}>
              <PermGate module="employees" action="update">
                <WriteGate fallback={
                  <StatusIndicator status={employee.employment_status as EmployeeStatus} />
                }>
                  <Select 
                    value={employee.employment_status} 
                    onValueChange={handleStatusChange}
                    disabled={updateStatus.isPending}
                  >
                    <SelectTrigger className="h-7 w-[120px] text-xs border-0 bg-transparent hover:bg-muted">
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
            </div>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={showTerminateConfirm} onOpenChange={setShowTerminateConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Termination</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to mark {employee.first_name} {employee.last_name} as terminated?
              This action can be reversed later if needed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingStatus(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmTerminate} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Confirm Termination
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
