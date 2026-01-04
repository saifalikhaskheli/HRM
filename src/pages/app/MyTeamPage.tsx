import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useMyTeam, useTeamStats } from '@/hooks/useMyTeam';
import { useTeamDocuments } from '@/hooks/useDocuments';
import { useTeamExpenses, useApproveExpense, useRejectExpense } from '@/hooks/useExpenses';
import { TeamAbsenceCalendar } from '@/components/team/TeamAbsenceCalendar';
import { Users, Calendar, UserCheck, Clock, AlertCircle, FileText, Receipt, Check, X, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';

export default function MyTeamPage() {
  const { data: team, isLoading: teamLoading, refetch: refetchTeam, isFetching } = useMyTeam();
  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useTeamStats();

  const handleRefresh = () => {
    refetchTeam();
    refetchStats();
  };

  const statItems = [
    { 
      label: 'Team Size', 
      value: stats?.teamSize ?? 0, 
      icon: Users, 
      color: 'text-blue-500' 
    },
    { 
      label: 'Pending Approvals', 
      value: stats?.pendingApprovals ?? 0, 
      icon: Clock, 
      color: 'text-amber-500' 
    },
    { 
      label: 'Out Today', 
      value: stats?.outToday ?? 0, 
      icon: Calendar, 
      color: 'text-green-500' 
    },
  ];

  if (teamLoading) {
    return (
      <div className="p-4 md:p-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (!team || team.length === 0) {
    return (
      <div className="p-4 md:p-6">
        <h1 className="text-2xl font-bold mb-6">My Team</h1>
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No Direct Reports</h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              You don't have any direct reports assigned to you. If you're a manager, make sure employees have you set as their manager, or that you're assigned as a department manager.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">My Team</h1>
          <p className="text-muted-foreground">Manage your direct reports</p>
        </div>
        <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isFetching}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {statItems.map((stat) => (
          <Card key={stat.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardDescription>{stat.label}</CardDescription>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className="text-2xl font-bold">{stat.value}</div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Who's Out Today Banner */}
      {stats && stats.outToday > 0 && (
        <Card className="border-amber-500/50 bg-amber-500/5">
          <CardContent className="py-3">
            <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
              <AlertCircle className="h-4 w-4" />
              <span className="font-medium">Out Today:</span>
              <span>{stats.onLeaveToday.join(', ')}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs for Team List, Calendar, Documents, Expenses */}
      <Tabs defaultValue="team">
        <TabsList>
          <TabsTrigger value="team" className="gap-2">
            <Users className="h-4 w-4" />
            Team
          </TabsTrigger>
          <TabsTrigger value="calendar" className="gap-2">
            <Calendar className="h-4 w-4" />
            Calendar
          </TabsTrigger>
          <TabsTrigger value="documents" className="gap-2">
            <FileText className="h-4 w-4" />
            Documents
          </TabsTrigger>
          <TabsTrigger value="expenses" className="gap-2">
            <Receipt className="h-4 w-4" />
            Expenses
          </TabsTrigger>
        </TabsList>

        <TabsContent value="team" className="mt-4">
          <TeamMembersList team={team} />
        </TabsContent>

        <TabsContent value="calendar" className="mt-4">
          <TeamAbsenceCalendar />
        </TabsContent>

        <TabsContent value="documents" className="mt-4">
          <TeamDocumentsTab />
        </TabsContent>

        <TabsContent value="expenses" className="mt-4">
          <TeamExpensesTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function TeamMembersList({ team }: { team: any[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Direct Reports</CardTitle>
        <CardDescription>Your team members and their status</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="divide-y">
          {team.map((member) => (
            <div key={member.id} className="py-4 first:pt-0 last:pb-0">
              <div className="flex items-center gap-4">
                <Avatar>
                  <AvatarFallback>{member.first_name[0]}{member.last_name[0]}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{member.first_name} {member.last_name}</span>
                    {member.is_on_leave && <Badge variant="secondary" className="text-xs">On Leave</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground truncate">
                    {member.job_title || 'No title'} {member.department?.name && ` • ${member.department.name}`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {member.pending_leave_count > 0 && (
                    <Badge variant="outline" className="gap-1"><Clock className="h-3 w-3" />{member.pending_leave_count} leave</Badge>
                  )}
                  {member.pending_expense_count > 0 && (
                    <Badge variant="outline" className="gap-1">{member.pending_expense_count} expense</Badge>
                  )}
                  <Badge variant={member.employment_status === 'active' ? 'default' : 'secondary'} className="capitalize">
                    {member.employment_status === 'active' ? <><UserCheck className="h-3 w-3 mr-1" /> Active</> : member.employment_status}
                  </Badge>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function TeamDocumentsTab() {
  const { data: documents, isLoading } = useTeamDocuments();

  if (isLoading) return <Skeleton className="h-48" />;
  if (!documents?.length) return (
    <Card><CardContent className="py-12 text-center text-muted-foreground"><FileText className="h-8 w-8 mx-auto mb-2 opacity-50" /><p>No team documents</p></CardContent></Card>
  );

  return (
    <Card>
      <CardHeader><CardTitle>Team Documents</CardTitle><CardDescription>Read-only view of direct reports' documents</CardDescription></CardHeader>
      <CardContent>
        <Table>
          <TableHeader><TableRow><TableHead>Employee</TableHead><TableHead>Document</TableHead><TableHead>Type</TableHead><TableHead>Date</TableHead></TableRow></TableHeader>
          <TableBody>
            {documents.slice(0, 20).map((doc: any) => (
              <TableRow key={doc.id}>
                <TableCell>{doc.employee?.first_name} {doc.employee?.last_name}</TableCell>
                <TableCell className="font-medium">{doc.title}</TableCell>
                <TableCell>{doc.document_type?.name || '-'}</TableCell>
                <TableCell>{format(new Date(doc.created_at), 'MMM d, yyyy')}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function TeamExpensesTab() {
  const { data: expenses, isLoading } = useTeamExpenses('pending');
  const approveExpense = useApproveExpense();
  const rejectExpense = useRejectExpense();

  if (isLoading) return <Skeleton className="h-48" />;
  if (!expenses?.length) return (
    <Card><CardContent className="py-12 text-center text-muted-foreground"><Receipt className="h-8 w-8 mx-auto mb-2 opacity-50" /><p>No pending expense claims</p></CardContent></Card>
  );

  return (
    <Card>
      <CardHeader><CardTitle>Pending Expenses</CardTitle><CardDescription>Approve or reject expense claims from your team</CardDescription></CardHeader>
      <CardContent>
        <Table>
          <TableHeader><TableRow><TableHead>Employee</TableHead><TableHead>Description</TableHead><TableHead>Amount</TableHead><TableHead>Date</TableHead><TableHead></TableHead></TableRow></TableHeader>
          <TableBody>
            {expenses.map((expense: any) => (
              <TableRow key={expense.id}>
                <TableCell>{expense.employee?.first_name} {expense.employee?.last_name}</TableCell>
                <TableCell className="max-w-xs truncate">{expense.description}</TableCell>
                <TableCell className="font-medium">{expense.currency} {expense.amount.toFixed(2)}</TableCell>
                <TableCell>{format(new Date(expense.expense_date), 'MMM d')}</TableCell>
                <TableCell className="text-right">
                  <div className="flex gap-1 justify-end">
                    <Button size="sm" variant="ghost" onClick={() => approveExpense.mutate(expense.id)} disabled={approveExpense.isPending}>
                      <Check className="h-4 w-4 text-green-600" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => rejectExpense.mutate({ expenseId: expense.id, reason: 'Rejected by manager' })} disabled={rejectExpense.isPending}>
                      <X className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
