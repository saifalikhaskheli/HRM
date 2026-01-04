import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Building2, Users, CreditCard, TrendingUp, TrendingDown, DollarSign, Gift } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';
import { subDays } from 'date-fns';

export default function PlatformDashboardPage() {
  const navigate = useNavigate();
  
  const { data: stats, isLoading } = useQuery({
    queryKey: ['platform-stats'],
    queryFn: async () => {
      const [companiesRes, subscriptionsRes, platformAdminsRes, plansRes] = await Promise.all([
        supabase.from('companies').select('id, is_active, created_at'),
        supabase.from('company_subscriptions').select('id, status, plan_id'),
        supabase.from('platform_admins').select('id, is_active'),
        supabase.from('plans').select('id, price_monthly'),
      ]);

      const companies = companiesRes.data || [];
      const activeCompanies = companies.filter(c => c.is_active).length;
      const totalCompanies = companies.length;
      
      const subscriptions = subscriptionsRes.data || [];
      const activeSubscriptions = subscriptions.filter(s => s.status === 'active' || s.status === 'trialing').length;
      const platformAdmins = platformAdminsRes.data?.filter(p => p.is_active).length || 0;

      // Calculate MRR
      let mrr = 0;
      subscriptions.forEach(sub => {
        if (sub.status === 'active') {
          const plan = plansRes.data?.find(p => p.id === sub.plan_id);
          mrr += plan?.price_monthly || 0;
        }
      });

      // Calculate week-over-week growth
      const thisWeek = companies.filter(c => {
        const created = new Date(c.created_at);
        return created >= subDays(new Date(), 7);
      }).length;

      const lastWeek = companies.filter(c => {
        const created = new Date(c.created_at);
        return created >= subDays(new Date(), 14) && created < subDays(new Date(), 7);
      }).length;

      const growth = lastWeek > 0 
        ? ((thisWeek - lastWeek) / lastWeek * 100) 
        : (thisWeek > 0 ? 100 : 0);

      return {
        totalCompanies,
        activeCompanies,
        activeSubscriptions,
        platformAdmins,
        mrr,
        growth,
        thisWeek,
      };
    },
  });

  const { data: recentCompanies, isLoading: isLoadingRecent } = useQuery({
    queryKey: ['recent-companies'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('companies')
        .select('id, name, slug, created_at, is_active')
        .order('created_at', { ascending: false })
        .limit(5);

      if (error) throw error;
      return data;
    },
  });

  // Fetch companies needing attention (trialing, expiring soon)
  const { data: attentionItems } = useQuery({
    queryKey: ['attention-items'],
    queryFn: async () => {
      const sevenDaysFromNow = new Date();
      sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

      const { data: expiringTrials, error } = await supabase
        .from('company_subscriptions')
        .select('company_id, trial_ends_at, companies(name)')
        .eq('status', 'trialing')
        .lte('trial_ends_at', sevenDaysFromNow.toISOString())
        .gte('trial_ends_at', new Date().toISOString())
        .limit(5);

      if (error) throw error;

      const { data: pastDue } = await supabase
        .from('company_subscriptions')
        .select('company_id, companies(name)')
        .eq('status', 'past_due')
        .limit(5);

      return {
        expiringTrials: expiringTrials || [],
        pastDue: pastDue || [],
      };
    },
  });

  // Fetch pending trial extension requests
  const { data: pendingExtensions } = useQuery({
    queryKey: ['pending-extension-requests'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('trial_extension_requests')
        .select('id, company_id, requested_days, reason, created_at, companies(name)')
        .eq('status', 'pending')
        .order('created_at', { ascending: true })
        .limit(5);

      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Platform Overview</h2>
        <p className="text-muted-foreground">Monitor and manage your SaaS platform</p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Companies</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <>
                <div className="text-2xl font-bold">{stats?.totalCompanies}</div>
                <p className="text-xs text-muted-foreground">
                  {stats?.activeCompanies} active
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Subscriptions</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <>
                <div className="text-2xl font-bold">{stats?.activeSubscriptions}</div>
                <p className="text-xs text-muted-foreground">
                  Paid & trialing
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Monthly Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <>
                <div className="text-2xl font-bold">${stats?.mrr?.toLocaleString() || 0}</div>
                <p className="text-xs text-muted-foreground">
                  MRR
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Weekly Growth</CardTitle>
            {(stats?.growth || 0) >= 0 ? (
              <TrendingUp className="h-4 w-4 text-green-500" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-500" />
            )}
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <>
                <div className={`text-2xl font-bold ${(stats?.growth || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {(stats?.growth || 0) >= 0 ? '+' : ''}{stats?.growth?.toFixed(0) || 0}%
                </div>
                <p className="text-xs text-muted-foreground">
                  {stats?.thisWeek || 0} new this week
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Companies */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Companies</CardTitle>
            <CardDescription>Latest companies registered on the platform</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingRecent ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : recentCompanies?.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No companies yet</p>
            ) : (
              <div className="space-y-3">
                {recentCompanies?.map((company) => (
                  <div
                    key={company.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/50 cursor-pointer transition-colors"
                    onClick={() => navigate(`/platform/companies/${company.id}`)}
                  >
                    <div>
                      <p className="font-medium text-foreground">{company.name}</p>
                      <p className="text-sm text-muted-foreground">{company.slug}</p>
                    </div>
                    <div className="text-right">
                      <Badge variant={company.is_active ? 'default' : 'secondary'}>
                        {company.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(company.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Attention Needed */}
        <Card>
          <CardHeader>
            <CardTitle>Needs Attention</CardTitle>
            <CardDescription>Companies requiring action</CardDescription>
          </CardHeader>
          <CardContent>
            {!attentionItems ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : (attentionItems.expiringTrials.length === 0 && attentionItems.pastDue.length === 0 && (!pendingExtensions || pendingExtensions.length === 0)) ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">All good! No immediate action needed.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Pending Extension Requests */}
                {pendingExtensions?.map((item: any) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-purple-200 bg-purple-50 dark:border-purple-900 dark:bg-purple-950 cursor-pointer"
                    onClick={() => navigate(`/platform/companies/${item.company_id}`)}
                  >
                    <div className="flex items-center gap-2">
                      <Gift className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                      <div>
                        <p className="font-medium">{item.companies?.name}</p>
                        <p className="text-sm text-muted-foreground">
                          Requested {item.requested_days} day extension
                        </p>
                      </div>
                    </div>
                    <Badge variant="outline" className="border-purple-500 text-purple-700 dark:text-purple-300">
                      Extension
                    </Badge>
                  </div>
                ))}
                {attentionItems.expiringTrials.map((item: any) => (
                  <div
                    key={item.company_id}
                    className="flex items-center justify-between p-3 rounded-lg border border-yellow-200 bg-yellow-50 dark:border-yellow-900 dark:bg-yellow-950 cursor-pointer"
                    onClick={() => navigate(`/platform/companies/${item.company_id}`)}
                  >
                    <div>
                      <p className="font-medium">{item.companies?.name}</p>
                      <p className="text-sm text-muted-foreground">
                        Trial expires {new Date(item.trial_ends_at).toLocaleDateString()}
                      </p>
                    </div>
                    <Badge variant="outline" className="border-yellow-500 text-yellow-700 dark:text-yellow-300">
                      Expiring
                    </Badge>
                  </div>
                ))}
                {attentionItems.pastDue.map((item: any) => (
                  <div
                    key={item.company_id}
                    className="flex items-center justify-between p-3 rounded-lg border border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950 cursor-pointer"
                    onClick={() => navigate(`/platform/companies/${item.company_id}`)}
                  >
                    <div>
                      <p className="font-medium">{item.companies?.name}</p>
                      <p className="text-sm text-muted-foreground">Payment failed</p>
                    </div>
                    <Badge variant="destructive">Past Due</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
