import { useState, useMemo } from 'react';
import { useTenant } from '@/contexts/TenantContext';
import { ModuleGuard } from '@/components/ModuleGuard';
import { 
  useMyExpenses, 
  useAllExpenses, 
  useExpenseCategories,
  useCreateExpense,
  useApproveExpense,
  useRejectExpense,
  useDeleteExpense,
  useCreateExpenseCategory,
  type Expense 
} from '@/hooks/useExpenses';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { format } from 'date-fns';
import { Plus, Receipt, Check, X, Trash2, Settings } from 'lucide-react';
import { getStatusColor, formatStatus } from '@/lib/status-utils';
import { TablePagination } from '@/components/ui/table-pagination';
import { useLocalization, CURRENCY_CONFIG } from '@/contexts/LocalizationContext';

const PAGE_SIZE = 10;

const expenseSchema = z.object({
  category_id: z.string().min(1, 'Category is required'),
  amount: z.coerce.number().positive('Amount must be positive'),
  currency: z.string().default('USD'),
  expense_date: z.string().min(1, 'Date is required'),
  description: z.string().min(1, 'Description is required'),
});

const categorySchema = z.object({
  name: z.string().min(1, 'Name is required'),
  code: z.string().min(1, 'Code is required'),
  description: z.string().optional(),
  budget_limit: z.coerce.number().optional(),
});

type ExpenseFormValues = z.infer<typeof expenseSchema>;
type CategoryFormValues = z.infer<typeof categorySchema>;

function ExpenseStatusBadge({ status }: { status: string }) {
  const colorClass = getStatusColor(status, 'expense');
  return <Badge className={colorClass}>{formatStatus(status)}</Badge>;
}

function ExpenseForm({ onSuccess }: { onSuccess: () => void }) {
  const { data: categories = [] } = useExpenseCategories();
  const createExpense = useCreateExpense();
  const { settings } = useLocalization();
  
  type ExpenseFormData = {
    category_id: string;
    amount: number;
    currency: string;
    expense_date: string;
    description: string;
  };
  
  const form = useForm<ExpenseFormValues>({
    resolver: zodResolver(expenseSchema),
    defaultValues: {
      currency: settings.currency,
      expense_date: format(new Date(), 'yyyy-MM-dd'),
    },
  });

  const onSubmit = (values: ExpenseFormValues) => {
    const data: ExpenseFormData = {
      category_id: values.category_id,
      amount: values.amount,
      currency: values.currency,
      expense_date: values.expense_date,
      description: values.description,
    };
    createExpense.mutate(data, {
      onSuccess: () => {
        form.reset();
        onSuccess();
      },
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="category_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Category</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="amount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Amount</FormLabel>
                <FormControl>
                  <Input type="number" step="0.01" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="currency"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Currency</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                <SelectContent>
                    {Object.entries(CURRENCY_CONFIG).map(([code, config]) => (
                      <SelectItem key={code} value={code}>
                        {code} ({config.symbol})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="expense_date"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Date</FormLabel>
              <FormControl>
                <Input type="date" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Textarea {...field} placeholder="Describe the expense..." />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" className="w-full" disabled={createExpense.isPending}>
          {createExpense.isPending ? 'Submitting...' : 'Submit Expense'}
        </Button>
      </form>
    </Form>
  );
}

function ExpenseTable({ 
  expenses, 
  showEmployee = false,
  showActions = false,
  currentPage,
  onPageChange,
}: { 
  expenses: Expense[];
  showEmployee?: boolean;
  showActions?: boolean;
  currentPage: number;
  onPageChange: (page: number) => void;
}) {
  const approveExpense = useApproveExpense();
  const rejectExpense = useRejectExpense();
  const deleteExpense = useDeleteExpense();
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const paginatedExpenses = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return expenses.slice(start, start + PAGE_SIZE);
  }, [expenses, currentPage]);

  const handleReject = (id: string) => {
    rejectExpense.mutate({ expenseId: id, reason: rejectReason }, {
      onSuccess: () => {
        setRejectingId(null);
        setRejectReason('');
      },
    });
  };

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            {showEmployee && <TableHead>Employee</TableHead>}
            <TableHead>Category</TableHead>
            <TableHead>Description</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead>Status</TableHead>
            {showActions && <TableHead className="text-right">Actions</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {paginatedExpenses.length === 0 ? (
            <TableRow>
              <TableCell colSpan={showEmployee ? 7 : 6} className="text-center py-8 text-muted-foreground">
                No expenses found
              </TableCell>
            </TableRow>
          ) : (
            paginatedExpenses.map((expense) => (
              <TableRow key={expense.id}>
                <TableCell>{format(new Date(expense.expense_date), 'MMM d, yyyy')}</TableCell>
                {showEmployee && (
                  <TableCell>
                    {expense.employee?.first_name} {expense.employee?.last_name}
                  </TableCell>
                )}
                <TableCell>{expense.category?.name || '-'}</TableCell>
                <TableCell className="max-w-xs truncate">{expense.description}</TableCell>
                <TableCell className="text-right font-medium">
                  {CURRENCY_CONFIG[expense.currency]?.symbol || expense.currency} {expense.amount.toFixed(2)}
                </TableCell>
                <TableCell>
                  <ExpenseStatusBadge status={expense.status} />
                </TableCell>
                {showActions && (
                  <TableCell className="text-right">
                    {expense.status === 'pending' && (
                      <div className="flex gap-1 justify-end">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => approveExpense.mutate(expense.id)}
                          disabled={approveExpense.isPending}
                        >
                          <Check className="h-4 w-4 text-green-600" />
                        </Button>
                        <Dialog open={rejectingId === expense.id} onOpenChange={(open) => !open && setRejectingId(null)}>
                          <DialogTrigger asChild>
                            <Button size="sm" variant="ghost" onClick={() => setRejectingId(expense.id)}>
                              <X className="h-4 w-4 text-destructive" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Reject Expense</DialogTitle>
                              <DialogDescription>Provide a reason for rejection</DialogDescription>
                            </DialogHeader>
                            <Textarea
                              value={rejectReason}
                              onChange={(e) => setRejectReason(e.target.value)}
                              placeholder="Reason for rejection..."
                            />
                            <DialogFooter>
                              <Button variant="outline" onClick={() => setRejectingId(null)}>Cancel</Button>
                              <Button variant="destructive" onClick={() => handleReject(expense.id)}>
                                Reject
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => deleteExpense.mutate(expense.id)}
                          disabled={deleteExpense.isPending}
                        >
                          <Trash2 className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </div>
                    )}
                  </TableCell>
                )}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
      <TablePagination
        currentPage={currentPage}
        totalItems={expenses.length}
        pageSize={PAGE_SIZE}
        onPageChange={onPageChange}
      />
    </>
  );
}

function CategoryManager() {
  const { data: categories = [] } = useExpenseCategories();
  const createCategory = useCreateExpenseCategory();
  const [open, setOpen] = useState(false);

  const form = useForm<CategoryFormValues>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      name: '',
      code: '',
      description: '',
    },
  });

  const onSubmit = (values: CategoryFormValues) => {
    const data = {
      name: values.name,
      code: values.code,
      description: values.description,
      budget_limit: values.budget_limit,
    };
    createCategory.mutate(data, {
      onSuccess: () => {
        form.reset();
        setOpen(false);
      },
    });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-lg">Expense Categories</CardTitle>
          <CardDescription>Manage expense categories for your company</CardDescription>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-1" />
              Add Category
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Category</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Travel" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Code</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="TRAVEL" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Optional description" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="budget_limit"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Budget Limit (optional)</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} placeholder="1000" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full" disabled={createCategory.isPending}>
                  {createCategory.isPending ? 'Creating...' : 'Create Category'}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Code</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="text-right">Budget Limit</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {categories.map((cat) => (
              <TableRow key={cat.id}>
                <TableCell className="font-medium">{cat.name}</TableCell>
                <TableCell>{cat.code}</TableCell>
                <TableCell className="text-muted-foreground">{cat.description || '-'}</TableCell>
                <TableCell className="text-right">
                  {cat.budget_limit ? cat.budget_limit.toLocaleString() : '-'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export default function ExpensesPage() {
  const { isAdmin, isHR } = useTenant();
  const { data: myExpenses = [], isLoading: loadingMy } = useMyExpenses();
  const { data: allExpenses = [], isLoading: loadingAll } = useAllExpenses();
  const { data: pendingExpenses = [] } = useAllExpenses('pending');
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [myExpensesPage, setMyExpensesPage] = useState(1);
  const [allExpensesPage, setAllExpensesPage] = useState(1);
  const [pendingPage, setPendingPage] = useState(1);

  return (
    <ModuleGuard moduleId="expenses">
      <div className="p-4 md:p-6 space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Expenses</h1>
            <p className="text-muted-foreground">Submit and manage expense claims</p>
          </div>
          <Dialog open={showExpenseForm} onOpenChange={setShowExpenseForm}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Submit Expense
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Submit Expense</DialogTitle>
                <DialogDescription>Submit a new expense for reimbursement</DialogDescription>
              </DialogHeader>
              <ExpenseForm onSuccess={() => setShowExpenseForm(false)} />
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">My Pending</CardTitle>
              <Receipt className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {myExpenses.filter(e => e.status === 'pending').length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">My Approved</CardTitle>
              <Check className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {myExpenses.filter(e => e.status === 'approved').length}
              </div>
            </CardContent>
          </Card>
          {(isAdmin || isHR) && (
            <>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Pending Approval</CardTitle>
                  <Receipt className="h-4 w-4 text-amber-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{pendingExpenses.length}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total This Month</CardTitle>
                  <Receipt className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    ${allExpenses
                      .filter(e => e.status === 'approved' || e.status === 'reimbursed')
                      .reduce((sum, e) => sum + e.amount, 0)
                      .toFixed(2)}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>

        <Tabs defaultValue="my-expenses" className="space-y-4">
          <TabsList>
            <TabsTrigger value="my-expenses">My Expenses</TabsTrigger>
            {(isAdmin || isHR) && (
              <>
                <TabsTrigger value="all-expenses">All Expenses</TabsTrigger>
                <TabsTrigger value="pending">Pending Approval ({pendingExpenses.length})</TabsTrigger>
                <TabsTrigger value="categories">
                  <Settings className="h-4 w-4 mr-1" />
                  Categories
                </TabsTrigger>
              </>
            )}
          </TabsList>

          <TabsContent value="my-expenses">
            <Card>
              <CardHeader>
                <CardTitle>My Expense Claims</CardTitle>
              </CardHeader>
              <CardContent>
                {loadingMy ? (
                  <div className="text-center py-8 text-muted-foreground">Loading...</div>
                ) : (
                  <ExpenseTable expenses={myExpenses} currentPage={myExpensesPage} onPageChange={setMyExpensesPage} />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {(isAdmin || isHR) && (
            <>
              <TabsContent value="all-expenses">
                <Card>
                  <CardHeader>
                    <CardTitle>All Expenses</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {loadingAll ? (
                      <div className="text-center py-8 text-muted-foreground">Loading...</div>
                    ) : (
                      <ExpenseTable expenses={allExpenses} showEmployee showActions currentPage={allExpensesPage} onPageChange={setAllExpensesPage} />
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="pending">
                <Card>
                  <CardHeader>
                    <CardTitle>Pending Approval</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ExpenseTable expenses={pendingExpenses} showEmployee showActions currentPage={pendingPage} onPageChange={setPendingPage} />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="categories">
                <CategoryManager />
              </TabsContent>
            </>
          )}
        </Tabs>
      </div>
    </ModuleGuard>
  );
}
