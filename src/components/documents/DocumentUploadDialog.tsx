import { useState, useCallback, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Upload, File, X, Loader2, AlertCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { usePermission } from '@/contexts/PermissionContext';
import { useDocumentTypes, useDocumentLimits, useInitiateUpload, useConfirmUpload } from '@/hooks/useDocuments';
import { useEmployees } from '@/hooks/useEmployees';
import { toast } from 'sonner';

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const ALLOWED_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

const formSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().max(1000).optional(),
  document_type_id: z.string().min(1, 'Document type is required'),
  employee_id: z.string().min(1, 'Employee is required'),
  issue_date: z.string().optional(),
  expiry_date: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preselectedEmployeeId?: string;
  parentDocumentId?: string; // For versioning/replacement
}

export function DocumentUploadDialog({ open, onOpenChange, preselectedEmployeeId, parentDocumentId }: Props) {
  const { companyId, employeeId: currentEmployeeId } = useTenant();
  const { can } = usePermission();
  const { data: documentTypes = [] } = useDocumentTypes();
  const { data: employees = [] } = useEmployees();
  const initiateUpload = useInitiateUpload();
  const confirmUpload = useConfirmUpload();
  
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  // Get document limits for selected employee
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>(preselectedEmployeeId || '');
  const { data: limits } = useDocumentLimits(selectedEmployeeId || null);

  const canCreateForOthers = can('documents', 'create');

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: '',
      description: '',
      document_type_id: '',
      employee_id: preselectedEmployeeId || '',
      issue_date: '',
      expiry_date: '',
    },
  });

  // Update selected employee when form value changes
  useEffect(() => {
    const subscription = form.watch((value, { name }) => {
      if (name === 'employee_id' && value.employee_id) {
        setSelectedEmployeeId(value.employee_id);
      }
    });
    return () => subscription.unsubscribe();
  }, [form]);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const validateFile = (file: File): boolean => {
    if (file.size > MAX_FILE_SIZE) {
      toast.error('File size must be less than 50MB');
      return false;
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error('Invalid file type. Allowed: PDF, JPEG, PNG, WEBP, DOC, DOCX');
      return false;
    }
    return true;
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      if (validateFile(droppedFile)) {
        setFile(droppedFile);
        if (!form.getValues('title')) {
          form.setValue('title', droppedFile.name.replace(/\.[^/.]+$/, ''));
        }
      }
    }
  }, [form]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (validateFile(selectedFile)) {
        setFile(selectedFile);
        if (!form.getValues('title')) {
          form.setValue('title', selectedFile.name.replace(/\.[^/.]+$/, ''));
        }
      }
    }
  };

  const onSubmit = async (values: FormValues) => {
    if (!file || !companyId) {
      toast.error('Please select a file to upload');
      return;
    }

    // Check limits before upload
    if (limits && !limits.can_upload) {
      toast.error('Document upload limit reached for this employee');
      return;
    }

    setUploading(true);

    try {
      // Step 1: Initiate upload via edge function (validates permissions, limits, etc.)
      const uploadInfo = await initiateUpload.mutateAsync({
        employeeId: values.employee_id,
        documentTypeId: values.document_type_id,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
        title: values.title,
        description: values.description,
        issueDate: values.issue_date,
        expiryDate: values.expiry_date,
        parentDocumentId,
      });

      // Step 2: Upload file using Supabase Storage signed URL
      const { error: uploadError } = await supabase.storage
        .from('employee-documents')
        .uploadToSignedUrl(uploadInfo.storagePath, uploadInfo.uploadToken, file, {
          contentType: file.type,
        });

      if (uploadError) {
        console.error('Storage upload error:', uploadError);
        throw new Error('Failed to upload file to storage');
      }

      // Step 3: Confirm upload completion
      await confirmUpload.mutateAsync(uploadInfo.documentId);

      form.reset();
      setFile(null);
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message || 'Failed to upload document');
    } finally {
      setUploading(false);
    }
  };

  // Filter employees based on permission
  const availableEmployees = canCreateForOthers 
    ? employees 
    : employees.filter(e => e.id === currentEmployeeId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {parentDocumentId ? 'Upload New Version' : 'Upload Document'}
          </DialogTitle>
        </DialogHeader>

        {/* Limits Warning */}
        {limits && !limits.can_upload && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Document upload limit reached. 
              {limits.max_per_employee > 0 && ` Max ${limits.max_per_employee} documents per employee.`}
              {limits.max_storage_mb > 0 && ` Max ${limits.max_storage_mb}MB storage.`}
            </AlertDescription>
          </Alert>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* File Drop Zone */}
            <div
              className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                dragActive
                  ? 'border-primary bg-primary/5'
                  : 'border-muted-foreground/25 hover:border-muted-foreground/50'
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              {file ? (
                <div className="flex items-center justify-center gap-3">
                  <File className="h-8 w-8 text-primary" />
                  <div className="text-left">
                    <p className="font-medium text-sm">{file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setFile(null)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <label className="cursor-pointer">
                  <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    Drag & drop or{' '}
                    <span className="text-primary font-medium">browse</span>
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    PDF, JPEG, PNG, DOC up to 50MB
                  </p>
                  <input
                    type="file"
                    className="hidden"
                    accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx"
                    onChange={handleFileChange}
                  />
                </label>
              )}
            </div>

            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Document Title</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Employment Contract" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="document_type_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Document Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {documentTypes.map((type) => (
                          <SelectItem key={type.id} value={type.id}>
                            {type.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="employee_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Employee</FormLabel>
                    <Select 
                      onValueChange={field.onChange} 
                      value={field.value}
                      disabled={!!preselectedEmployeeId || availableEmployees.length === 1}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select employee" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {availableEmployees.map((emp) => (
                          <SelectItem key={emp.id} value={emp.id}>
                            {emp.first_name} {emp.last_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="issue_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Issue Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="expiry_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Expiry Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
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
                  <FormLabel>Description (Optional)</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Add notes about this document..."
                      className="resize-none"
                      rows={2}
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={uploading || !file || (limits && !limits.can_upload)}
              >
                {uploading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {parentDocumentId ? 'Upload New Version' : 'Upload Document'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
