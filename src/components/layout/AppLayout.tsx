import { Outlet } from 'react-router-dom';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from './AppSidebar';
import { AppHeader } from './AppHeader';
import { AppFooter } from './AppFooter';
import { FrozenBanner } from './FrozenBanner';
import { TrialBanner } from './TrialBanner';
import { TrialExpiredBanner } from './TrialExpiredBanner';
import { ImpersonationBanner } from '@/components/platform/ImpersonationBanner';
import { SubdomainHealthBanner } from '@/components/domain/SubdomainHealthBanner';
import { PermissionProvider } from '@/contexts/PermissionContext';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { usePlatformFooter } from '@/hooks/usePlatformFooter';
import { Loader2 } from 'lucide-react';

export function AppLayout() {
  const { isLoading } = useRequireAuth({ requireCompany: true });
  const { showFooter } = usePlatformFooter();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <PermissionProvider>
      <SidebarProvider>
        <div className="h-screen flex w-full overflow-hidden">
          <AppSidebar />
          <SidebarInset className="flex-1 flex flex-col min-w-0 overflow-hidden">
            {/* Fixed header section */}
            <div className="shrink-0">
              <ImpersonationBanner />
              <SubdomainHealthBanner />
              <AppHeader />
              <FrozenBanner />
              <TrialExpiredBanner />
              <TrialBanner />
            </div>
            {/* Scrollable main content */}
            <main className="flex-1 overflow-y-auto overflow-x-hidden min-w-0">
              <Outlet />
            </main>
            {/* Fixed footer */}
            <AppFooter showFooter={showFooter} />
          </SidebarInset>
        </div>
      </SidebarProvider>
    </PermissionProvider>
  );
}
