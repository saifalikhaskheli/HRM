import { useTenant } from '@/contexts/TenantContext';
import { AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

export function FrozenBanner() {
  const { isFrozen, isAdmin } = useTenant();

  if (!isFrozen) return null;

  return (
    <Alert variant="destructive" className="rounded-none border-x-0 border-t-0">
      <AlertTriangle className="h-4 w-4" />
      <AlertDescription className="flex items-center justify-between flex-wrap gap-2">
        <span>
          Your company account has been frozen. All data is read-only until the account is reactivated.
        </span>
        {isAdmin && (
          <Link to="/app/settings/billing">
            <Button size="sm" variant="outline" className="bg-background">
              Update Billing
            </Button>
          </Link>
        )}
      </AlertDescription>
    </Alert>
  );
}
