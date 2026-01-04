import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import { Button } from '@/components/ui/button';
import { 
  Search, 
  Users, 
  Calendar, 
  Clock, 
  FileText, 
  DollarSign, 
  Settings, 
  BarChart3,
  Building2,
  Briefcase,
  Shield,
  HelpCircle,
  LayoutDashboard,
  Receipt,
  User,
} from 'lucide-react';
import { useEmployees } from '@/hooks/useEmployees';
import { useTenant } from '@/contexts/TenantContext';
import { useModuleAccess } from '@/hooks/useModuleAccess';

const PAGES = [
  { name: 'Dashboard', path: '/app/dashboard', icon: LayoutDashboard, keywords: ['home', 'overview'] },
  { name: 'Employees', path: '/app/employees', icon: Users, keywords: ['staff', 'team', 'people'] },
  { name: 'Departments', path: '/app/departments', icon: Building2, keywords: ['teams', 'organization'] },
  { name: 'Leave Management', path: '/app/leave', icon: Calendar, keywords: ['vacation', 'time off', 'pto'] },
  { name: 'Time Tracking', path: '/app/time', icon: Clock, keywords: ['attendance', 'clock in', 'hours'] },
  { name: 'Payroll', path: '/app/payroll', icon: DollarSign, keywords: ['salary', 'pay', 'wages'] },
  { name: 'Performance', path: '/app/performance', icon: BarChart3, keywords: ['reviews', 'goals', 'feedback'] },
  { name: 'Recruitment', path: '/app/recruitment', icon: Briefcase, keywords: ['hiring', 'jobs', 'candidates'] },
  { name: 'Documents', path: '/app/documents', icon: FileText, keywords: ['files', 'uploads'] },
  { name: 'Expenses', path: '/app/expenses', icon: Receipt, keywords: ['claims', 'reimbursement'] },
  { name: 'Settings', path: '/app/settings', icon: Settings, keywords: ['configuration', 'preferences'] },
  { name: 'My Profile', path: '/app/profile', icon: User, keywords: ['account', 'personal'] },
  { name: 'Help & Support', path: '/app/help', icon: HelpCircle, keywords: ['faq', 'documentation'] },
];

const SETTINGS_PAGES = [
  { name: 'Company Settings', path: '/app/settings/company', keywords: ['profile', 'logo'] },
  { name: 'Users & Roles', path: '/app/settings/users', keywords: ['team', 'invite'] },
  { name: 'Permissions', path: '/app/settings/permissions', keywords: ['access', 'security'] },
  { name: 'Email Settings', path: '/app/settings/email', keywords: ['smtp', 'notifications'] },
  { name: 'Billing', path: '/app/settings/billing', keywords: ['subscription', 'payment'] },
  { name: 'Security', path: '/app/settings/security', keywords: ['mfa', 'password'] },
  { name: 'Appearance', path: '/app/settings/appearance', keywords: ['theme', 'dark mode'] },
  { name: 'Localization', path: '/app/settings/localization', keywords: ['language', 'timezone'] },
];

export function GlobalSearchCommand() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { data: employees } = useEmployees();
  const { isAdmin } = useTenant();
  const { accessibleModules } = useModuleAccess();

  // Keyboard shortcut
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  const handleSelect = useCallback((path: string) => {
    setOpen(false);
    navigate(path);
  }, [navigate]);

  const accessiblePaths = accessibleModules
    .filter(m => m.hasAccess)
    .map(m => m.module.path);

  const filteredPages = PAGES.filter(page => 
    accessiblePaths.includes(page.path) || 
    ['/app/profile', '/app/help', '/app/settings'].includes(page.path)
  );

  return (
    <>
      <Button
        variant="outline"
        className="relative h-9 w-full justify-start rounded-md bg-muted/50 text-sm font-normal text-muted-foreground shadow-none sm:pr-12 md:w-64"
        onClick={() => setOpen(true)}
      >
        <Search className="mr-2 h-4 w-4" />
        <span className="hidden lg:inline-flex">Search...</span>
        <span className="inline-flex lg:hidden">Search...</span>
        <kbd className="pointer-events-none absolute right-1.5 top-1.5 hidden h-6 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
          <span className="text-xs">⌘</span>K
        </kbd>
      </Button>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Search employees, pages, settings..." />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          
          {/* Employees */}
          {employees && employees.length > 0 && (
            <CommandGroup heading="Employees">
              {employees.slice(0, 5).map((emp) => (
                <CommandItem
                  key={emp.id}
                  value={`${emp.first_name} ${emp.last_name} ${emp.email}`}
                  onSelect={() => handleSelect('/app/employees')}
                >
                  <Users className="mr-2 h-4 w-4" />
                  <div className="flex flex-col">
                    <span>{emp.first_name} {emp.last_name}</span>
                    <span className="text-xs text-muted-foreground">{emp.email}</span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          <CommandSeparator />

          {/* Pages */}
          <CommandGroup heading="Pages">
            {filteredPages.map((page) => (
              <CommandItem
                key={page.path}
                value={`${page.name} ${page.keywords.join(' ')}`}
                onSelect={() => handleSelect(page.path)}
              >
                <page.icon className="mr-2 h-4 w-4" />
                {page.name}
              </CommandItem>
            ))}
          </CommandGroup>

          {/* Settings (Admin only) */}
          {isAdmin && (
            <>
              <CommandSeparator />
              <CommandGroup heading="Settings">
                {SETTINGS_PAGES.map((page) => (
                  <CommandItem
                    key={page.path}
                    value={`${page.name} ${page.keywords.join(' ')}`}
                    onSelect={() => handleSelect(page.path)}
                  >
                    <Settings className="mr-2 h-4 w-4" />
                    {page.name}
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
}