import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useTeamStats, useMyTeam } from '@/hooks/useMyTeam';
import { useApproveLeaveRequest, useRejectLeaveRequest } from '@/hooks/useLeave';
import { Users, Clock, Calendar, UserMinus, CheckCircle, XCircle, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { format, addDays } from 'date-fns';
import { toast } from 'sonner';
import {
  QuickStatsLoadingSkeleton,
  WidgetLoadingSkeleton,
  LeaveBalancesWidget,
  RecentPayslipsWidget,
  UpcomingHolidaysWidget,
  PendingRequestsCard,
  UpcomingLeaveCard,
  NextPaydayCard,
  PayslipsLinkCard,
} from './PersonalStatsWidgets';
import { TeamCalendarWidget } from './TeamCalendarWidget';

interface ManagerPersonalStats {
  pendingLeaveRequests: number;
  upcomingLeave: { start_date: string; end_date: string; leave_type: string } | null;
  nextPayday: string | null;
  leaveBalances: { name: string; balance: number; allocated: number; color: string }[];
  recentPayslips: { id: string; period: string; amount: number; date: string }[];
  upcomingHolidays: { name: string; date: string }[];
}

// Hook to get manager's personal stats (their own data, not team)
function useManagerPersonalStats() {
  const { companyId } = useTenant();
  const { user } = useAuth();
  const userId = user?.user_id;

  return useQuery({
    queryKey: ['manager-personal-stats', companyId, userId],
    queryFn: async (): Promise<ManagerPersonalStats> => {
      if (!companyId || !userId) {
        return { 
          pendingLeaveRequests: 0, 
          upcomingLeave: null, 
          nextPayday: null, 
          leaveBalances: [],
          recentPayslips: [],
          upcomingHolidays: []
        };
      }

      // Get the employee record for this manager
      const { data: employee } = await supabase
        .from('employees')
        .select('id')
        .eq('user_id', userId)
        .eq('company_id', companyId)
        .single();

      if (!employee) {
        return { 
          pendingLeaveRequests: 0, 
          upcomingLeave: null, 
          nextPayday: null, 
          leaveBalances: [],
          recentPayslips: [],
          upcomingHolidays: []
        };
      }

      const today = new Date().toISOString().split('T')[0];
      const thirtyDaysFromNow = addDays(new Date(), 30).toISOString().split('T')[0];

      // Get pending leave requests count
      const { count: pendingCount } = await supabase
        .from('leave_requests')
        .select('id', { count: 'exact', head: true })
        .eq('employee_id', employee.id)
        .eq('company_id', companyId)
        .eq('status', 'pending');

      // Get upcoming approved leave
      const { data: upcomingLeaves } = await supabase
        .from('leave_requests')
        .select('start_date, end_date, leave_type:leave_types(name)')
        .eq('employee_id', employee.id)
        .eq('company_id', companyId)
        .eq('status', 'approved')
        .gte('start_date', today)
        .order('start_date', { ascending: true })
        .limit(1);

      // Get leave balances
      const { data: leaveTypes } = await supabase
        .from('leave_types')
        .select('id, name, default_days, color')
        .eq('company_id', companyId)
        .eq('is_active', true);

      const balances: { name: string; balance: number; allocated: number; color: string }[] = [];
      if (leaveTypes) {
        for (const lt of leaveTypes) {
          const { data: used } = await supabase
            .from('leave_requests')
            .select('total_days')
            .eq('employee_id', employee.id)
            .eq('company_id', companyId)
            .eq('leave_type_id', lt.id)
            .in('status', ['approved', 'pending']);

          const totalUsed = used?.reduce((sum, r) => sum + Number(r.total_days), 0) || 0;
          const allocated = lt.default_days || 0;
          balances.push({ 
            name: lt.name, 
            balance: allocated - totalUsed, 
            allocated,
            color: lt.color || '#3B82F6' 
          });
        }
      }

      // Get next payroll run
      const { data: nextPayroll } = await supabase
        .from('payroll_runs')
        .select('pay_date')
        .eq('company_id', companyId)
        .gte('pay_date', today)
        .order('pay_date', { ascending: true })
        .limit(1);

      // Get recent payslips
      const { data: recentPayrollEntries } = await supabase
        .from('payroll_entries')
        .select(`
          id,
          net_pay,
          payroll_run:payroll_runs(period_start, period_end, pay_date, status)
        `)
        .eq('employee_id', employee.id)
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })
        .limit(3);

      const recentPayslips = recentPayrollEntries
        ?.filter(e => (e.payroll_run as any)?.status === 'completed')
        .map(entry => ({
          id: entry.id,
          period: `${format(new Date((entry.payroll_run as any).period_start), 'MMM d')} - ${format(new Date((entry.payroll_run as any).period_end), 'MMM d')}`,
          amount: entry.net_pay,
          date: (entry.payroll_run as any).pay_date
        })) || [];

      // Upcoming holidays
      const upcomingHolidays = [
        { name: 'New Year\'s Day', date: `${new Date().getFullYear() + 1}-01-01` },
        { name: 'Independence Day', date: `${new Date().getFullYear()}-08-14` },
      ].filter(h => h.date >= today && h.date <= thirtyDaysFromNow);

      const upcomingLeave = upcomingLeaves?.[0] ? {
        start_date: upcomingLeaves[0].start_date,
        end_date: upcomingLeaves[0].end_date,
        leave_type: (upcomingLeaves[0].leave_type as any)?.name || 'Leave',
      } : null;

      return {
        pendingLeaveRequests: pendingCount || 0,
        upcomingLeave,
        nextPayday: nextPayroll?.[0]?.pay_date || null,
        leaveBalances: balances.slice(0, 4),
        recentPayslips,
        upcomingHolidays
      };
    },
    enabled: !!companyId && !!userId,
  });
}

// Pending team requests for quick approval
interface PendingTeamRequest {
  id: string;
  employee_name: string;
  employee_initials: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  total_days: number;
}

function usePendingTeamRequests() {
  const { companyId } = useTenant();
  const { user } = useAuth();
  const userId = user?.user_id;

  return useQuery({
    queryKey: ['pending-team-requests', companyId, userId],
    queryFn: async (): Promise<PendingTeamRequest[]> => {
      if (!companyId || !userId) return [];

      // Get current employee
      const { data: currentEmployee } = await supabase
        .from('employees')
        .select('id')
        .eq('company_id', companyId)
        .eq('user_id', userId)
        .single();

      if (!currentEmployee) return [];

      // Get direct reports
      const { data: teamMembers } = await supabase
        .from('employees')
        .select('id, first_name, last_name')
        .eq('company_id', companyId)
        .eq('manager_id', currentEmployee.id)
        .neq('employment_status', 'terminated');

      const employeeIds = teamMembers?.map(e => e.id) || [];
      if (employeeIds.length === 0) return [];

      // Get pending leave requests
      const { data: pendingRequests } = await supabase
        .from('leave_requests')
        .select(`
          id,
          start_date,
          end_date,
          total_days,
          employee_id,
          leave_type:leave_types(name)
        `)
        .eq('company_id', companyId)
        .in('employee_id', employeeIds)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(5);

      if (!pendingRequests) return [];

      return pendingRequests.map(req => {
        const emp = teamMembers?.find(e => e.id === req.employee_id);
        return {
          id: req.id,
          employee_name: emp ? `${emp.first_name} ${emp.last_name}` : 'Unknown',
          employee_initials: emp ? `${emp.first_name[0]}${emp.last_name[0]}` : '??',
          leave_type: (req.leave_type as any)?.name || 'Leave',
          start_date: req.start_date,
          end_date: req.end_date,
          total_days: req.total_days,
        };
      });
    },
    enabled: !!companyId && !!userId,
  });
}

export function ManagerDashboardStats() {
  const { data: teamStats, isLoading: teamStatsLoading } = useTeamStats();
  const { data: teamMembers, isLoading: teamMembersLoading } = useMyTeam();
  const { data: personalStats, isLoading: personalStatsLoading } = useManagerPersonalStats();
  const { data: pendingRequests, isLoading: pendingRequestsLoading, refetch: refetchPending } = usePendingTeamRequests();
  const approveLeave = useApproveLeaveRequest();
  const rejectLeave = useRejectLeaveRequest();

  const isLoading = teamStatsLoading || personalStatsLoading;

  // Team stat items
  const teamStatItems = [
    { 
      label: 'Team Size', 
      value: teamStats?.teamSize ?? 0, 
      icon: Users, 
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10'
    },
    { 
      label: 'Pending Approvals', 
      value: teamStats?.pendingApprovals ?? 0, 
      icon: Clock, 
      color: 'text-amber-500',
      bgColor: 'bg-amber-500/10',
      highlight: (teamStats?.pendingApprovals ?? 0) > 0
    },
    { 
      label: 'Out Today', 
      value: teamStats?.outToday ?? 0, 
      icon: Calendar, 
      color: 'text-green-500',
      bgColor: 'bg-green-500/10'
    },
  ];

  const handleApprove = async (requestId: string) => {
    try {
      await approveLeave.mutateAsync({ id: requestId });
      refetchPending();
    } catch (error) {
      // Error handled by mutation
    }
  };

  const handleReject = async (requestId: string) => {
    try {
      await rejectLeave.mutateAsync({ id: requestId, review_notes: 'Rejected from dashboard' });
      refetchPending();
    } catch (error) {
      // Error handled by mutation
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <QuickStatsLoadingSkeleton />
        <WidgetLoadingSkeleton />
      </div>
    );
  }

  // If no team members, show personal stats only
  const hasTeam = teamStats && teamStats.teamSize > 0;

  return (
    <div className="space-y-6">
      {/* Personal Quick Stats Row */}
      <div>
        <h2 className="text-lg font-semibold mb-4">My Overview</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <PendingRequestsCard count={personalStats?.pendingLeaveRequests ?? 0} />
          <UpcomingLeaveCard leave={personalStats?.upcomingLeave ?? null} />
          <NextPaydayCard date={personalStats?.nextPayday ?? null} />
          <PayslipsLinkCard />
        </div>
      </div>

      {/* Personal Widgets */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <LeaveBalancesWidget balances={personalStats?.leaveBalances ?? []} />
        <RecentPayslipsWidget payslips={personalStats?.recentPayslips ?? []} />
      </div>

      {/* Team Management Section */}
      {hasTeam && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">My Team</h2>
            <Link to="/app/my-team">
              <Button variant="ghost" size="sm" className="gap-1">
                Manage Team <ChevronRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
          
          {/* Team Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {teamStatItems.map((stat) => (
              <Card key={stat.label} className={stat.highlight ? 'border-amber-500/50' : ''}>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardDescription>{stat.label}</CardDescription>
                  <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                    <stat.icon className={`h-4 w-4 ${stat.color}`} />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold">{stat.value}</span>
                    {stat.highlight && (
                      <Badge variant="secondary" className="text-amber-600 bg-amber-100">
                        Needs attention
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Who's Out Today */}
          {teamStats && teamStats.outToday > 0 && (
            <Card className="border-muted bg-muted/30">
              <CardContent className="py-3">
                <div className="flex items-center gap-2">
                  <UserMinus className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">
                    <span className="font-medium">Out Today:</span>{' '}
                    {teamStats.onLeaveToday.join(', ')}
                  </span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Pending Approval Actions */}
          {pendingRequests && pendingRequests.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="h-5 w-5 text-amber-500" />
                    <CardTitle className="text-base">Pending Approvals</CardTitle>
                    <Badge variant="secondary" className="ml-1">{pendingRequests.length}</Badge>
                  </div>
                  <Link to="/app/my-team">
                    <Button variant="ghost" size="sm">View All</Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {pendingRequests.slice(0, 3).map((req) => (
                  <div key={req.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9">
                        <AvatarFallback className="text-xs bg-primary/10 text-primary">
                          {req.employee_initials}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium text-sm">{req.employee_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {req.leave_type} • {format(new Date(req.start_date), 'MMM d')} - {format(new Date(req.end_date), 'MMM d')} ({req.total_days} day{req.total_days !== 1 ? 's' : ''})
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        className="h-8 w-8 p-0 text-green-600 hover:text-green-700 hover:bg-green-100"
                        onClick={() => handleApprove(req.id)}
                        disabled={approveLeave.isPending}
                      >
                        <CheckCircle className="h-5 w-5" />
                      </Button>
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-100"
                        onClick={() => handleReject(req.id)}
                        disabled={rejectLeave.isPending}
                      >
                        <XCircle className="h-5 w-5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Direct Reports Preview */}
          {teamMembers && teamMembers.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-primary" />
                    <CardTitle className="text-base">Direct Reports</CardTitle>
                  </div>
                  <Link to="/app/my-team">
                    <Button variant="ghost" size="sm">View All</Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {teamMembers.slice(0, 4).map((member) => (
                    <div key={member.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback className="text-sm bg-primary/10 text-primary">
                          {member.first_name[0]}{member.last_name[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">
                          {member.first_name} {member.last_name}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {member.job_title || 'Team Member'}
                        </p>
                      </div>
                      {member.is_on_leave && (
                        <Badge variant="secondary" className="text-xs">On Leave</Badge>
                      )}
                      {member.pending_leave_count > 0 && (
                        <Badge variant="outline" className="text-xs text-amber-600 border-amber-300">
                          {member.pending_leave_count} pending
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Team Calendar Widget */}
          <TeamCalendarWidget />
        </div>
      )}

      {/* Holidays (shown for everyone) */}
      {personalStats && personalStats.upcomingHolidays.length > 0 && (
        <UpcomingHolidaysWidget holidays={personalStats.upcomingHolidays} />
      )}
    </div>
  );
}
