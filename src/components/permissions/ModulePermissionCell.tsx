import { Checkbox } from '@/components/ui/checkbox';
import { SubPermissionDropdown } from './SubPermissionDropdown';
import { PermissionModule, PermissionAction, MODULE_LABELS } from '@/types/permissions';
import { cn } from '@/lib/utils';

interface ModulePermissionCellProps {
  module: PermissionModule;
  permissions: {
    action: PermissionAction;
    hasPermission: boolean;
    isOverride?: boolean;
  }[];
  onToggle: (action: PermissionAction, newValue: boolean) => void;
  onToggleAll: (enable: boolean) => void;
  disabled?: boolean;
}

export function ModulePermissionCell({
  module,
  permissions,
  onToggle,
  onToggleAll,
  disabled = false,
}: ModulePermissionCellProps) {
  const enabledCount = permissions.filter(p => p.hasPermission).length;
  const totalCount = permissions.length;
  const allEnabled = enabledCount === totalCount;
  const someEnabled = enabledCount > 0 && enabledCount < totalCount;
  const hasOverrides = permissions.some(p => p.isOverride);

  return (
    <div className="flex items-center gap-1.5">
      <Checkbox
        checked={allEnabled}
        ref={(ref) => {
          if (ref) {
            (ref as HTMLButtonElement).dataset.state = someEnabled ? 'indeterminate' : allEnabled ? 'checked' : 'unchecked';
          }
        }}
        onCheckedChange={(checked) => {
          onToggleAll(checked === true);
        }}
        disabled={disabled}
        className={cn(
          hasOverrides && "ring-2 ring-primary/30"
        )}
      />
      <SubPermissionDropdown
        moduleLabel={MODULE_LABELS[module]}
        permissions={permissions}
        onToggle={onToggle}
        disabled={disabled}
      />
    </div>
  );
}
