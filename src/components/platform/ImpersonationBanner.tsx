import { useState, useEffect } from 'react';
import { useImpersonation } from '@/contexts/ImpersonationContext';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { X, Eye, Clock, Shield } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';

function formatDuration(startedAt: Date | null): string {
  if (!startedAt) return '';
  const seconds = Math.floor((Date.now() - startedAt.getTime()) / 1000);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  }
  return `${secs}s`;
}

export function ImpersonationBanner() {
  const { isImpersonating, impersonatedCompany, stopImpersonation, impersonationStartedAt } = useImpersonation();
  const { isPlatformAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [duration, setDuration] = useState('');

  // Update duration every second
  useEffect(() => {
    if (!impersonationStartedAt) return;
    
    const updateDuration = () => setDuration(formatDuration(impersonationStartedAt));
    updateDuration();
    
    const interval = setInterval(updateDuration, 1000);
    return () => clearInterval(interval);
  }, [impersonationStartedAt]);

  // Don't show banner if not a platform admin (safety check)
  if (!isPlatformAdmin || !isImpersonating || !impersonatedCompany) {
    return null;
  }

  const handleStop = async () => {
    await stopImpersonation();
    navigate('/platform/companies');
  };

  return (
    <div className="bg-amber-500 text-amber-950 px-4 py-2 flex items-center justify-between z-50">
      <div className="flex items-center gap-2">
        <Eye className="h-4 w-4" />
        <span className="text-sm font-medium">
          Viewing as: <strong>{impersonatedCompany.name}</strong>
          <span className="opacity-75 ml-1">({impersonatedCompany.slug})</span>
        </span>
        {duration && (
          <span className="flex items-center gap-1 text-xs opacity-75 ml-2">
            <Clock className="h-3 w-3" />
            {duration}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        {!location.pathname.includes('/permissions') && (
          <Button
            variant="ghost"
            size="sm"
            className="text-amber-950 hover:bg-amber-600 hover:text-amber-950 h-7 px-2"
            onClick={() => navigate(`/platform/companies/${impersonatedCompany.id}/permissions`)}
          >
            <Shield className="h-4 w-4 mr-1" />
            Permissions
          </Button>
        )}
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="text-amber-950 hover:bg-amber-600 hover:text-amber-950 h-7 px-2"
            >
              <X className="h-4 w-4 mr-1" />
              Exit
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Exit Impersonation?</AlertDialogTitle>
              <AlertDialogDescription>
                You are currently viewing as <strong>{impersonatedCompany.name}</strong>.
                {duration && <> Session duration: {duration}.</>}
                <br /><br />
                Are you sure you want to exit impersonation mode?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleStop}>Exit Impersonation</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
