import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Search, Users } from 'lucide-react';
import { useState } from 'react';
import type { EmployeeLeaveBalances } from '@/hooks/useLeaveBalances';

interface LeaveBalanceTableProps {
  data: EmployeeLeaveBalances[] | undefined;
  isLoading?: boolean;
}

export function LeaveBalanceTable({ data, isLoading }: LeaveBalanceTableProps) {
  const [search, setSearch] = useState('');

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data?.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Employee Leave Balances
          </CardTitle>
          <CardDescription>View leave balances for all employees</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-8">
            No employees found.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Get unique leave types from first employee (all should have same types)
  const leaveTypes = data[0]?.balances || [];

  const filteredData = data.filter(emp =>
    emp.employeeName.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Employee Leave Balances
            </CardTitle>
            <CardDescription>
              Leave balances for {new Date().getFullYear()} ({data.length} employees)
            </CardDescription>
          </div>
          <div className="relative w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search employees..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="border rounded-md overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="sticky left-0 bg-background min-w-[180px]">Employee</TableHead>
                {leaveTypes.map((lt) => (
                  <TableHead key={lt.leaveTypeId} className="text-center min-w-[100px]">
                    <Badge 
                      variant="secondary" 
                      style={{ backgroundColor: lt.color || undefined }}
                      className="text-xs"
                    >
                      {lt.leaveTypeName}
                    </Badge>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredData.map((emp) => (
                <TableRow key={emp.employeeId}>
                  <TableCell className="sticky left-0 bg-background font-medium">
                    {emp.employeeName}
                  </TableCell>
                  {emp.balances.map((balance) => {
                    const isLow = balance.remaining <= 2 && balance.allocated > 0;
                    const isExhausted = balance.remaining <= 0 && balance.allocated > 0;
                    return (
                      <TableCell key={balance.leaveTypeId} className="text-center">
                        <span 
                          className={`font-medium ${isExhausted ? 'text-destructive' : isLow ? 'text-yellow-600' : ''}`}
                          title={`Used: ${balance.used}, Pending: ${balance.pending}`}
                        >
                          {balance.remaining}
                        </span>
                        <span className="text-muted-foreground text-xs"> / {balance.allocated}</span>
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
              {filteredData.length === 0 && (
                <TableRow>
                  <TableCell colSpan={leaveTypes.length + 1} className="text-center text-muted-foreground py-8">
                    No employees match your search.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
