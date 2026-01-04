import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Loader2 } from 'lucide-react';
import { useUserManagement } from '@/hooks/useUserManagement';
import type { CompanyUser } from '@/hooks/useCompanyUsers';

interface RemoveUserDialogProps {
  user: CompanyUser | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RemoveUserDialog({ user, open, onOpenChange }: RemoveUserDialogProps) {
  const { removeUser } = useUserManagement();

  const handleConfirm = async () => {
    if (!user) return;

    try {
      await removeUser.mutateAsync({
        companyUserId: user.id,
        userId: user.user_id,
      });
      onOpenChange(false);
    } catch {
      // Error handled by mutation
    }
  };

  const userName = user?.profile?.first_name && user?.profile?.last_name
    ? `${user.profile.first_name} ${user.profile.last_name}`
    : user?.profile?.email || 'this user';

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove User from Company</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to remove <strong>{userName}</strong> from your company?
            <br /><br />
            The user will lose access to all company data. This action can be reversed by reactivating the user.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={removeUser.isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {removeUser.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Removing...
              </>
            ) : (
              'Remove User'
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
