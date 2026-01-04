import { NavLink, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { 
  LayoutDashboard, 
  Building2, 
  Users, 
  CreditCard, 
  BarChart3,
  Settings,
  Shield,
  ChevronLeft,
  ChevronRight,
  FileText,
  UserCog,
  Webhook,
  Mail,
  Receipt,
  AlertTriangle,
} from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';

const platformNavItems = [
  { name: 'Dashboard', path: '/platform/dashboard', icon: LayoutDashboard },
  { name: 'Companies', path: '/platform/companies', icon: Building2 },
  { name: 'Users', path: '/platform/users', icon: Users },
  { name: 'Platform Admins', path: '/platform/admins', icon: Shield },
  { name: 'Plans', path: '/platform/plans', icon: CreditCard },
  { name: 'Analytics', path: '/platform/analytics', icon: BarChart3 },
  { name: 'Logs', path: '/platform/logs', icon: FileText },
  { name: 'Webhooks', path: '/platform/webhooks', icon: Webhook },
  { name: 'Settings', path: '/platform/settings', icon: Settings },
];

export function PlatformSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();

  return (
    <aside 
      className={cn(
        "flex flex-col border-r border-border bg-card transition-all duration-300",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Header */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-border">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <Shield className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-semibold text-foreground">Platform Admin</span>
          </div>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCollapsed(!collapsed)}
          className="h-8 w-8"
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-2 space-y-1">
        {platformNavItems.map((item) => {
          const isActive = location.pathname === item.path || 
            (item.path !== '/platform/dashboard' && location.pathname.startsWith(item.path));
          
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                isActive 
                  ? "bg-primary text-primary-foreground" 
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
                collapsed && "justify-center px-2"
              )}
              title={collapsed ? item.name : undefined}
            >
              <item.icon className="h-5 w-5 flex-shrink-0" />
              {!collapsed && <span>{item.name}</span>}
            </NavLink>
          );
        })}
      </nav>

    </aside>
  );
}
