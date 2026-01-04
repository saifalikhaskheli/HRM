import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Search, Building2, Users, ExternalLink, Plus, Link } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useNavigate } from 'react-router-dom';
import { CreateCompanyDialog, CreateLinkDialog } from '@/components/platform/CompanyOnboardingDialogs';
import { CompanyLinksManager } from '@/components/platform/CompanyLinksManager';

export default function PlatformCompaniesPage() {
  const [search, setSearch] = useState('');
  const [showCreateCompany, setShowCreateCompany] = useState(false);
  const [showCreateLink, setShowCreateLink] = useState(false);
  const [activeTab, setActiveTab] = useState('companies');
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // Fetch all companies with subscription info
  const { data: companies, isLoading } = useQuery({
    queryKey: ['platform-companies', search],
    queryFn: async () => {
      let query = supabase
        .from('companies')
        .select(`
          id,
          name,
          slug,
          is_active,
          created_at,
          industry,
          size_range
        `)
        .order('created_at', { ascending: false });

      if (search) {
        query = query.or(`name.ilike.%${search}%,slug.ilike.%${search}%`);
      }

      const { data: companiesData, error } = await query.limit(50);
      if (error) throw error;

      // Fetch subscriptions for these companies
      const companyIds = companiesData.map(c => c.id);
      const { data: subscriptions } = await supabase
        .from('company_subscriptions')
        .select('company_id, status, plan_id')
        .in('company_id', companyIds);

      // Fetch plans
      const { data: plans } = await supabase
        .from('plans')
        .select('id, name');

      // Fetch user counts
      const { data: userCounts } = await supabase
        .from('company_users')
        .select('company_id')
        .in('company_id', companyIds)
        .eq('is_active', true);

      // Merge data
      return companiesData.map(company => {
        const subscription = subscriptions?.find(s => s.company_id === company.id);
        const plan = plans?.find(p => p.id === subscription?.plan_id);
        const users = userCounts?.filter(u => u.company_id === company.id).length || 0;

        return {
          ...company,
          subscription_status: subscription?.status || 'none',
          plan_name: plan?.name || 'No plan',
          user_count: users,
        };
      });
    },
  });

  // Toggle company active status
  const toggleActiveMutation = useMutation({
    mutationFn: async ({ companyId, isActive }: { companyId: string; isActive: boolean }) => {
      const { error } = await supabase
        .from('companies')
        .update({ is_active: !isActive })
        .eq('id', companyId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Company status updated');
      queryClient.invalidateQueries({ queryKey: ['platform-companies'] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'trialing':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'past_due':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'canceled':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Companies</h2>
          <p className="text-muted-foreground">View and manage all companies on the platform</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => { setActiveTab('links'); setShowCreateLink(true); }}>
            <Link className="h-4 w-4 mr-2" />
            Generate Link
          </Button>
          <Button onClick={() => setShowCreateCompany(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Company
          </Button>
        </div>
      </div>

      <CreateCompanyDialog open={showCreateCompany} onOpenChange={setShowCreateCompany} />
      <CreateLinkDialog open={showCreateLink} onOpenChange={setShowCreateLink} />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="companies">
            <Building2 className="h-4 w-4 mr-2" />
            Companies
          </TabsTrigger>
          <TabsTrigger value="links">
            <Link className="h-4 w-4 mr-2" />
            Signup Links
          </TabsTrigger>
        </TabsList>

        <TabsContent value="companies" className="mt-6">
          <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>All Companies</CardTitle>
              <CardDescription>
                {companies?.length || 0} companies registered
              </CardDescription>
            </div>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search companies..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : companies?.length === 0 ? (
            <div className="text-center py-12">
              <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No companies found</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Company</TableHead>
                  <TableHead>Industry</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Subscription</TableHead>
                  <TableHead>Users</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {companies?.map((company) => (
                  <TableRow key={company.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{company.name}</p>
                        <p className="text-sm text-muted-foreground">{company.slug}</p>
                      </div>
                    </TableCell>
                    <TableCell>{company.industry || '-'}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{company.plan_name}</Badge>
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium capitalize ${getStatusColor(company.subscription_status)}`}>
                        {company.subscription_status}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        {company.user_count}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={company.is_active ? 'default' : 'secondary'}>
                        {company.is_active ? 'Active' : 'Frozen'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate(`/platform/companies/${company.id}`)}
                        >
                          <ExternalLink className="h-4 w-4 mr-1" />
                          View
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleActiveMutation.mutate({ 
                            companyId: company.id, 
                            isActive: company.is_active 
                          })}
                        >
                          {company.is_active ? 'Freeze' : 'Unfreeze'}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
        </TabsContent>

        <TabsContent value="links" className="mt-6">
          <CompanyLinksManager onCreateNew={() => setShowCreateLink(true)} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
