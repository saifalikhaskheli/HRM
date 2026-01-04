import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp, TrendingDown, Users, DollarSign, Building2, UserCheck } from 'lucide-react';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar } from 'recharts';
import { format, subDays, startOfDay, eachDayOfInterval } from 'date-fns';

const COLORS = ['hsl(var(--primary))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

export default function PlatformAnalyticsPage() {
  // Fetch company growth data (last 30 days)
  const { data: growthData, isLoading: isLoadingGrowth } = useQuery({
    queryKey: ['platform-analytics-growth'],
    queryFn: async () => {
      const thirtyDaysAgo = subDays(new Date(), 30);
      
      const { data: companies, error } = await supabase
        .from('companies')
        .select('created_at')
        .gte('created_at', thirtyDaysAgo.toISOString())
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Group by day
      const days = eachDayOfInterval({ start: thirtyDaysAgo, end: new Date() });
      const dailyCounts = days.map(day => {
        const dayStart = startOfDay(day);
        const dayEnd = new Date(dayStart);
        dayEnd.setDate(dayEnd.getDate() + 1);
        
        const count = companies?.filter(c => {
          const created = new Date(c.created_at);
          return created >= dayStart && created < dayEnd;
        }).length || 0;

        return {
          date: format(day, 'MMM d'),
          signups: count,
        };
      });

      // Calculate cumulative
      let cumulative = 0;
      return dailyCounts.map(d => {
        cumulative += d.signups;
        return { ...d, total: cumulative };
      });
    },
  });

  // Fetch subscription distribution
  const { data: subscriptionData, isLoading: isLoadingSubs } = useQuery({
    queryKey: ['platform-analytics-subscriptions'],
    queryFn: async () => {
      const { data: subscriptions, error } = await supabase
        .from('company_subscriptions')
        .select('status, plan_id');

      if (error) throw error;

      const { data: plans } = await supabase
        .from('plans')
        .select('id, name, price_monthly');

      // Group by plan
      const planCounts: Record<string, { name: string; count: number; revenue: number }> = {};
      
      subscriptions?.forEach(sub => {
        const plan = plans?.find(p => p.id === sub.plan_id);
        const planName = plan?.name || 'Unknown';
        
        if (!planCounts[planName]) {
          planCounts[planName] = { name: planName, count: 0, revenue: 0 };
        }
        planCounts[planName].count++;
        if (sub.status === 'active') {
          planCounts[planName].revenue += (plan?.price_monthly || 0);
        }
      });

      return Object.values(planCounts);
    },
  });

  // Fetch status distribution
  const { data: statusData, isLoading: isLoadingStatus } = useQuery({
    queryKey: ['platform-analytics-status'],
    queryFn: async () => {
      const { data: subscriptions, error } = await supabase
        .from('company_subscriptions')
        .select('status');

      if (error) throw error;

      const statusCounts: Record<string, number> = {};
      subscriptions?.forEach(sub => {
        statusCounts[sub.status] = (statusCounts[sub.status] || 0) + 1;
      });

      return Object.entries(statusCounts).map(([name, value]) => ({
        name: name.charAt(0).toUpperCase() + name.slice(1).replace('_', ' '),
        value,
      }));
    },
  });

  // Calculate MRR and other metrics
  const { data: metrics, isLoading: isLoadingMetrics } = useQuery({
    queryKey: ['platform-analytics-metrics'],
    queryFn: async () => {
      const [companiesRes, subsRes, usersRes] = await Promise.all([
        supabase.from('companies').select('id, created_at, is_active'),
        supabase.from('company_subscriptions').select('status, plan_id'),
        supabase.from('company_users').select('id, is_active'),
      ]);

      const { data: plans } = await supabase.from('plans').select('id, price_monthly');

      // Calculate MRR
      let mrr = 0;
      subsRes.data?.forEach(sub => {
        if (sub.status === 'active') {
          const plan = plans?.find(p => p.id === sub.plan_id);
          mrr += plan?.price_monthly || 0;
        }
      });

      // Calculate conversion rate (trialing -> active)
      const trialing = subsRes.data?.filter(s => s.status === 'trialing').length || 0;
      const active = subsRes.data?.filter(s => s.status === 'active').length || 0;
      const total = trialing + active;
      const conversionRate = total > 0 ? (active / total * 100) : 0;

      // Week-over-week growth
      const thisWeek = companiesRes.data?.filter(c => {
        const created = new Date(c.created_at);
        return created >= subDays(new Date(), 7);
      }).length || 0;

      const lastWeek = companiesRes.data?.filter(c => {
        const created = new Date(c.created_at);
        return created >= subDays(new Date(), 14) && created < subDays(new Date(), 7);
      }).length || 0;

      const growth = lastWeek > 0 ? ((thisWeek - lastWeek) / lastWeek * 100) : (thisWeek > 0 ? 100 : 0);

      return {
        mrr,
        conversionRate,
        growth,
        totalUsers: usersRes.data?.filter(u => u.is_active).length || 0,
        activeCompanies: companiesRes.data?.filter(c => c.is_active).length || 0,
      };
    },
  });

  const chartConfig = {
    signups: { label: 'Signups', color: 'hsl(var(--primary))' },
    total: { label: 'Total', color: 'hsl(var(--chart-2))' },
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Analytics</h2>
        <p className="text-muted-foreground">Platform-wide analytics and insights</p>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Monthly Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoadingMetrics ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <div className="text-2xl font-bold">
                  ${metrics?.mrr?.toLocaleString() || 0}
                </div>
                <p className="text-xs text-muted-foreground">MRR from active subscriptions</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
            <UserCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoadingMetrics ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <div className="text-2xl font-bold">
                  {metrics?.conversionRate?.toFixed(1) || 0}%
                </div>
                <p className="text-xs text-muted-foreground">Trial to paid</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Weekly Growth</CardTitle>
            {(metrics?.growth || 0) >= 0 ? (
              <TrendingUp className="h-4 w-4 text-green-500" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-500" />
            )}
          </CardHeader>
          <CardContent>
            {isLoadingMetrics ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <div className={`text-2xl font-bold ${(metrics?.growth || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {(metrics?.growth || 0) >= 0 ? '+' : ''}{metrics?.growth?.toFixed(1) || 0}%
                </div>
                <p className="text-xs text-muted-foreground">Week over week</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoadingMetrics ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <div className="text-2xl font-bold">{metrics?.totalUsers || 0}</div>
                <p className="text-xs text-muted-foreground">
                  Across {metrics?.activeCompanies || 0} companies
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Company Growth Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Company Signups</CardTitle>
            <CardDescription>New company registrations over the last 30 days</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingGrowth ? (
              <Skeleton className="h-[250px] w-full" />
            ) : (
              <ChartContainer config={chartConfig} className="h-[250px] w-full">
                <AreaChart data={growthData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="fillSignups" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis 
                    dataKey="date" 
                    tickLine={false} 
                    axisLine={false} 
                    tickMargin={8}
                    tick={{ fontSize: 12 }}
                    interval="preserveStartEnd"
                  />
                  <YAxis 
                    tickLine={false} 
                    axisLine={false} 
                    tickMargin={8}
                    tick={{ fontSize: 12 }}
                    allowDecimals={false}
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Area
                    type="monotone"
                    dataKey="signups"
                    stroke="hsl(var(--primary))"
                    fill="url(#fillSignups)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        {/* Subscription Status Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Subscription Status</CardTitle>
            <CardDescription>Distribution of subscription statuses</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingStatus ? (
              <Skeleton className="h-[250px] w-full" />
            ) : statusData && statusData.length > 0 ? (
              <div className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={2}
                      dataKey="value"
                      label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                      labelLine={{ stroke: 'hsl(var(--muted-foreground))' }}
                    >
                      {statusData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                No subscription data
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Revenue by Plan */}
      <Card>
        <CardHeader>
          <CardTitle>Revenue by Plan</CardTitle>
          <CardDescription>Monthly recurring revenue breakdown by subscription plan</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingSubs ? (
            <Skeleton className="h-[200px] w-full" />
          ) : subscriptionData && subscriptionData.length > 0 ? (
            <ChartContainer config={chartConfig} className="h-[200px] w-full">
              <BarChart data={subscriptionData} layout="vertical" margin={{ top: 0, right: 20, left: 80, bottom: 0 }}>
                <XAxis type="number" tickLine={false} axisLine={false} tickFormatter={(v) => `$${v}`} />
                <YAxis type="category" dataKey="name" tickLine={false} axisLine={false} width={70} />
                <ChartTooltip 
                  content={<ChartTooltipContent />}
                  formatter={(value: number) => [`$${value}`, 'Revenue']}
                />
                <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ChartContainer>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-muted-foreground">
              No revenue data
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
