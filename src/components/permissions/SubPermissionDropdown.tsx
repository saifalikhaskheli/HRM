import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Checkbox } from '@/components/ui/checkbox';
import { MoreHorizontal, Eye, Plus, Pencil, Trash2, CheckCircle, Play, ShieldCheck, Download, Settings, Lock } from 'lucide-react';
import { PermissionAction, ACTION_LABELS } from '@/types/permissions';
import { cn } from '@/lib/utils';

const ACTION_ICONS: Record<PermissionAction, React.ComponentType<{ className?: string }>> = {
  read: Eye,
  create: Plus,
  update: Pencil,
  delete: Trash2,
  approve: CheckCircle,
  process: Play,
  verify: ShieldCheck,
  export: Download,
  manage: Settings,
  lock: Lock,
};

interface SubPermissionDropdownProps {
  moduleLabel: string;
  permissions: {
    action: PermissionAction;
    hasPermission: boolean;
    isOverride?: boolean;
  }[];
  onToggle: (action: PermissionAction, newValue: boolean) => void;
  disabled?: boolean;
}

export function SubPermissionDropdown({
  moduleLabel,
  permissions,
  onToggle,
  disabled = false,
}: SubPermissionDropdownProps) {
  const [open, setOpen] = useState(false);

  const enabledCount = permissions.filter(p => p.hasPermission).length;

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0"
          disabled={disabled}
        >
          <MoreHorizontal className="h-4 w-4" />
          <span className="sr-only">Open {moduleLabel} permissions</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>{moduleLabel}</span>
          <span className="text-xs text-muted-foreground font-normal">
            {enabledCount}/{permissions.length} enabled
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="p-2 space-y-1">
          {permissions.map((perm) => {
            const Icon = ACTION_ICONS[perm.action];
            return (
              <label
                key={perm.action}
                className={cn(
                  "flex items-center gap-3 p-2 rounded-md cursor-pointer transition-colors",
                  "hover:bg-muted/50",
                  perm.isOverride && perm.hasPermission && "bg-green-500/10",
                  perm.isOverride && !perm.hasPermission && "bg-red-500/10"
                )}
              >
                <Checkbox
                  checked={perm.hasPermission}
                  onCheckedChange={(checked) => {
                    onToggle(perm.action, checked === true);
                  }}
                  disabled={disabled}
                />
                <Icon className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm flex-1">{ACTION_LABELS[perm.action]}</span>
                {perm.isOverride && (
                  <span className="text-xs text-muted-foreground">override</span>
                )}
              </label>
            );
          })}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
