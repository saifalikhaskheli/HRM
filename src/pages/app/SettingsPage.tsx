import { Outlet, Navigate } from 'react-router-dom';
import { NavLink } from '@/components/NavLink';
import { useLocation } from 'react-router-dom';
import { SETTINGS_NAV } from '@/config/modules';
import { useTenant } from '@/contexts/TenantContext';
import { hasMinimumRole } from '@/types/auth';
import { ReadOnlyPageBanner } from '@/components/platform/ImpersonationRestricted';
import { useUserRole } from '@/hooks/useUserRole';

export default function SettingsPage() {
  const location = useLocation();
  const { role } = useTenant();
  const { isCompanyAdmin } = useUserRole();

  // Non-admins should not access company settings - redirect to personal security
  if (!isCompanyAdmin) {
    return <Navigate to="/app/my-security" replace />;
  }

  const visibleSettings = SETTINGS_NAV.filter(item => !item.minRole || hasMinimumRole(role, item.minRole));

  return (
    <div className="p-4 md:p-6 space-y-6">
      <ReadOnlyPageBanner />
      <div>
        <h1 className="text-2xl font-bold">Company Settings</h1>
        <p className="text-muted-foreground">Manage your company configuration and preferences</p>
      </div>

      <div className="flex gap-6">
        <div className="w-48 shrink-0 space-y-1">
          {visibleSettings.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className="flex items-center gap-2 px-3 py-2 rounded-md text-sm hover:bg-muted transition-colors"
              activeClassName="bg-muted font-medium"
            >
              <item.icon className="h-4 w-4" />
              {item.name}
            </NavLink>
          ))}
        </div>

        <div className="flex-1 min-w-0 overflow-hidden">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
