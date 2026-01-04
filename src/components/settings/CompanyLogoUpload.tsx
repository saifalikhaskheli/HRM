import { useState, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2, Upload, X, Building2 } from 'lucide-react';

interface CompanyLogoUploadProps {
  currentLogoUrl: string | null;
  companyName: string;
  disabled?: boolean;
}

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];

export function CompanyLogoUpload({ currentLogoUrl, companyName, disabled }: CompanyLogoUploadProps) {
  const { companyId } = useTenant();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      if (!companyId) throw new Error('No company selected');

      // Validate file
      if (!ALLOWED_TYPES.includes(file.type)) {
        throw new Error('Invalid file type. Please upload PNG, JPG, or WebP.');
      }
      if (file.size > MAX_FILE_SIZE) {
        throw new Error('File too large. Maximum size is 2MB.');
      }

      // Generate unique filename
      const ext = file.name.split('.').pop();
      const fileName = `${companyId}/logo-${Date.now()}.${ext}`;

      // Delete old logo if exists
      if (currentLogoUrl) {
        const oldPath = currentLogoUrl.split('/company-logos/')[1];
        if (oldPath) {
          await supabase.storage.from('company-logos').remove([oldPath]);
        }
      }

      // Upload new logo
      const { error: uploadError } = await supabase.storage
        .from('company-logos')
        .upload(fileName, file, { cacheControl: '3600', upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('company-logos')
        .getPublicUrl(fileName);

      // Update company record
      const { error: updateError } = await supabase
        .from('companies')
        .update({ logo_url: urlData.publicUrl, updated_at: new Date().toISOString() })
        .eq('id', companyId);

      if (updateError) throw updateError;

      return urlData.publicUrl;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company', companyId] });
      toast.success('Company logo updated');
      setPreviewUrl(null);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to upload logo');
      setPreviewUrl(null);
    },
  });

  const removeMutation = useMutation({
    mutationFn: async () => {
      if (!companyId || !currentLogoUrl) throw new Error('No logo to remove');

      // Extract path from URL
      const path = currentLogoUrl.split('/company-logos/')[1];
      if (path) {
        await supabase.storage.from('company-logos').remove([path]);
      }

      // Update company record
      const { error } = await supabase
        .from('companies')
        .update({ logo_url: null, updated_at: new Date().toISOString() })
        .eq('id', companyId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company', companyId] });
      toast.success('Company logo removed');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to remove logo');
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Show preview
    const reader = new FileReader();
    reader.onload = (ev) => setPreviewUrl(ev.target?.result as string);
    reader.readAsDataURL(file);

    // Upload
    uploadMutation.mutate(file);

    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const displayUrl = previewUrl || currentLogoUrl;
  const isLoading = uploadMutation.isPending || removeMutation.isPending;

  return (
    <div className="space-y-3">
      <Label>Company Logo</Label>
      <div className="flex items-center gap-4">
        <Avatar className="h-20 w-20 rounded-lg border">
          <AvatarImage src={displayUrl || undefined} alt={companyName} className="object-cover" />
          <AvatarFallback className="rounded-lg bg-muted">
            <Building2 className="h-8 w-8 text-muted-foreground" />
          </AvatarFallback>
        </Avatar>

        <div className="flex flex-col gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/jpg,image/webp"
            onChange={handleFileSelect}
            className="hidden"
            disabled={disabled || isLoading}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled || isLoading}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Upload className="h-4 w-4 mr-2" />
            )}
            {currentLogoUrl ? 'Replace' : 'Upload'}
          </Button>
          {currentLogoUrl && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => removeMutation.mutate()}
              disabled={disabled || isLoading}
              className="text-destructive hover:text-destructive"
            >
              <X className="h-4 w-4 mr-2" />
              Remove
            </Button>
          )}
          <p className="text-xs text-muted-foreground">PNG, JPG or WebP. Max 2MB.</p>
        </div>
      </div>
    </div>
  );
}
