import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Shield } from 'lucide-react';
import { PlatformPermissionViewer } from '@/components/platform/PlatformPermissionViewer';
import { useImpersonation } from '@/contexts/ImpersonationContext';
import { useEffect } from 'react';

export default function PlatformCompanyPermissionsPage() {
  const { companyId } = useParams<{ companyId: string }>();
  const navigate = useNavigate();
  const { startImpersonation, isImpersonating, impersonatedCompany, effectiveCompanyId } = useImpersonation();

  // Fetch company details
  const { data: company, isLoading } = useQuery({
    queryKey: ['platform-company', companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('companies')
        .select('id, name, slug')
        .eq('id', companyId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!companyId,
  });

  // Auto-start impersonation if viewing permissions for a specific company
  useEffect(() => {
    if (company && (!isImpersonating || impersonatedCompany?.id !== company.id)) {
      startImpersonation({
        id: company.id,
        name: company.name,
        slug: company.slug,
      });
    }
  }, [company, isImpersonating, impersonatedCompany?.id, startImpersonation]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (!company) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Company not found</p>
        <Button variant="outline" onClick={() => navigate('/platform/companies')} className="mt-4">
          Back to Companies
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(`/platform/companies/${companyId}`)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Shield className="h-6 w-6" />
            Permissions: {company.name}
          </h2>
          <p className="text-muted-foreground">
            Manage role and user permissions for this company
          </p>
        </div>
      </div>

      {/* Permission Viewer */}
      <PlatformPermissionViewer 
        companyId={company.id} 
        companyName={company.name}
        readOnly={false}
      />
    </div>
  );
}
