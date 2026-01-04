import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { useAuth } from '@/contexts/AuthContext';
import { usePermission } from '@/contexts/PermissionContext';
import { toast } from 'sonner';
import type { Tables, TablesInsert } from '@/integrations/supabase/types';

export type EmployeeDocument = Tables<'employee_documents'>;
export type DocumentType = Tables<'document_types'>;

export function useDocumentTypes() {
  const { companyId } = useTenant();

  return useQuery({
    queryKey: ['document-types', companyId],
    queryFn: async () => {
      if (!companyId) return [];

      const { data, error } = await supabase
        .from('document_types')
        .select('*')
        .eq('company_id', companyId)
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      return data;
    },
    enabled: !!companyId,
  });
}

export function useMyDocuments() {
  const { companyId, employeeId } = useTenant();

  return useQuery({
    queryKey: ['documents', 'my', companyId, employeeId],
    queryFn: async () => {
      if (!companyId || !employeeId) return [];

      const { data, error } = await supabase
        .from('employee_documents')
        .select(`
          *,
          document_type:document_types(id, name, code)
        `)
        .eq('employee_id', employeeId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!companyId && !!employeeId,
  });
}

export function useEmployeeDocuments(employeeId: string | null) {
  const { companyId } = useTenant();

  return useQuery({
    queryKey: ['documents', 'employee', employeeId],
    queryFn: async () => {
      if (!companyId || !employeeId) return [];

      const { data, error } = await supabase
        .from('employee_documents')
        .select(`
          *,
          document_type:document_types(id, name, code),
          verified_by_employee:employees!employee_documents_verified_by_fkey(id, first_name, last_name)
        `)
        .eq('employee_id', employeeId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!companyId && !!employeeId,
  });
}

export function useAllDocuments() {
  const { companyId } = useTenant();
  const { can } = usePermission();

  return useQuery({
    queryKey: ['documents', 'all', companyId],
    queryFn: async () => {
      if (!companyId) return [];

      const { data, error } = await supabase
        .from('employee_documents')
        .select(`
          *,
          employee:employees!employee_documents_employee_id_fkey(id, first_name, last_name, email),
          document_type:document_types(id, name, code),
          verified_by_employee:employees!employee_documents_verified_by_fkey(id, first_name, last_name)
        `)
        .eq('company_id', companyId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!companyId && can('documents', 'read'),
  });
}

// Hook for managers to view documents of their direct reports
export function useTeamDocuments() {
  const { companyId } = useTenant();
  const { user } = useAuth();
  const userId = user?.user_id;

  return useQuery({
    queryKey: ['documents', 'team', companyId, userId],
    queryFn: async () => {
      if (!companyId || !userId) return [];

      // Get current employee (manager)
      const { data: currentEmployee } = await supabase
        .from('employees')
        .select('id')
        .eq('company_id', companyId)
        .eq('user_id', userId)
        .single();

      if (!currentEmployee) return [];

      // Get direct reports
      const { data: directReports } = await supabase
        .from('employees')
        .select('id')
        .eq('company_id', companyId)
        .eq('manager_id', currentEmployee.id)
        .neq('employment_status', 'terminated');

      const employeeIds = directReports?.map(e => e.id) || [];
      if (employeeIds.length === 0) return [];

      // Get documents for team members
      const { data, error } = await supabase
        .from('employee_documents')
        .select(`
          *,
          employee:employees!employee_documents_employee_id_fkey(id, first_name, last_name, email),
          document_type:document_types(id, name, code)
        `)
        .in('employee_id', employeeIds)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!companyId && !!userId,
  });
}

// Hook for document limits check
export function useDocumentLimits(employeeId: string | null) {
  const { companyId } = useTenant();

  return useQuery({
    queryKey: ['document-limits', companyId, employeeId],
    queryFn: async () => {
      if (!companyId || !employeeId) return null;

      const { data, error } = await supabase.rpc('check_document_limits', {
        _company_id: companyId,
        _employee_id: employeeId,
      });

      if (error) throw error;
      return data as {
        max_storage_mb: number;
        max_per_employee: number;
        current_storage_bytes: number;
        current_count: number;
        can_upload: boolean;
      };
    },
    enabled: !!companyId && !!employeeId,
  });
}

// Hook to initiate secure document upload via edge function
export function useInitiateUpload() {
  const queryClient = useQueryClient();
  const { companyId } = useTenant();

  return useMutation({
    mutationFn: async (params: {
      employeeId: string;
      documentTypeId: string;
      fileName: string;
      fileSize: number;
      mimeType: string;
      title: string;
      description?: string;
      issueDate?: string;
      expiryDate?: string;
      parentDocumentId?: string;
    }) => {
      if (!companyId) throw new Error('No company selected');

      const { data, error } = await supabase.functions.invoke('document-upload', {
        body: {
          companyId,
          employeeId: params.employeeId,
          documentTypeId: params.documentTypeId,
          fileName: params.fileName,
          fileSize: params.fileSize,
          mimeType: params.mimeType,
          title: params.title,
          description: params.description,
          issueDate: params.issueDate,
          expiryDate: params.expiryDate,
          parentDocumentId: params.parentDocumentId,
        },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      return data as {
        uploadUrl: string;
        uploadToken: string;
        storagePath: string;
        documentId: string;
      };
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to initiate upload');
    },
  });
}

// Hook to confirm upload completion
export function useConfirmUpload() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (documentId: string) => {
      const { error } = await supabase
        .from('employee_documents')
        .update({ verification_status: 'pending' })
        .eq('id', documentId);

      if (error) throw error;
      return documentId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      toast.success('Document uploaded successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to confirm upload');
    },
  });
}

// Legacy create document - keep for backward compatibility
export function useCreateDocument() {
  const queryClient = useQueryClient();
  const { companyId } = useTenant();

  return useMutation({
    mutationFn: async (document: Omit<TablesInsert<'employee_documents'>, 'company_id'>) => {
      if (!companyId) throw new Error('No company selected');

      const { data, error } = await supabase
        .from('employee_documents')
        .insert({ 
          ...document, 
          company_id: companyId,
          verification_status: 'pending',
          version_number: 1,
          is_latest_version: true,
        })
        .select()
        .single();

      if (error) throw error;

      await supabase.from('audit_logs').insert({
        company_id: companyId,
        user_id: (await supabase.auth.getUser()).data.user?.id,
        table_name: 'employee_documents',
        action: 'create',
        record_id: data.id,
        new_values: { title: document.title, employee_id: document.employee_id },
      });

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      toast.success('Document uploaded successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to upload document');
    },
  });
}

// Hook for document access (view/download) via edge function
export function useDocumentAccess() {
  return useMutation({
    mutationFn: async ({
      documentId,
      accessType,
      responseMode,
    }: {
      documentId: string;
      accessType: 'view' | 'download';
      responseMode?: 'signedUrl' | 'base64';
    }) => {
      const { data, error } = await supabase.functions.invoke('document-access', {
        body: { documentId, accessType, responseMode },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      return data as
        | { signedUrl: string; expiresIn: number }
        | { fileBase64: string; mimeType: string; fileName: string };
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to access document');
    },
  });
}

// Hook for document verification using RPC
export function useVerifyDocument() {
  const queryClient = useQueryClient();
  const { employeeId } = useTenant();

  return useMutation({
    mutationFn: async ({ 
      id, 
      status, 
      rejectionReason 
    }: { 
      id: string; 
      status: 'verified' | 'rejected'; 
      rejectionReason?: string;
    }) => {
      if (!employeeId) throw new Error('No employee context');

      const { data, error } = await supabase.rpc('verify_document', {
        _document_id: id,
        _status: status,
        _verifier_employee_id: employeeId,
        _rejection_reason: rejectionReason || null,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      toast.success(variables.status === 'verified' ? 'Document verified' : 'Document rejected');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to verify document');
    },
  });
}

// Hook for document deletion via edge function
export function useDeleteDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.functions.invoke('document-delete', {
        body: { documentId: id },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      toast.success('Document deleted');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete document');
    },
  });
}

// Hook to get document version history
export function useDocumentVersions(parentDocumentId: string | null) {
  const { companyId } = useTenant();

  return useQuery({
    queryKey: ['document-versions', parentDocumentId],
    queryFn: async () => {
      if (!companyId || !parentDocumentId) return [];

      const { data, error } = await supabase
        .from('employee_documents')
        .select(`
          *,
          document_type:document_types(id, name, code)
        `)
        .or(`id.eq.${parentDocumentId},parent_document_id.eq.${parentDocumentId}`)
        .is('deleted_at', null)
        .order('version_number', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!companyId && !!parentDocumentId,
  });
}
