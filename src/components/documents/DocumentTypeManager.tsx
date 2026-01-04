import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Pencil, Trash2, Loader2 } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { useDocumentTypes, DocumentType } from '@/hooks/useDocuments';
import { toast } from 'sonner';

const ALLOWED_MIME_TYPES = [
  { value: 'application/pdf', label: 'PDF' },
  { value: 'image/jpeg', label: 'JPEG' },
  { value: 'image/png', label: 'PNG' },
  { value: 'image/gif', label: 'GIF' },
  { value: 'application/msword', label: 'DOC' },
  { value: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', label: 'DOCX' },
  { value: 'application/vnd.ms-excel', label: 'XLS' },
  { value: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', label: 'XLSX' },
];

const formSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  code: z.string().min(1, 'Code is required').max(20).regex(/^[A-Z0-9_]+$/, 'Code must be uppercase letters, numbers, and underscores'),
  description: z.string().max(500).optional(),
  has_expiry: z.boolean(),
  is_required: z.boolean(),
  reminder_days: z.number().min(0).max(365).optional(),
  allowed_for_employee_upload: z.boolean(),
  allowed_mime_types: z.array(z.string()).optional(),
  max_file_size_mb: z.number().min(1).max(100).optional(),
});

type FormValues = z.infer<typeof formSchema>;

export function DocumentTypeManager() {
  const { companyId } = useTenant();
  const { data: documentTypes = [], isLoading } = useDocumentTypes();
  const queryClient = useQueryClient();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingType, setEditingType] = useState<DocumentType | null>(null);
  const [deletingType, setDeletingType] = useState<DocumentType | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      code: '',
      description: '',
      has_expiry: false,
      is_required: false,
      reminder_days: undefined,
      allowed_for_employee_upload: true,
      allowed_mime_types: [],
      max_file_size_mb: 10,
    },
  });

  const createMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const { data, error } = await supabase
        .from('document_types')
        .insert({
          name: values.name,
          code: values.code,
          description: values.description || null,
          has_expiry: values.has_expiry,
          is_required: values.is_required,
          company_id: companyId!,
          reminder_days: values.has_expiry ? values.reminder_days : null,
          allowed_for_employee_upload: values.allowed_for_employee_upload,
          allowed_mime_types: values.allowed_mime_types?.length ? values.allowed_mime_types : null,
          max_file_size_mb: values.max_file_size_mb || null,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['document-types'] });
      toast.success('Document type created');
      handleCloseDialog();
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create document type');
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, values }: { id: string; values: FormValues }) => {
      const { data, error } = await supabase
        .from('document_types')
        .update({
          name: values.name,
          code: values.code,
          description: values.description || null,
          has_expiry: values.has_expiry,
          is_required: values.is_required,
          reminder_days: values.has_expiry ? values.reminder_days : null,
          allowed_for_employee_upload: values.allowed_for_employee_upload,
          allowed_mime_types: values.allowed_mime_types?.length ? values.allowed_mime_types : null,
          max_file_size_mb: values.max_file_size_mb || null,
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['document-types'] });
      toast.success('Document type updated');
      handleCloseDialog();
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update document type');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('document_types')
        .update({ is_active: false })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['document-types'] });
      toast.success('Document type deleted');
      setDeleteDialogOpen(false);
      setDeletingType(null);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete document type');
    },
  });

  const handleOpenDialog = (type?: DocumentType) => {
    if (type) {
      setEditingType(type);
      form.reset({
        name: type.name,
        code: type.code,
        description: type.description || '',
        has_expiry: type.has_expiry || false,
        is_required: type.is_required || false,
        reminder_days: type.reminder_days || undefined,
        allowed_for_employee_upload: type.allowed_for_employee_upload ?? true,
        allowed_mime_types: (type.allowed_mime_types as string[]) || [],
        max_file_size_mb: type.max_file_size_mb || 10,
      });
    } else {
      setEditingType(null);
      form.reset();
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingType(null);
    form.reset();
  };

  const onSubmit = (values: FormValues) => {
    if (editingType) {
      updateMutation.mutate({ id: editingType.id, values });
    } else {
      createMutation.mutate(values);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Document Types</CardTitle>
            <CardDescription>Configure document categories for your organization</CardDescription>
          </div>
          <Button onClick={() => handleOpenDialog()}>
            <Plus className="h-4 w-4 mr-2" />
            Add Type
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : documentTypes.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No document types configured yet.
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Settings</TableHead>
                    <TableHead className="w-[100px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {documentTypes.map((type) => (
                    <TableRow key={type.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{type.name}</p>
                          {type.description && (
                            <p className="text-xs text-muted-foreground">{type.description}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <code className="text-xs bg-muted px-2 py-1 rounded">{type.code}</code>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {type.is_required && <Badge variant="secondary">Required</Badge>}
                          {type.has_expiry && (
                            <Badge variant="outline">
                              Expires {type.reminder_days ? `(${type.reminder_days}d)` : ''}
                            </Badge>
                          )}
                          {type.allowed_for_employee_upload === false && (
                            <Badge variant="destructive">HR Only</Badge>
                          )}
                          {type.max_file_size_mb && (
                            <Badge variant="outline">{type.max_file_size_mb}MB max</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenDialog(type)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setDeletingType(type);
                              setDeleteDialogOpen(true);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingType ? 'Edit Document Type' : 'New Document Type'}</DialogTitle>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Employment Contract" {...field} />
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
                    <FormLabel>Code</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="e.g., EMPLOYMENT_CONTRACT" 
                        {...field} 
                        onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                      />
                    </FormControl>
                    <FormDescription>Unique identifier (uppercase, no spaces)</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Optional description..."
                        className="resize-none"
                        rows={2}
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex items-center justify-between">
                <FormField
                  control={form.control}
                  name="is_required"
                  render={({ field }) => (
                    <FormItem className="flex items-center gap-2">
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                      <FormLabel className="!mt-0">Required for all employees</FormLabel>
                    </FormItem>
                  )}
                />
              </div>

              <div className="space-y-3">
                <FormField
                  control={form.control}
                  name="has_expiry"
                  render={({ field }) => (
                    <FormItem className="flex items-center gap-2">
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                      <FormLabel className="!mt-0">Document has expiry date</FormLabel>
                    </FormItem>
                  )}
                />

                {form.watch('has_expiry') && (
                  <FormField
                    control={form.control}
                    name="reminder_days"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Reminder Days Before Expiry</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            placeholder="30"
                            {...field}
                            onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </div>

              <div className="space-y-3 pt-2 border-t">
                <h4 className="text-sm font-medium">Upload Permissions</h4>
                
                <FormField
                  control={form.control}
                  name="allowed_for_employee_upload"
                  render={({ field }) => (
                    <FormItem className="flex items-center gap-2">
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                      <FormLabel className="!mt-0">Allow employee self-upload</FormLabel>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="max_file_size_mb"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Max File Size (MB)</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          placeholder="10"
                          min={1}
                          max={100}
                          {...field}
                          onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="allowed_mime_types"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Allowed File Types</FormLabel>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {ALLOWED_MIME_TYPES.map((mimeType) => (
                          <label
                            key={mimeType.value}
                            className={`px-3 py-1.5 rounded-md border cursor-pointer text-sm transition-colors ${
                              field.value?.includes(mimeType.value)
                                ? 'bg-primary text-primary-foreground border-primary'
                                : 'bg-background hover:bg-muted'
                            }`}
                          >
                            <input
                              type="checkbox"
                              className="sr-only"
                              checked={field.value?.includes(mimeType.value)}
                              onChange={(e) => {
                                const current = field.value || [];
                                if (e.target.checked) {
                                  field.onChange([...current, mimeType.value]);
                                } else {
                                  field.onChange(current.filter(v => v !== mimeType.value));
                                }
                              }}
                            />
                            {mimeType.label}
                          </label>
                        ))}
                      </div>
                      <FormDescription>Leave empty to allow all types</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={handleCloseDialog}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isPending}>
                  {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {editingType ? 'Update' : 'Create'}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Document Type</AlertDialogTitle>
            <AlertDialogDescription>
              This will deactivate the document type "{deletingType?.name}". Existing documents will not be affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingType && deleteMutation.mutate(deletingType.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
