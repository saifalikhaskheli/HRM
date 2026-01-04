import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
} from 'recharts';
import { 
  useAttendanceAnalytics, 
  useExpenseAnalytics, 
  useLeaveAnalytics, 
  usePayrollAnalytics 
} from '@/hooks/useHRAnalytics';
import { useLocalization } from '@/contexts/LocalizationContext';
import { Clock, DollarSign, Calendar, TrendingUp } from 'lucide-react';

const COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

export function AttendanceAnalyticsCard() {
  const { data, isLoading } = useAttendanceAnalytics();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Attendance Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[200px] w-full" />
        </CardContent>
      </Card>
    );
  }

  const stats = [
    { label: 'Present', value: data?.presentDays || 0, color: 'text-green-600' },
    { label: 'Absent', value: data?.absentDays || 0, color: 'text-red-600' },
    { label: 'Late', value: data?.lateDays || 0, color: 'text-yellow-600' },
    { label: 'Attendance Rate', value: `${(data?.attendanceRate || 0).toFixed(1)}%`, color: 'text-blue-600' },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Attendance Overview
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-4 gap-4">
          {stats.map((stat) => (
            <div key={stat.label} className="text-center">
              <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
              <p className="text-xs text-muted-foreground">{stat.label}</p>
            </div>
          ))}
        </div>
        
        {data?.monthlyTrend && data.monthlyTrend.length > 0 && (
          <div className="h-[180px] mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.monthlyTrend}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                <YAxis tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--background))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }} 
                />
                <Bar dataKey="present" name="Present" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="late" name="Late" fill="hsl(var(--chart-3))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function ExpenseAnalyticsCard() {
  const { data, isLoading } = useExpenseAnalytics();
  const { formatCurrency } = useLocalization();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Expense Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[200px] w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="h-5 w-5" />
          Expense Summary
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-2xl font-bold">{formatCurrency(data?.totalAmount || 0)}</p>
            <p className="text-xs text-muted-foreground">Total (6 months)</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-yellow-600">{formatCurrency(data?.pendingAmount || 0)}</p>
            <p className="text-xs text-muted-foreground">Pending Approval</p>
          </div>
        </div>
        
        {data?.categoryBreakdown && data.categoryBreakdown.length > 0 && (
          <div className="h-[180px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data.categoryBreakdown.slice(0, 5)}
                  cx="50%"
                  cy="50%"
                  outerRadius={60}
                  dataKey="amount"
                  nameKey="category"
                  label={({ category, percent }) => `${category} (${(percent * 100).toFixed(0)}%)`}
                  labelLine={false}
                >
                  {data.categoryBreakdown.slice(0, 5).map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value: number) => formatCurrency(value)}
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--background))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }} 
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function LeaveAnalyticsCard() {
  const { data, isLoading } = useLeaveAnalytics();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Leave Analytics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[200px] w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Leave Analytics
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <p className="text-2xl font-bold">{data?.totalRequests || 0}</p>
            <p className="text-xs text-muted-foreground">Total Requests</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-yellow-600">{data?.pendingRequests || 0}</p>
            <p className="text-xs text-muted-foreground">Pending</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-green-600">{data?.approvedDays || 0}</p>
            <p className="text-xs text-muted-foreground">Days Approved</p>
          </div>
        </div>
        
        {/* Utilization bar */}
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span>Leave Utilization</span>
            <span>{(data?.utilizationRate || 0).toFixed(1)}%</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div 
              className="h-full bg-primary rounded-full transition-all" 
              style={{ width: `${data?.utilizationRate || 0}%` }}
            />
          </div>
        </div>
        
        {data?.typeBreakdown && data.typeBreakdown.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium">By Type</p>
            {data.typeBreakdown.slice(0, 4).map((type) => (
              <div key={type.type} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: type.color }}
                  />
                  <span>{type.type}</span>
                </div>
                <span className="font-medium">{type.days} days</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function PayrollAnalyticsCard() {
  const { data, isLoading } = usePayrollAnalytics();
  const { formatCurrency } = useLocalization();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Payroll Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[200px] w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Payroll Summary
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-2xl font-bold">{formatCurrency(data?.totalGross || 0)}</p>
            <p className="text-xs text-muted-foreground">Total Gross (6 months)</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-green-600">{formatCurrency(data?.totalNet || 0)}</p>
            <p className="text-xs text-muted-foreground">Total Net</p>
          </div>
        </div>
        
        {data?.monthlyTrend && data.monthlyTrend.some(m => m.gross > 0) && (
          <div className="h-[150px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.monthlyTrend}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                <YAxis tick={{ fontSize: 10 }} className="fill-muted-foreground" tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} />
                <Tooltip 
                  formatter={(value: number) => formatCurrency(value)}
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--background))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }} 
                />
                <Legend />
                <Line type="monotone" dataKey="gross" name="Gross" stroke="hsl(var(--chart-1))" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="net" name="Net" stroke="hsl(var(--chart-2))" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
        
        {data?.departmentBreakdown && data.departmentBreakdown.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium">By Department</p>
            {data.departmentBreakdown.slice(0, 3).map((dept, idx) => (
              <div key={dept.department} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                  />
                  <span>{dept.department}</span>
                </div>
                <span className="font-medium">{formatCurrency(dept.totalCost)}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
