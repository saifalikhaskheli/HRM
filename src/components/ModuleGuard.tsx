import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useTenant } from '@/contexts/TenantContext';
import { ModuleId } from '@/config/modules';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Crown, Lock, Snowflake } from 'lucide-react';
import { Link } from 'react-router-dom';

interface ModuleGuardProps {
  moduleId: ModuleId;
  children: ReactNode;
}

/**
 * ModuleGuard - Page-level protection component
 * 
 * Use this to wrap entire pages that require module access.
 * Shows upgrade prompts or redirects when access is denied.
 * 
 * For inline UI elements, use ModuleGate from PermissionGate.tsx instead.
 */
export function ModuleGuard({ moduleId, children }: ModuleGuardProps) {
  const { isLoading, hasModule, isFrozen, role } = useTenant();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Check frozen state first
  if (isFrozen) {
    return (
      <div className="p-6">
        <Card className="max-w-lg mx-auto">
          <CardHeader className="text-center">
            <div className="mx-auto p-3 rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-400 w-fit mb-4">
              <Snowflake className="h-8 w-8" />
            </div>
            <CardTitle>Account Frozen</CardTitle>
            <CardDescription>
              Your company account is currently frozen. This module is read-only until the account is reactivated.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Link to="/app/settings/billing">
              <Button>Go to Billing</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Check module access
  if (!hasModule(moduleId)) {
    return (
      <div className="p-6">
        <Card className="max-w-lg mx-auto">
          <CardHeader className="text-center">
            <div className="mx-auto p-3 rounded-full bg-amber-100 text-amber-600 dark:bg-amber-900 dark:text-amber-400 w-fit mb-4">
              <Crown className="h-8 w-8" />
            </div>
            <CardTitle>Upgrade Required</CardTitle>
            <CardDescription>
              This module is not included in your current plan. Upgrade to access this feature.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Link to="/app/settings/billing">
              <Button>View Plans</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Access granted
  return <>{children}</>;
}
