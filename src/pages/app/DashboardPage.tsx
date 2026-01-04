import { useTenant } from '@/contexts/TenantContext';
import { PageContainer, PageHeader } from '@/components/layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, Calendar, Building2, Briefcase, BarChart3 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useModuleAccess } from '@/hooks/useModuleAccess';
import { useDashboardStats } from '@/hooks/useDashboardStats';
import { Skeleton } from '@/components/ui/skeleton';
import { ReadOnlyPageBanner } from '@/components/platform/ImpersonationRestricted';
import { 
  AttendanceAnalyticsCard, 
  ExpenseAnalyticsCard, 
  LeaveAnalyticsCard, 
  PayrollAnalyticsCard 
} from '@/components/analytics/HRAnalyticsCards';
import { useUserRole } from '@/hooks/useUserRole';
import { ManagerDashboardStats } from '@/components/dashboard/ManagerDashboardStats';
import { EmployeeDashboardStats } from '@/components/dashboard/EmployeeDashboardStats';

export default function DashboardPage() {
  const { companyName, role, isTrialing, trialDaysRemaining, isFrozen, planName, isImpersonating } = useTenant();
  const { accessibleModules, canAccessModule } = useModuleAccess();
  const { data: stats, isLoading: statsLoading, error: statsError } = useDashboardStats();
  const { isHROrAbove, isManager: isManagerRole, isEmployee } = useUserRole();

  // Show manager-focused stats for managers (but not HR+ who see full stats)
  const showManagerStats = isManagerRole && !isHROrAbove;
  // Show employee stats for employees who are not managers
  const showEmployeeStats = !isHROrAbove && !isManagerRole;

  const statItems = [
    { 
      label: 'Total Employees', 
      value: statsLoading ? null : (stats?.totalEmployees ?? 0), 
      icon: Users, 
      color: 'text-blue-500' 
    },
    { 
      label: 'Pending Leave', 
      value: statsLoading ? null : (stats?.pendingLeave ?? 0), 
      icon: Calendar, 
      color: 'text-green-500' 
    },
    { 
      label: 'Active Departments', 
      value: statsLoading ? null : (stats?.activeDepartments ?? 0), 
      icon: Building2, 
      color: 'text-purple-500' 
    },
    { 
      label: 'Open Positions', 
      value: statsLoading ? null : (stats?.openPositions ?? 0), 
      icon: Briefcase, 
      color: 'text-orange-500' 
    },
  ];

  const descriptionText = `Welcome to ${companyName || 'your'}'s HR Portal${isTrialing && trialDaysRemaining !== null ? ` • ${trialDaysRemaining} days left in trial` : ''}${planName ? ` • ${planName} Plan` : ''}`;

  return (
    <PageContainer>
      <ReadOnlyPageBanner />
      
      <PageHeader title="Dashboard" description={descriptionText} />

      {/* Frozen Notice */}
      {isFrozen && (
        <Card className="border-destructive bg-destructive/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-destructive">Account Frozen</CardTitle>
            <CardDescription>
              Your company account is currently frozen. All data is read-only until the account is reactivated.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {/* Stats Error */}
      {statsError && (
        <Card className="border-amber-500 bg-amber-500/10">
          <CardHeader className="pb-2">
            <CardDescription className="text-amber-700">
              Unable to load some dashboard statistics. Please refresh the page.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {/* Manager Team Stats - shown for managers who are not HR+ */}
      {showManagerStats && (
        <ManagerDashboardStats />
      )}

      {/* Employee Personal Stats - shown for employees who are not managers or HR */}
      {showEmployeeStats && (
        <EmployeeDashboardStats />
      )}

      {/* Company Stats Grid - shown for HR+ only */}
      {isHROrAbove && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {statItems.map((stat) => (
            <Card key={stat.label}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardDescription>{stat.label}</CardDescription>
                <stat.icon className={`h-4 w-4 ${stat.color}`} />
              </CardHeader>
              <CardContent>
                {stat.value === null ? (
                  <Skeleton className="h-8 w-16" />
                ) : (
                  <div className="text-2xl font-bold">{stat.value}</div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Tabbed Content: Quick Access & Analytics */}
      <Tabs defaultValue="quick-access">
        <TabsList>
          <TabsTrigger value="quick-access">Quick Access</TabsTrigger>
          {isHROrAbove && <TabsTrigger value="analytics" className="gap-2">
            <BarChart3 className="h-4 w-4" />
            HR Analytics
          </TabsTrigger>}
        </TabsList>

        <TabsContent value="quick-access" className="mt-4">
          {accessibleModules.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No modules available. Contact your administrator for access.
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {accessibleModules.slice(0, 8).map(({ module }) => (
                <Link key={module.id} to={module.path}>
                  <Card className="hover:border-primary/50 transition-colors cursor-pointer group h-full">
                    <CardHeader className="pb-2">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                          <module.icon className="h-4 w-4" />
                        </div>
                        <CardTitle className="text-sm font-medium">{module.name}</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <CardDescription className="text-xs">{module.description}</CardDescription>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </TabsContent>

        {isHROrAbove && (
          <TabsContent value="analytics" className="mt-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {canAccessModule('time_tracking') && <AttendanceAnalyticsCard />}
              {canAccessModule('leave') && <LeaveAnalyticsCard />}
              <ExpenseAnalyticsCard />
              {canAccessModule('payroll') && <PayrollAnalyticsCard />}
            </div>
          </TabsContent>
        )}
      </Tabs>
    </PageContainer>
  );
}
