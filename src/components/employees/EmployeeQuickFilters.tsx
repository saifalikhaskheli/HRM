import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';

interface QuickFilter {
  id: string;
  label: string;
  count?: number;
  isActive: boolean;
}

interface EmployeeQuickFiltersProps {
  filters: QuickFilter[];
  onFilterClick: (filterId: string) => void;
  onClearAll?: () => void;
}

export function EmployeeQuickFilters({ filters, onFilterClick, onClearAll }: EmployeeQuickFiltersProps) {
  const hasActiveFilters = filters.some(f => f.isActive);

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {filters.map((filter) => (
        <button
          key={filter.id}
          onClick={() => onFilterClick(filter.id)}
          className={cn(
            "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all",
            "border",
            filter.isActive
              ? "bg-primary text-primary-foreground border-primary shadow-sm"
              : "bg-background text-foreground border-border hover:bg-muted hover:border-muted-foreground/20"
          )}
        >
          {filter.label}
          {filter.count !== undefined && (
            <Badge 
              variant="secondary" 
              className={cn(
                "h-5 min-w-[20px] px-1.5 text-xs",
                filter.isActive && "bg-primary-foreground/20 text-primary-foreground"
              )}
            >
              {filter.count}
            </Badge>
          )}
        </button>
      ))}
      {hasActiveFilters && onClearAll && (
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={onClearAll}
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="h-3 w-3 mr-1" />
          Clear
        </Button>
      )}
    </div>
  );
}
