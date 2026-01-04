import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useTenant } from '@/contexts/TenantContext';
import { useModuleAccess } from '@/hooks/useModuleAccess';
import { useImpersonation } from '@/contexts/ImpersonationContext';
import { HR_MODULES } from '@/config/modules';
import { NavLink } from '@/components/NavLink';
import { Settings, Lock, HelpCircle, Eye, X, Clock, Activity } from 'lucide-react';
import { usePendingApprovalsCount } from '@/hooks/useMyTeam';
import { useUserRole } from '@/hooks/useUserRole';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  SidebarHeader,
  useSidebar,
} from '@/components/ui/sidebar';
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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

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

export function AppSidebar() {
  const location = useLocation();
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const { role, isAdmin, planName, isTrialing } = useTenant();
  const { accessibleModules, isFrozen } = useModuleAccess();
  const { isImpersonating, impersonatedCompany, stopImpersonation, impersonationStartedAt } = useImpersonation();
  const { isHROrAbove, isCompanyAdmin } = useUserRole();
  const { data: pendingApprovals } = usePendingApprovalsCount();
  const [duration, setDuration] = useState('');

  // Update duration every second
  useEffect(() => {
    if (!impersonationStartedAt) {
      setDuration('');
      return;
    }
    
    const updateDuration = () => setDuration(formatDuration(impersonationStartedAt));
    updateDuration();
    
    const interval = setInterval(updateDuration, 1000);
    return () => clearInterval(interval);
  }, [impersonationStartedAt]);

  const isActive = (path: string) => location.pathname.startsWith(path);
  const isSettingsActive = location.pathname.startsWith('/app/settings');

  // Filter modules to show only those the user can actually access
  // This prevents "clickable but blocked" UX
  const visibleModules = accessibleModules.filter(({ hasAccess }) => hasAccess);

  return (
    <Sidebar collapsible="icon" className="border-r border-border/50">
      {/* Impersonation Indicator */}
      {isImpersonating && impersonatedCompany && (
        <SidebarHeader className="p-0">
          <div className={cn(
            "bg-amber-500/10 border-b border-amber-500/20 px-3 py-2",
            collapsed ? "flex items-center justify-center" : ""
          )}>
            {collapsed ? (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-amber-600 hover:text-amber-700 hover:bg-amber-500/20"
                    title="Exit impersonation"
                  >
                    <Eye className="h-4 w-4" />
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
                    <AlertDialogAction onClick={() => stopImpersonation()}>Exit Impersonation</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            ) : (
              <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                <Eye className="h-4 w-4 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] uppercase tracking-wide font-medium opacity-75">Viewing as</p>
                  <p className="text-xs font-semibold truncate">{impersonatedCompany.name}</p>
                  {duration && (
                    <p className="text-[10px] opacity-75 flex items-center gap-1 mt-0.5">
                      <Clock className="h-2.5 w-2.5" />
                      {duration}
                    </p>
                  )}
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 shrink-0 text-amber-600 hover:text-amber-700 hover:bg-amber-500/20"
                      title="Exit impersonation"
                    >
                      <X className="h-3.5 w-3.5" />
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
                      <AlertDialogAction onClick={() => stopImpersonation()}>Exit Impersonation</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            )}
          </div>
        </SidebarHeader>
      )}
      
      <SidebarContent className="py-2">
        {/* HR Modules - Only show if user has accessible modules */}
        {visibleModules.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>{isHROrAbove ? 'HR Modules' : 'Modules'}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {visibleModules.map(({ module }) => (
                  <SidebarMenuItem key={module.id}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive(module.path)}
                      tooltip={module.name}
                    >
                      <NavLink 
                        to={module.path} 
                        className="flex items-center gap-2"
                        activeClassName="bg-sidebar-accent text-sidebar-accent-foreground"
                      >
                        <module.icon className="h-4 w-4" />
                        {!collapsed && (
                          <>
                            <span className="flex-1">{module.name}</span>
                            {module.id === 'my_team' && (pendingApprovals ?? 0) > 0 && (
                              <Badge variant="secondary" className="ml-auto text-xs px-1.5 py-0.5 bg-amber-500/20 text-amber-600">
                                {pendingApprovals}
                              </Badge>
                            )}
                            {isFrozen && <Lock className="h-3 w-3 text-muted-foreground" />}
                          </>
                        )}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* Utility Links - Bottom section */}
        <SidebarGroup className="mt-auto">
          <SidebarGroupContent>
            <SidebarMenu>
              {/* Settings - Admin only */}
              {isCompanyAdmin && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={isSettingsActive} tooltip="Settings">
                    <NavLink 
                      to="/app/settings" 
                      className="flex items-center gap-2"
                      activeClassName="bg-sidebar-accent text-sidebar-accent-foreground"
                    >
                      <Settings className="h-4 w-4" />
                      {!collapsed && <span>Settings</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
              {/* Logs - Admin only */}
              {isCompanyAdmin && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={isActive('/app/logs')} tooltip="Logs">
                    <NavLink 
                      to="/app/logs" 
                      className="flex items-center gap-2"
                      activeClassName="bg-sidebar-accent text-sidebar-accent-foreground"
                    >
                      <Activity className="h-4 w-4" />
                      {!collapsed && <span>Logs</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isActive('/app/help')} tooltip="Help & Support">
                  <NavLink 
                    to="/app/help" 
                    className="flex items-center gap-2"
                    activeClassName="bg-sidebar-accent text-sidebar-accent-foreground"
                  >
                    <HelpCircle className="h-4 w-4" />
                    {!collapsed && <span>Help & Support</span>}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* Footer with Plan Info - only show if there's content */}
      {!collapsed && planName && (
        <SidebarFooter className="border-t border-border/50 p-3">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{planName} Plan</span>
            {isTrialing && (
              <Badge variant="secondary" className="text-xs">Trial</Badge>
            )}
          </div>
        </SidebarFooter>
      )}
    </Sidebar>
  );
}
