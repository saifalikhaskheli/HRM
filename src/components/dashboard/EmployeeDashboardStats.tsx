import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Calendar, Clock, Wallet, FileCheck, Users, Bell, Gift, Briefcase } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { format, addDays, isWithinInterval, startOfMonth, endOfMonth, parseISO } from 'date-fns';
import { Progress } from '@/components/ui/progress';

interface PersonalStats {
  pendingLeaveRequests: number;
  upcomingLeave: { start_date: string; end_date: string; leave_type: string } | null;
  nextPayday: string | null;
  leaveBalances: { name: string; balance: number; allocated: number; color: string }[];
  recentPayslips: { id: string; period: string; amount: number; date: string }[];
  upcomingHolidays: { name: string; date: string }[];
  teamMembers: { id: string; name: string; initials: string; status: string }[];
  announcements: { id: string; title: string; date: string; type: string }[];
}

export function EmployeeDashboardStats() {
  const { companyId } = useTenant();
  const { user } = useAuth();
  const userId = user?.user_id;

  const { data: stats, isLoading } = useQuery({
    queryKey: ['employee-personal-stats', companyId, userId],
    queryFn: async (): Promise<PersonalStats> => {
      if (!companyId || !userId) {
        return { 
          pendingLeaveRequests: 0, 
          upcomingLeave: null, 
          nextPayday: null, 
          leaveBalances: [],
          recentPayslips: [],
          upcomingHolidays: [],
          teamMembers: [],
          announcements: []
        };
      }

      // Get the employee's id and department
      const { data: employee } = await supabase
        .from('employees')
        .select('id, department_id, first_name, last_name')
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
          upcomingHolidays: [],
          teamMembers: [],
          announcements: []
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

      // Get leave balances with allocated amounts
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
          const balance = allocated - totalUsed;
          balances.push({ 
            name: lt.name, 
            balance, 
            allocated,
            color: lt.color || '#3B82F6' 
          });
        }
      }

      // Get next payroll run (estimated payday)
      const { data: nextPayroll } = await supabase
        .from('payroll_runs')
        .select('pay_date')
        .eq('company_id', companyId)
        .gte('pay_date', today)
        .order('pay_date', { ascending: true })
        .limit(1);

      // Get recent payslips (from payroll entries)
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

      // Get team members (same department)
      let teamMembers: { id: string; name: string; initials: string; status: string }[] = [];
      if (employee.department_id) {
        const { data: team } = await supabase
          .from('employees')
          .select('id, first_name, last_name, employment_status')
          .eq('company_id', companyId)
          .eq('department_id', employee.department_id)
          .neq('id', employee.id)
          .eq('employment_status', 'active')
          .limit(5);

        teamMembers = team?.map(t => ({
          id: t.id,
          name: `${t.first_name} ${t.last_name}`,
          initials: `${t.first_name[0]}${t.last_name[0]}`,
          status: t.employment_status
        })) || [];
      }

      // Simulated upcoming holidays (in a real app, this would come from a holidays table)
      const upcomingHolidays = [
        { name: 'New Year\'s Day', date: `${new Date().getFullYear() + 1}-01-01` },
        { name: 'Independence Day', date: `${new Date().getFullYear()}-08-14` },
      ].filter(h => h.date >= today && h.date <= thirtyDaysFromNow);

      // Simulated announcements (in a real app, this would come from an announcements table)
      const announcements = [
        { id: '1', title: 'Welcome to the team!', date: today, type: 'welcome' },
        { id: '2', title: 'Q4 Goals Announced', date: today, type: 'info' },
      ];

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
        upcomingHolidays,
        teamMembers,
        announcements
      };
    },
    enabled: !!companyId && !!userId,
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="space-y-6">
      {/* Quick Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Pending Leave Requests */}
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardDescription>Pending Requests</CardDescription>
            <div className="p-2 rounded-full bg-amber-500/10">
              <Clock className="h-4 w-4 text-amber-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.pendingLeaveRequests}</div>
            {stats.pendingLeaveRequests > 0 && (
              <Link to="/app/leave">
                <Button variant="link" className="p-0 h-auto text-xs text-muted-foreground hover:text-primary">
                  View requests →
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>

        {/* Upcoming Leave */}
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardDescription>Upcoming Leave</CardDescription>
            <div className="p-2 rounded-full bg-green-500/10">
              <Calendar className="h-4 w-4 text-green-500" />
            </div>
          </CardHeader>
          <CardContent>
            {stats.upcomingLeave ? (
              <div>
                <p className="font-semibold">{stats.upcomingLeave.leave_type}</p>
                <p className="text-sm text-muted-foreground">
                  {format(new Date(stats.upcomingLeave.start_date), 'MMM d')} - {format(new Date(stats.upcomingLeave.end_date), 'MMM d')}
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No upcoming leave</p>
            )}
          </CardContent>
        </Card>

        {/* Next Payday */}
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardDescription>Next Payday</CardDescription>
            <div className="p-2 rounded-full bg-blue-500/10">
              <Wallet className="h-4 w-4 text-blue-500" />
            </div>
          </CardHeader>
          <CardContent>
            {stats.nextPayday ? (
              <div>
                <p className="text-3xl font-bold">{format(new Date(stats.nextPayday), 'd')}</p>
                <p className="text-sm text-muted-foreground">{format(new Date(stats.nextPayday), 'MMMM yyyy')}</p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Not scheduled</p>
            )}
          </CardContent>
        </Card>

        {/* Payslips Link */}
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardDescription>My Payslips</CardDescription>
            <div className="p-2 rounded-full bg-purple-500/10">
              <FileCheck className="h-4 w-4 text-purple-500" />
            </div>
          </CardHeader>
          <CardContent>
            <Link to="/app/payslips">
              <Button variant="outline" size="sm" className="w-full">View Payslips</Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Two Column Layout for Widgets */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Leave Balances with Progress */}
        {stats.leaveBalances.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-primary" />
                  <CardTitle className="text-base">Leave Balances</CardTitle>
                </div>
                <Link to="/app/leave">
                  <Button variant="ghost" size="sm">Request Leave</Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {stats.leaveBalances.map((lb) => {
                const usedPercent = lb.allocated > 0 ? ((lb.allocated - lb.balance) / lb.allocated) * 100 : 0;
                return (
                  <div key={lb.name} className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">{lb.name}</span>
                      <span className="text-sm text-muted-foreground">
                        <span className="font-semibold" style={{ color: lb.balance > 0 ? lb.color : 'hsl(var(--destructive))' }}>
                          {lb.balance}
                        </span>
                        <span className="text-xs"> / {lb.allocated} days</span>
                      </span>
                    </div>
                    <Progress 
                      value={usedPercent} 
                      className="h-2"
                      style={{ 
                        '--progress-background': lb.color 
                      } as React.CSSProperties}
                    />
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

        {/* Recent Payslips */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Wallet className="h-5 w-5 text-primary" />
                <CardTitle className="text-base">Recent Payslips</CardTitle>
              </div>
              <Link to="/app/payslips">
                <Button variant="ghost" size="sm">View All</Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {stats.recentPayslips.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                <FileCheck className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No payslips available yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {stats.recentPayslips.map((payslip) => (
                  <div key={payslip.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                    <div>
                      <p className="font-medium text-sm">{payslip.period}</p>
                      <p className="text-xs text-muted-foreground">
                        Paid on {format(new Date(payslip.date), 'MMM d, yyyy')}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">${payslip.amount.toLocaleString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Upcoming Holidays */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Gift className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">Upcoming Holidays</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {stats.upcomingHolidays.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                <Gift className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No holidays in the next 30 days</p>
              </div>
            ) : (
              <div className="space-y-3">
                {stats.upcomingHolidays.map((holiday, i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-full bg-primary/10">
                        <Gift className="h-4 w-4 text-primary" />
                      </div>
                      <span className="font-medium text-sm">{holiday.name}</span>
                    </div>
                    <Badge variant="secondary">
                      {format(new Date(holiday.date), 'MMM d')}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Team Members */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                <CardTitle className="text-base">My Team</CardTitle>
              </div>
              <Link to="/app/employees">
                <Button variant="ghost" size="sm">View Directory</Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {stats.teamMembers.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No team members found</p>
              </div>
            ) : (
              <div className="flex flex-wrap gap-3">
                {stats.teamMembers.map((member) => (
                  <div key={member.id} className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="text-xs bg-primary/10 text-primary">
                        {member.initials}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium">{member.name}</span>
                  </div>
                ))}
                {stats.teamMembers.length >= 5 && (
                  <Link to="/app/employees" className="flex items-center gap-2 p-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                    <span className="text-sm text-muted-foreground">+more</span>
                  </Link>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Announcements Banner */}
      {stats.announcements.length > 0 && (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">Announcements</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {stats.announcements.slice(0, 2).map((announcement) => (
                <div key={announcement.id} className="flex items-center justify-between p-3 rounded-lg bg-background/80">
                  <div className="flex items-center gap-3">
                    <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                    <span className="font-medium text-sm">{announcement.title}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(announcement.date), 'MMM d')}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
