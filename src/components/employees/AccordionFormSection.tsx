import { useState } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AccordionFormSectionProps {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
  isComplete?: boolean;
  badge?: React.ReactNode;
}

export function AccordionFormSection({ 
  title, 
  icon, 
  children, 
  defaultOpen = false,
  isComplete = false,
  badge,
}: AccordionFormSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border border-border rounded-lg overflow-hidden bg-card">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-full flex items-center justify-between px-4 py-3 text-left transition-colors",
          "hover:bg-muted/50",
          isOpen && "bg-muted/30"
        )}
      >
        <div className="flex items-center gap-3">
          {icon && (
            <div className="flex items-center justify-center h-8 w-8 rounded-md bg-primary/10 text-primary">
              {icon}
            </div>
          )}
          <div className="flex items-center gap-2">
            <span className="font-semibold text-foreground">{title}</span>
            {badge}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isComplete && (
            <div className="flex items-center justify-center h-5 w-5 rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
              <Check className="h-3 w-3" />
            </div>
          )}
          <ChevronDown 
            className={cn(
              "h-5 w-5 text-muted-foreground transition-transform duration-200",
              isOpen && "rotate-180"
            )} 
          />
        </div>
      </button>
      <div className={cn(
        "grid transition-all duration-200 ease-in-out",
        isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
      )}>
        <div className="overflow-hidden">
          <div className="px-4 pb-4 pt-2 border-t border-border/50">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

interface FormProgressProps {
  sections: { id: string; label: string; isComplete: boolean }[];
}

export function FormProgress({ sections }: FormProgressProps) {
  const completedCount = sections.filter(s => s.isComplete).length;
  const percentage = Math.round((completedCount / sections.length) * 100);

  return (
    <div className="flex items-center gap-3 px-1">
      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
        <div 
          className="h-full bg-primary transition-all duration-300 rounded-full"
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">
        {completedCount}/{sections.length}
      </span>
    </div>
  );
}
