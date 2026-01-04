import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Clock, Plus, Pencil, Trash2, Users } from 'lucide-react';
import { PageHeader, PageContainer } from '@/components/layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2 } from 'lucide-react';
import { useShifts, useCreateShift, useUpdateShift, useDeleteShift } from '@/hooks/useShifts';
import { RoleGate, PermissionGate } from '@/components/PermissionGate';
import { ALL_DAYS, DAY_FULL_LABELS, type Shift, type DayOfWeek } from '@/types/shifts';
import { format } from 'date-fns';
import { ShiftAssignmentsTab } from '@/components/shift/ShiftAssignmentsTab';
import { useTenant } from '@/contexts/TenantContext';
import { usePermission } from '@/contexts/PermissionContext';

const shiftSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  start_time: z.string().min(1, 'Start time is required'),
  end_time: z.string().min(1, 'End time is required'),
  break_duration_minutes: z.coerce.number().min(0).default(0),
  grace_period_minutes: z.coerce.number().min(0).default(15),
  min_hours_full_day: z.coerce.number().min(0).default(8),
  min_hours_half_day: z.coerce.number().min(0).default(4),
  overtime_after_minutes: z.coerce.number().nullable().optional(),
  applicable_days: z.array(z.string()).min(1, 'Select at least one day'),
  is_default: z.boolean().default(false),
  is_active: z.boolean().default(true),
});

type ShiftFormValues = z.infer<typeof shiftSchema>;

function formatTime(time: string): string {
  const [hours, minutes] = time.split(':');
  const h = parseInt(hours, 10);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${minutes} ${ampm}`;
}

function ShiftFormDialog({
  open,
  onOpenChange,
  shift,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shift?: Shift | null;
}) {
  const createShift = useCreateShift();
  const updateShift = useUpdateShift();
  const isEditing = !!shift;

  const form = useForm<ShiftFormValues>({
    resolver: zodResolver(shiftSchema),
    defaultValues: {
      name: shift?.name || '',
      start_time: shift?.start_time?.substring(0, 5) || '09:00',
      end_time: shift?.end_time?.substring(0, 5) || '18:00',
      break_duration_minutes: shift?.break_duration_minutes || 60,
      grace_period_minutes: shift?.grace_period_minutes || 15,
      min_hours_full_day: shift?.min_hours_full_day || 8,
      min_hours_half_day: shift?.min_hours_half_day || 4,
      overtime_after_minutes: shift?.overtime_after_minutes || null,
      applicable_days: (shift?.applicable_days as string[]) || ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
      is_default: shift?.is_default || false,
      is_active: shift?.is_active ?? true,
    },
  });

  const onSubmit = async (values: ShiftFormValues) => {
    try {
      if (isEditing && shift) {
        await updateShift.mutateAsync({
          id: shift.id,
          name: values.name,
          applicable_days: values.applicable_days as DayOfWeek[],
          start_time: values.start_time + ':00',
          end_time: values.end_time + ':00',
          break_duration_minutes: values.break_duration_minutes,
          grace_period_minutes: values.grace_period_minutes,
          min_hours_full_day: values.min_hours_full_day,
          min_hours_half_day: values.min_hours_half_day,
          overtime_after_minutes: values.overtime_after_minutes ?? null,
          is_default: values.is_default,
          is_active: values.is_active,
        });
      } else {
        await createShift.mutateAsync({
          name: values.name,
          applicable_days: values.applicable_days as DayOfWeek[],
          start_time: values.start_time + ':00',
          end_time: values.end_time + ':00',
          break_duration_minutes: values.break_duration_minutes,
          grace_period_minutes: values.grace_period_minutes,
          min_hours_full_day: values.min_hours_full_day,
          min_hours_half_day: values.min_hours_half_day,
          overtime_after_minutes: values.overtime_after_minutes ?? null,
          is_default: values.is_default,
          is_active: values.is_active,
        });
      }
      onOpenChange(false);
      form.reset();
    } catch (error) {
      // Handled in mutation
    }
  };

  const isLoading = createShift.isPending || updateShift.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Shift' : 'Create New Shift'}</DialogTitle>
          <DialogDescription>
            Define shift timings and attendance rules
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Shift Name *</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., General, Night, Weekend" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="start_time"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Start Time *</FormLabel>
                    <FormControl>
                      <Input type="time" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="end_time"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>End Time *</FormLabel>
                    <FormControl>
                      <Input type="time" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="break_duration_minutes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Break Duration (mins)</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="grace_period_minutes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Grace Period (mins)</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} {...field} />
                    </FormControl>
                    <FormDescription>Late tolerance</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="min_hours_full_day"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Min Hours (Full Day)</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} step={0.5} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="min_hours_half_day"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Min Hours (Half Day)</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} step={0.5} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="overtime_after_minutes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Overtime After (mins)</FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      min={0} 
                      placeholder="Leave empty if N/A"
                      value={field.value ?? ''} 
                      onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : null)}
                    />
                  </FormControl>
                  <FormDescription>Minutes after shift end to count as overtime</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="applicable_days"
              render={() => (
                <FormItem>
                  <FormLabel>Applicable Days *</FormLabel>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {ALL_DAYS.map((day) => (
                      <FormField
                        key={day}
                        control={form.control}
                        name="applicable_days"
                        render={({ field }) => (
                          <FormItem className="flex items-center space-x-2 space-y-0">
                            <FormControl>
                              <Checkbox
                                checked={field.value?.includes(day)}
                                onCheckedChange={(checked) => {
                                  const current = field.value || [];
                                  if (checked) {
                                    field.onChange([...current, day]);
                                  } else {
                                    field.onChange(current.filter((d) => d !== day));
                                  }
                                }}
                              />
                            </FormControl>
                            <FormLabel className="text-sm font-normal cursor-pointer">
                              {DAY_FULL_LABELS[day]}
                            </FormLabel>
                          </FormItem>
                        )}
                      />
                    ))}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex gap-4">
              <FormField
                control={form.control}
                name="is_default"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-2 space-y-0">
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                    <FormLabel className="font-normal">Default Shift</FormLabel>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="is_active"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-2 space-y-0">
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                    <FormLabel className="font-normal">Active</FormLabel>
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {isEditing ? 'Update' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function ShiftsTab() {
  const { data: shifts, isLoading } = useShifts();
  const deleteShift = useDeleteShift();
  const [formOpen, setFormOpen] = useState(false);
  const [editingShift, setEditingShift] = useState<Shift | null>(null);

  const handleEdit = (shift: Shift) => {
    setEditingShift(shift);
    setFormOpen(true);
  };

  const handleDelete = async (shift: Shift) => {
    if (shift.is_default) {
      return; // Cannot delete default shift
    }
    if (confirm(`Delete shift "${shift.name}"? This cannot be undone.`)) {
      await deleteShift.mutateAsync(shift.id);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Shift Templates</CardTitle>
            <CardDescription>Define reusable shift configurations</CardDescription>
          </div>
          <Button onClick={() => { setEditingShift(null); setFormOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            Add Shift
          </Button>
        </CardHeader>
        <CardContent>
          {!shifts || shifts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No shifts configured yet</p>
              <p className="text-sm">Create your first shift template to get started</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Timing</TableHead>
                  <TableHead>Break</TableHead>
                  <TableHead>Grace</TableHead>
                  <TableHead>Days</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shifts.map((shift) => (
                  <TableRow key={shift.id}>
                    <TableCell className="font-medium">
                      {shift.name}
                      {shift.is_default && (
                        <Badge variant="secondary" className="ml-2">Default</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {formatTime(shift.start_time)} - {formatTime(shift.end_time)}
                    </TableCell>
                    <TableCell>{shift.break_duration_minutes} min</TableCell>
                    <TableCell>{shift.grace_period_minutes} min</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {(shift.applicable_days as string[]).slice(0, 3).map((day) => (
                          <Badge key={day} variant="outline" className="text-xs">
                            {day.substring(0, 2).toUpperCase()}
                          </Badge>
                        ))}
                        {shift.applicable_days.length > 3 && (
                          <Badge variant="outline" className="text-xs">
                            +{shift.applicable_days.length - 3}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={shift.is_active ? 'default' : 'secondary'}>
                        {shift.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(shift)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(shift)}
                          disabled={shift.is_default}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <ShiftFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        shift={editingShift}
      />
    </>
  );
}

// Using ShiftAssignmentsTab component from src/components/shift/ShiftAssignmentsTab.tsx

export default function ShiftManagementPage() {
  const { can } = usePermission();
  const canManageShifts = can('time_tracking', 'update');
  const canViewAssignments = can('employees', 'read');

  return (
    <PermissionGate permission={{ module: 'time_tracking', action: 'read' }}>
      <PageContainer>
        <PageHeader
          title="Shift Management"
          description="Configure shift templates and manage employee assignments"
        />

        <Tabs defaultValue={canManageShifts ? 'shifts' : 'assignments'} className="space-y-6">
          <TabsList>
            {canManageShifts && (
              <TabsTrigger value="shifts" className="gap-2">
                <Clock className="h-4 w-4" />
                Shift Templates
              </TabsTrigger>
            )}
            {canViewAssignments && (
              <TabsTrigger value="assignments" className="gap-2">
                <Users className="h-4 w-4" />
                Assignments
              </TabsTrigger>
            )}
          </TabsList>

          {canManageShifts && (
            <TabsContent value="shifts">
              <ShiftsTab />
            </TabsContent>
          )}

          {canViewAssignments && (
            <TabsContent value="assignments">
              <ShiftAssignmentsTab />
            </TabsContent>
          )}
        </Tabs>
      </PageContainer>
    </PermissionGate>
  );
}
