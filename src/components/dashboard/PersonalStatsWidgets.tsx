import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Calendar, Clock, Wallet, FileCheck, Users, Gift, Bell } from 'lucide-react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';

interface LeaveBalance {
  name: string;
  balance: number;
  allocated: number;
  color: string;
}

interface Payslip {
  id: string;
  period: string;
  amount: number;
  date: string;
}

interface Holiday {
  name: string;
  date: string;
}

interface TeamMember {
  id: string;
  name: string;
  initials: string;
  status: string;
}

interface Announcement {
  id: string;
  title: string;
  date: string;
  type: string;
}

// Quick Stats Cards
export function PendingRequestsCard({ count }: { count: number }) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardDescription>Pending Requests</CardDescription>
        <div className="p-2 rounded-full bg-amber-500/10">
          <Clock className="h-4 w-4 text-amber-500" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold">{count}</div>
        {count > 0 && (
          <Link to="/app/leave">
            <Button variant="link" className="p-0 h-auto text-xs text-muted-foreground hover:text-primary">
              View requests →
            </Button>
          </Link>
        )}
      </CardContent>
    </Card>
  );
}

export function UpcomingLeaveCard({ leave }: { leave: { start_date: string; end_date: string; leave_type: string } | null }) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardDescription>Upcoming Leave</CardDescription>
        <div className="p-2 rounded-full bg-green-500/10">
          <Calendar className="h-4 w-4 text-green-500" />
        </div>
      </CardHeader>
      <CardContent>
        {leave ? (
          <div>
            <p className="font-semibold">{leave.leave_type}</p>
            <p className="text-sm text-muted-foreground">
              {format(new Date(leave.start_date), 'MMM d')} - {format(new Date(leave.end_date), 'MMM d')}
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No upcoming leave</p>
        )}
      </CardContent>
    </Card>
  );
}

export function NextPaydayCard({ date }: { date: string | null }) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardDescription>Next Payday</CardDescription>
        <div className="p-2 rounded-full bg-blue-500/10">
          <Wallet className="h-4 w-4 text-blue-500" />
        </div>
      </CardHeader>
      <CardContent>
        {date ? (
          <div>
            <p className="text-3xl font-bold">{format(new Date(date), 'd')}</p>
            <p className="text-sm text-muted-foreground">{format(new Date(date), 'MMMM yyyy')}</p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Not scheduled</p>
        )}
      </CardContent>
    </Card>
  );
}

export function PayslipsLinkCard() {
  return (
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
  );
}

// Leave Balances Widget
export function LeaveBalancesWidget({ balances }: { balances: LeaveBalance[] }) {
  if (balances.length === 0) return null;

  return (
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
        {balances.map((lb) => {
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
  );
}

// Recent Payslips Widget
export function RecentPayslipsWidget({ payslips }: { payslips: Payslip[] }) {
  return (
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
        {payslips.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <FileCheck className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No payslips available yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {payslips.map((payslip) => (
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
  );
}

// Upcoming Holidays Widget
export function UpcomingHolidaysWidget({ holidays }: { holidays: Holiday[] }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Gift className="h-5 w-5 text-primary" />
          <CardTitle className="text-base">Upcoming Holidays</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        {holidays.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <Gift className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No holidays in the next 30 days</p>
          </div>
        ) : (
          <div className="space-y-3">
            {holidays.map((holiday, i) => (
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
  );
}

// Team Members Widget
export function TeamMembersWidget({ members, linkTo = '/app/employees' }: { members: TeamMember[]; linkTo?: string }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">My Team</CardTitle>
          </div>
          <Link to={linkTo}>
            <Button variant="ghost" size="sm">View All</Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        {members.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No team members found</p>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {members.map((member) => (
              <div key={member.id} className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="text-xs bg-primary/10 text-primary">
                    {member.initials}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm font-medium">{member.name}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Announcements Widget
export function AnnouncementsWidget({ announcements }: { announcements: Announcement[] }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Bell className="h-5 w-5 text-primary" />
          <CardTitle className="text-base">Announcements</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        {announcements.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No announcements</p>
          </div>
        ) : (
          <div className="space-y-3">
            {announcements.map((ann) => (
              <div key={ann.id} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                <div className="p-2 rounded-full bg-primary/10">
                  <Bell className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-sm">{ann.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(ann.date), 'MMM d, yyyy')}
                  </p>
                </div>
                <Badge variant={ann.type === 'welcome' ? 'default' : 'secondary'} className="text-xs">
                  {ann.type}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Loading skeleton for quick stats
export function QuickStatsLoadingSkeleton() {
  return (
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
  );
}

// Loading skeleton for widget cards
export function WidgetLoadingSkeleton() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Skeleton className="h-48" />
      <Skeleton className="h-48" />
    </div>
  );
}
