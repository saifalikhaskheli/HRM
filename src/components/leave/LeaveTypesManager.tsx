import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Loader2, Plus, Pencil, Trash2, Download, Upload } from 'lucide-react';
import { useAllLeaveTypes, useCreateLeaveType, useUpdateLeaveType, useDeleteLeaveType } from '@/hooks/useLeave';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { LeavePolicyImportDialog } from './LeavePolicyImportDialog';
import { exportLeavePolicies } from '@/lib/leave-policy-utils';
import { useTenant } from '@/contexts/TenantContext';
import { useCompany } from '@/hooks/useCompany';

const leaveTypeSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  code: z.string().min(1, 'Code is required').max(10, 'Code must be 10 characters or less'),
  description: z.string().optional(),
  color: z.string().optional(),
  default_days: z.coerce.number().min(0).default(0),
  is_paid: z.boolean().default(true),
  requires_approval: z.boolean().default(true),
  max_consecutive_days: z.coerce.number().min(0).optional(),
  min_notice_days: z.coerce.number().min(0).optional(),
});

type LeaveTypeFormValues = z.infer<typeof leaveTypeSchema>;

interface LeaveTypesManagerProps {
  className?: string;
}

export function LeaveTypesManager({ className }: LeaveTypesManagerProps) {
  const { data: leaveTypes, isLoading } = useAllLeaveTypes();
  const createLeaveType = useCreateLeaveType();
  const updateLeaveType = useUpdateLeaveType();
  const deleteLeaveType = useDeleteLeaveType();
  const { companyId } = useTenant();
  const { data: company } = useCompany(companyId);
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [editingType, setEditingType] = useState<any>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const handleExport = () => {
    if (!leaveTypes || leaveTypes.length === 0) return;
    exportLeavePolicies(leaveTypes, company?.name);
  };

  const existingCodes = leaveTypes?.map(lt => lt.code) || [];

  const form = useForm<LeaveTypeFormValues>({
    resolver: zodResolver(leaveTypeSchema),
    defaultValues: {
      name: '',
      code: '',
      description: '',
      color: '#3b82f6',
      default_days: 0,
      is_paid: true,
      requires_approval: true,
      max_consecutive_days: undefined,
      min_notice_days: undefined,
    },
  });

  const openCreateDialog = () => {
    setEditingType(null);
    form.reset({
      name: '',
      code: '',
      description: '',
      color: '#3b82f6',
      default_days: 0,
      is_paid: true,
      requires_approval: true,
      max_consecutive_days: undefined,
      min_notice_days: undefined,
    });
    setIsDialogOpen(true);
  };

  const openEditDialog = (leaveType: any) => {
    setEditingType(leaveType);
    form.reset({
      name: leaveType.name,
      code: leaveType.code,
      description: leaveType.description || '',
      color: leaveType.color || '#3b82f6',
      default_days: leaveType.default_days || 0,
      is_paid: leaveType.is_paid ?? true,
      requires_approval: leaveType.requires_approval ?? true,
      max_consecutive_days: leaveType.max_consecutive_days || undefined,
      min_notice_days: leaveType.min_notice_days || undefined,
    });
    setIsDialogOpen(true);
  };

  const onSubmit = async (values: LeaveTypeFormValues) => {
    if (editingType) {
      await updateLeaveType.mutateAsync({ 
        id: editingType.id, 
        name: values.name,
        description: values.description,
        color: values.color,
        default_days: values.default_days,
        is_paid: values.is_paid,
        requires_approval: values.requires_approval,
        max_consecutive_days: values.max_consecutive_days,
        min_notice_days: values.min_notice_days,
      });
    } else {
      await createLeaveType.mutateAsync({
        name: values.name,
        code: values.code,
        description: values.description,
        color: values.color,
        default_days: values.default_days,
        is_paid: values.is_paid,
        requires_approval: values.requires_approval,
        max_consecutive_days: values.max_consecutive_days,
        min_notice_days: values.min_notice_days,
      });
    }
    setIsDialogOpen(false);
    setEditingType(null);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await deleteLeaveType.mutateAsync(deleteId);
    setDeleteId(null);
  };

  const isSubmitting = createLeaveType.isPending || updateLeaveType.isPending;

  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Leave Types</CardTitle>
          <CardDescription>Configure leave categories available to employees</CardDescription>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setIsImportDialogOpen(true)}
          >
            <Upload className="h-4 w-4 mr-2" />
            Import
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={handleExport}
            disabled={!leaveTypes || leaveTypes.length === 0}
          >
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={openCreateDialog}>
                <Plus className="h-4 w-4 mr-2" />
                Add Leave Type
              </Button>
            </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingType ? 'Edit Leave Type' : 'Create Leave Type'}</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Name *</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="e.g., Annual Leave" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="code"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Code *</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="e.g., AL" maxLength={10} disabled={!!editingType} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Optional description" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="color"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Color</FormLabel>
                        <FormControl>
                          <div className="flex gap-2">
                            <Input type="color" {...field} className="w-12 h-10 p-1" />
                            <Input {...field} placeholder="#3b82f6" className="flex-1" />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="default_days"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Default Annual Allocation</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} min={0} />
                        </FormControl>
                        <FormDescription>Days per year</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="max_consecutive_days"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Max Consecutive Days</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} min={0} placeholder="No limit" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="min_notice_days"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Notice Days Required</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} min={0} placeholder="0" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="flex gap-8">
                  <FormField
                    control={form.control}
                    name="is_paid"
                    render={({ field }) => (
                      <FormItem className="flex items-center gap-2">
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                        <FormLabel className="!mt-0">Paid Leave</FormLabel>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="requires_approval"
                    render={({ field }) => (
                      <FormItem className="flex items-center gap-2">
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                        <FormLabel className="!mt-0">Requires Approval</FormLabel>
                      </FormItem>
                    )}
                  />
                </div>

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    {editingType ? 'Save Changes' : 'Create'}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : !leaveTypes?.length ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>No leave types configured yet.</p>
            <p className="text-sm mt-1">Create your first leave type to get started.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Default Days</TableHead>
                <TableHead>Paid</TableHead>
                <TableHead>Approval</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[100px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leaveTypes.map((type) => (
                <TableRow key={type.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: type.color || '#3b82f6' }}
                      />
                      <span className="font-medium">{type.name}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{type.code}</code>
                  </TableCell>
                  <TableCell>{type.default_days || 0} days</TableCell>
                  <TableCell>
                    <Badge variant={type.is_paid ? 'default' : 'secondary'}>
                      {type.is_paid ? 'Paid' : 'Unpaid'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={type.requires_approval ? 'outline' : 'secondary'}>
                      {type.requires_approval ? 'Required' : 'Auto'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={type.is_active ? 'default' : 'secondary'}>
                      {type.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditDialog(type)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      {type.is_active && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteId(type.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="Remove Leave Type"
        description="This will deactivate the leave type. Existing leave requests will not be affected."
        confirmLabel="Remove"
        onConfirm={handleDelete}
        isLoading={deleteLeaveType.isPending}
        variant="destructive"
      />

      <LeavePolicyImportDialog
        open={isImportDialogOpen}
        onOpenChange={setIsImportDialogOpen}
        existingCodes={existingCodes}
      />
    </Card>
  );
}
