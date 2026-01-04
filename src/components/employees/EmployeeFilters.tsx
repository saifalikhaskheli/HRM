import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetFooter } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Filter, X, Building2, UserCheck, Briefcase, ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

interface Department {
  id: string;
  name: string;
}

export interface EmployeeFiltersState {
  departmentId: string;
  status: string;
  type: string;
}

interface EmployeeFiltersProps {
  filters: EmployeeFiltersState;
  onFiltersChange: (filters: EmployeeFiltersState) => void;
  departments: Department[];
}

const EMPLOYMENT_STATUSES = [
  { value: 'active', label: 'Active', color: 'bg-emerald-500' },
  { value: 'on_leave', label: 'On Leave', color: 'bg-amber-500' },
  { value: 'terminated', label: 'Terminated', color: 'bg-red-500' },
  { value: 'suspended', label: 'Suspended', color: 'bg-slate-400' },
];

const EMPLOYMENT_TYPES = [
  { value: 'full_time', label: 'Full Time' },
  { value: 'part_time', label: 'Part Time' },
  { value: 'contract', label: 'Contract' },
  { value: 'intern', label: 'Intern' },
  { value: 'temporary', label: 'Temporary' },
];

interface FilterSectionProps {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  isOpen?: boolean;
  onToggle?: () => void;
}

function FilterSection({ title, icon, children, isOpen = true, onToggle }: FilterSectionProps) {
  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 bg-muted/30 hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-2 text-sm font-medium">
          {icon}
          {title}
        </div>
        <ChevronDown className={cn(
          "h-4 w-4 text-muted-foreground transition-transform",
          isOpen && "rotate-180"
        )} />
      </button>
      {isOpen && (
        <div className="p-4 border-t border-border/50">
          {children}
        </div>
      )}
    </div>
  );
}

export function EmployeeFilters({ filters, onFiltersChange, departments }: EmployeeFiltersProps) {
  const [openSections, setOpenSections] = useState({
    department: true,
    status: true,
    type: true,
  });

  const activeFilterCount = [
    filters.departmentId,
    filters.status,
    filters.type,
  ].filter(Boolean).length;

  const clearFilters = () => {
    onFiltersChange({ departmentId: '', status: '', type: '' });
  };

  const updateFilter = (key: keyof EmployeeFiltersState, value: string) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const toggleSection = (section: keyof typeof openSections) => {
    setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" className="gap-2 border-border/60 hover:bg-muted">
          <Filter className="h-4 w-4" />
          <span className="hidden sm:inline">Filters</span>
          {activeFilterCount > 0 && (
            <Badge 
              className="h-5 w-5 p-0 flex items-center justify-center rounded-full bg-primary text-primary-foreground text-xs"
            >
              {activeFilterCount}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[360px] sm:w-[400px]">
        <SheetHeader className="pb-4">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-xl font-semibold">Filters</SheetTitle>
            {activeFilterCount > 0 && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4 mr-1" />
                Clear all
              </Button>
            )}
          </div>
          {activeFilterCount > 0 && (
            <p className="text-sm text-muted-foreground">
              {activeFilterCount} filter{activeFilterCount !== 1 ? 's' : ''} applied
            </p>
          )}
        </SheetHeader>

        <Separator className="mb-6" />
        
        <div className="space-y-4">
          {/* Department Filter */}
          <FilterSection
            title="Department"
            icon={<Building2 className="h-4 w-4" />}
            isOpen={openSections.department}
            onToggle={() => toggleSection('department')}
          >
            <Select 
              value={filters.departmentId} 
              onValueChange={(v) => updateFilter('departmentId', v)}
            >
              <SelectTrigger className="bg-background">
                <SelectValue placeholder="All departments" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All departments</SelectItem>
                {departments.map(dept => (
                  <SelectItem key={dept.id} value={dept.id}>
                    {dept.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FilterSection>

          {/* Status Filter */}
          <FilterSection
            title="Employment Status"
            icon={<UserCheck className="h-4 w-4" />}
            isOpen={openSections.status}
            onToggle={() => toggleSection('status')}
          >
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => updateFilter('status', '')}
                className={cn(
                  "px-3 py-2 rounded-md text-sm font-medium transition-colors border",
                  !filters.status 
                    ? "bg-primary text-primary-foreground border-primary" 
                    : "bg-background text-foreground border-border hover:bg-muted"
                )}
              >
                All
              </button>
              {EMPLOYMENT_STATUSES.map(status => (
                <button
                  key={status.value}
                  type="button"
                  onClick={() => updateFilter('status', status.value)}
                  className={cn(
                    "px-3 py-2 rounded-md text-sm font-medium transition-colors border flex items-center gap-2",
                    filters.status === status.value 
                      ? "bg-primary text-primary-foreground border-primary" 
                      : "bg-background text-foreground border-border hover:bg-muted"
                  )}
                >
                  <span className={cn("h-2 w-2 rounded-full", status.color)} />
                  {status.label}
                </button>
              ))}
            </div>
          </FilterSection>

          {/* Type Filter */}
          <FilterSection
            title="Employment Type"
            icon={<Briefcase className="h-4 w-4" />}
            isOpen={openSections.type}
            onToggle={() => toggleSection('type')}
          >
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => updateFilter('type', '')}
                className={cn(
                  "w-full px-3 py-2 rounded-md text-sm font-medium transition-colors border text-left",
                  !filters.type 
                    ? "bg-primary text-primary-foreground border-primary" 
                    : "bg-background text-foreground border-border hover:bg-muted"
                )}
              >
                All Types
              </button>
              {EMPLOYMENT_TYPES.map(type => (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => updateFilter('type', type.value)}
                  className={cn(
                    "w-full px-3 py-2 rounded-md text-sm font-medium transition-colors border text-left",
                    filters.type === type.value 
                      ? "bg-primary text-primary-foreground border-primary" 
                      : "bg-background text-foreground border-border hover:bg-muted"
                  )}
                >
                  {type.label}
                </button>
              ))}
            </div>
          </FilterSection>
        </div>

        <SheetFooter className="mt-8">
          <Button variant="outline" onClick={clearFilters} className="flex-1">
            Reset All
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
