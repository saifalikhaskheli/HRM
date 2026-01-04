import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/contexts/TenantContext';
import { 
  Building2, 
  ChevronDown, 
  LogOut, 
  Settings, 
  User
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Link } from 'react-router-dom';
import { GlobalSearchCommand } from './GlobalSearchCommand';
import { NotificationBell } from './NotificationBell';

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Owner',
  company_admin: 'Admin',
  hr_manager: 'HR Manager',
  manager: 'Manager',
  employee: 'Employee',
};

export function AppHeader() {
  const { user, signOut, switchCompany } = useAuth();
  const { companyName, companyLogoUrl, role, isFrozen } = useTenant();

  const getInitials = () => {
    const first = user?.first_name?.[0] || '';
    const last = user?.last_name?.[0] || '';
    return (first + last).toUpperCase() || user?.email?.[0]?.toUpperCase() || '?';
  };

  return (
    <header className="h-14 border-b border-border/50 bg-card/80 backdrop-blur-sm sticky top-0 z-40 flex items-center px-4 gap-4">
      <SidebarTrigger className="-ml-1" />
      
      <div className="flex items-center gap-3">
        {companyLogoUrl ? (
          <img src={companyLogoUrl} alt="" className="h-8 w-8 rounded-lg object-cover" />
        ) : (
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Building2 className="h-4 w-4 text-primary" />
          </div>
        )}
        <div className="hidden sm:block">
          <div className="flex items-center gap-2">
            <span className="font-semibold">{companyName}</span>
            {isFrozen && (
              <Badge variant="destructive" className="text-xs">Frozen</Badge>
            )}
          </div>
          {role && (
            <span className="text-xs text-muted-foreground">{ROLE_LABELS[role] || role}</span>
          )}
        </div>
      </div>

      <div className="flex-1" />

      {/* Global Search */}
      <GlobalSearchCommand />

      {/* Notifications */}
      <NotificationBell />

      {/* Company Switcher */}
      {user?.companies && user.companies.length > 1 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="hidden md:flex">
              Switch Company
              <ChevronDown className="ml-2 h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuLabel>Your Companies</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {user.companies.map((company) => (
              <DropdownMenuItem
                key={company.company_id}
                onClick={() => switchCompany(company.company_id)}
                className={company.is_primary ? 'bg-muted' : ''}
              >
                <Building2 className="mr-2 h-4 w-4" />
                <div className="flex-1 truncate">
                  <div className="font-medium">{company.company_name}</div>
                  <div className="text-xs text-muted-foreground">
                    {ROLE_LABELS[company.role] || company.role}
                  </div>
                </div>
                {company.is_primary && (
                  <Badge variant="secondary" className="ml-2">Current</Badge>
                )}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {/* User Menu */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="relative h-9 w-9 rounded-full">
            <Avatar className="h-9 w-9">
              <AvatarImage src={user?.avatar_url || undefined} />
              <AvatarFallback>{getInitials()}</AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>
            <div className="flex flex-col">
              <span>{user?.first_name} {user?.last_name}</span>
              <span className="text-sm font-normal text-muted-foreground truncate">
                {user?.email}
              </span>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link to="/app/profile">
              <User className="mr-2 h-4 w-4" />
              My Profile
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link to="/app/my-security">
              <Settings className="mr-2 h-4 w-4" />
              Security Settings
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={signOut} className="text-destructive focus:text-destructive">
            <LogOut className="mr-2 h-4 w-4" />
            Sign Out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
