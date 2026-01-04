import { useState } from 'react';
import { format, isFuture, isPast } from 'date-fns';
import { Users, Calendar, Trash2, Clock, Plus, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useAllShiftAssignments, useDeleteShiftAssignment, useEndShiftAssignment, useActiveShifts, useAssignShift } from '@/hooks/useShifts';
import { useEmployees } from '@/hooks/useEmployees';
import type { ShiftAssignmentWithEmployee } from '@/types/shifts';

function getAssignmentStatus(assignment: ShiftAssignmentWithEmployee) {
  const today = new Date();
  const from = new Date(assignment.effective_from);
  const to = assignment.effective_to ? new Date(assignment.effective_to) : null;
  
  if (to && isPast(to)) return 'ended';
  if (isFuture(from)) return 'upcoming';
  if (!to || isFuture(to)) return 'active';
  return 'ended';
}

function getStatusBadge(status: string, isTemporary: boolean) {
  const tempLabel = isTemporary ? ' (Temp)' : '';
  switch (status) {
    case 'active':
      return <Badge className="bg-green-600">Active{tempLabel}</Badge>;
    case 'upcoming':
      return <Badge variant="secondary">Upcoming{tempLabel}</Badge>;
    case 'ended':
      return <Badge variant="outline">Ended{tempLabel}</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function BulkAssignDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { data: shifts } = useActiveShifts();
  const { data: employees } = useEmployees();
  const assignShift = useAssignShift();
  
  const [shiftId, setShiftId] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [effectiveFrom, setEffectiveFrom] = useState(new Date().toISOString().split('T')[0]);
  const [effectiveTo, setEffectiveTo] = useState('');
  const [isTemporary, setIsTemporary] = useState(false);
  const [reason, setReason] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shiftId || !employeeId) return;

    try {
      await assignShift.mutateAsync({
        employee_id: employeeId,
        shift_id: shiftId,
        effective_from: effectiveFrom,
        effective_to: effectiveTo || null,
        is_temporary: isTemporary,
        reason: reason || null,
      });
      onOpenChange(false);
      resetForm();
    } catch (error) {
      // Error handled in mutation
    }
  };

  const resetForm = () => {
    setShiftId('');
    setEmployeeId('');
    setEffectiveFrom(new Date().toISOString().split('T')[0]);
    setEffectiveTo('');
    setIsTemporary(false);
    setReason('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Assign Shift</DialogTitle>
          <DialogDescription>Assign a shift to an employee</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Employee *</Label>
            <Select value={employeeId} onValueChange={setEmployeeId}>
              <SelectTrigger>
                <SelectValue placeholder="Select employee" />
              </SelectTrigger>
              <SelectContent>
                {employees?.map((emp) => (
                  <SelectItem key={emp.id} value={emp.id}>
                    {emp.first_name} {emp.last_name} ({emp.employee_number})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Shift *</Label>
            <Select value={shiftId} onValueChange={setShiftId}>
              <SelectTrigger>
                <SelectValue placeholder="Select shift" />
              </SelectTrigger>
              <SelectContent>
                {shifts?.map((shift) => (
                  <SelectItem key={shift.id} value={shift.id}>
                    {shift.name} ({shift.start_time.substring(0, 5)} - {shift.end_time.substring(0, 5)})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Effective From *</Label>
              <Input
                type="date"
                value={effectiveFrom}
                onChange={(e) => setEffectiveFrom(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Effective To</Label>
              <Input
                type="date"
                value={effectiveTo}
                onChange={(e) => setEffectiveTo(e.target.value)}
                min={effectiveFrom}
              />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label>Temporary Assignment</Label>
              <p className="text-xs text-muted-foreground">Mark if this is a temporary change</p>
            </div>
            <Switch checked={isTemporary} onCheckedChange={setIsTemporary} />
          </div>

          <div className="space-y-2">
            <Label>Reason (Optional)</Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g., Project requirement..."
              rows={2}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!shiftId || !employeeId || assignShift.isPending}>
              {assignShift.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Assign Shift
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ShiftAssignmentsTab() {
  const { data: assignments, isLoading } = useAllShiftAssignments();
  const deleteAssignment = useDeleteShiftAssignment();
  const endAssignment = useEndShiftAssignment();
  
  const [tab, setTab] = useState<'current' | 'upcoming' | 'history'>('current');
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState<ShiftAssignmentWithEmployee | null>(null);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const currentAssignments = assignments?.filter(a => getAssignmentStatus(a) === 'active') || [];
  const upcomingAssignments = assignments?.filter(a => getAssignmentStatus(a) === 'upcoming') || [];
  const historyAssignments = assignments?.filter(a => getAssignmentStatus(a) === 'ended') || [];

  const handleEndAssignment = (assignment: ShiftAssignmentWithEmployee) => {
    const today = new Date().toISOString().split('T')[0];
    endAssignment.mutate({ assignmentId: assignment.id, endDate: today });
  };

  const handleDelete = (assignment: ShiftAssignmentWithEmployee) => {
    setSelectedAssignment(assignment);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (selectedAssignment) {
      deleteAssignment.mutate(selectedAssignment.id);
    }
    setDeleteDialogOpen(false);
    setSelectedAssignment(null);
  };

  const renderTable = (data: ShiftAssignmentWithEmployee[], showActions: boolean) => {
    if (data.length === 0) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No shift assignments in this category</p>
        </div>
      );
    }

    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Employee</TableHead>
            <TableHead>Department</TableHead>
            <TableHead>Shift</TableHead>
            <TableHead>Timing</TableHead>
            <TableHead>Period</TableHead>
            <TableHead>Status</TableHead>
            {showActions && <TableHead className="text-right">Actions</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((assignment) => {
            const status = getAssignmentStatus(assignment);
            return (
              <TableRow key={assignment.id}>
                <TableCell className="font-medium">
                  {assignment.employee.first_name} {assignment.employee.last_name}
                  <div className="text-xs text-muted-foreground">
                    {assignment.employee.employee_number}
                  </div>
                </TableCell>
                <TableCell>
                  {assignment.employee.department?.name || '-'}
                </TableCell>
                <TableCell>{assignment.shift.name}</TableCell>
                <TableCell className="text-sm">
                  {assignment.shift.start_time.substring(0, 5)} - {assignment.shift.end_time.substring(0, 5)}
                </TableCell>
                <TableCell>
                  <div className="text-sm">
                    {format(new Date(assignment.effective_from), 'MMM d, yyyy')}
                    {' → '}
                    {assignment.effective_to
                      ? format(new Date(assignment.effective_to), 'MMM d, yyyy')
                      : 'Ongoing'}
                  </div>
                  {assignment.reason && (
                    <div className="text-xs text-muted-foreground truncate max-w-[200px]" title={assignment.reason}>
                      {assignment.reason}
                    </div>
                  )}
                </TableCell>
                <TableCell>
                  {getStatusBadge(status, assignment.is_temporary)}
                </TableCell>
                {showActions && (
                  <TableCell className="text-right">
                    <div className="flex gap-1 justify-end">
                      {status === 'active' && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleEndAssignment(assignment)}
                          disabled={endAssignment.isPending}
                          title="End assignment today"
                        >
                          <Clock className="h-4 w-4" />
                        </Button>
                      )}
                      {status === 'upcoming' && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDelete(assignment)}
                          title="Delete assignment"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                )}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    );
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Shift Assignments</CardTitle>
            <CardDescription>
              Manage employee shift assignments
            </CardDescription>
          </div>
          <Button onClick={() => setAssignDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Assign Shift
          </Button>
        </CardHeader>
        <CardContent>
          <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
            <TabsList className="mb-4">
              <TabsTrigger value="current" className="gap-2">
                Current
                {currentAssignments.length > 0 && (
                  <Badge variant="secondary">{currentAssignments.length}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="upcoming" className="gap-2">
                Upcoming
                {upcomingAssignments.length > 0 && (
                  <Badge variant="secondary">{upcomingAssignments.length}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="history" className="gap-2">
                History
              </TabsTrigger>
            </TabsList>

            <TabsContent value="current">
              {renderTable(currentAssignments, true)}
            </TabsContent>
            <TabsContent value="upcoming">
              {renderTable(upcomingAssignments, true)}
            </TabsContent>
            <TabsContent value="history">
              {renderTable(historyAssignments.slice(0, 50), false)}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <BulkAssignDialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen} />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Shift Assignment</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this upcoming shift assignment? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
