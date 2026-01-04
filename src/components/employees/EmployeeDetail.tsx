import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock, Edit2, TrendingUp, Calendar, Mail, Phone, Building2, MapPin, User, GraduationCap, Briefcase, Wallet, BookOpen } from 'lucide-react';
import { format } from 'date-fns';
import type { Employee } from '@/hooks/useEmployees';
import { EducationSection } from './EducationSection';
import { ExperienceSection } from './ExperienceSection';
import { SalarySection } from './SalarySection';
import { LeaveBalanceCard } from '@/components/leave/LeaveBalanceCard';
import { useEmployeeLeaveBalances } from '@/hooks/useLeaveBalances';
import { useCurrentEmployeeShift, useEmployeeShiftAssignments } from '@/hooks/useShifts';
import { EmergencyContactSection, type EmergencyContact } from './EmergencyContactSection';
import { BankDetailsSection, type BankDetails } from './BankDetailsSection';
import { ShiftAssignmentDialog } from './ShiftAssignmentDialog';
import { PromotionDialog } from './PromotionDialog';
import { StatusIndicator, type EmployeeStatus } from './StatusIndicator';
import { DAY_LABELS, type DayOfWeek } from '@/types/shifts';
import { useLatestEmploymentHistory } from '@/hooks/useEmploymentHistory';
import { useSalaryHistory } from '@/hooks/useSalaryHistory';
import { cn } from '@/lib/utils';

interface EmployeeDetailProps {
  employee: Employee & {
    department?: { id: string; name: string } | null;
    manager?: { id: string; first_name: string; last_name: string } | null;
  };
  canEdit?: boolean;
}

export function EmployeeDetail({ employee, canEdit = false }: EmployeeDetailProps) {
  const { data: leaveBalances, isLoading: loadingBalances } = useEmployeeLeaveBalances(employee.id);
  const { data: currentShift } = useCurrentEmployeeShift(employee.id);
  const { data: shiftHistory } = useEmployeeShiftAssignments(employee.id);
  const [shiftDialogOpen, setShiftDialogOpen] = useState(false);
  const [promotionDialogOpen, setPromotionDialogOpen] = useState(false);
  
  // Get employment and salary history for promotion/increment dates
  const { lastPromotion } = useLatestEmploymentHistory(employee.id);
  const { data: salaryHistory } = useSalaryHistory(employee.id);
  
  // Find last increment from salary history
  const lastIncrement = salaryHistory?.find(s => 
    s.reason === 'Annual Increment' || s.reason === 'Promotion' || s.reason === 'Salary Adjustment'
  );

  return (
    <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-2">
      {/* Enhanced Header */}
      <div className="relative">
        {/* Status bar at top */}
        <div className={cn(
          "absolute top-0 left-0 right-0 h-1 rounded-t-lg",
          employee.employment_status === 'active' && 'bg-emerald-500',
          employee.employment_status === 'on_leave' && 'bg-amber-500',
          employee.employment_status === 'terminated' && 'bg-red-500',
          employee.employment_status === 'suspended' && 'bg-slate-400',
        )} />
        
        <Card className="border-0 shadow-none bg-gradient-to-br from-muted/30 to-muted/10 pt-2">
          <CardContent className="p-6">
            <div className="flex items-start gap-6">
              {/* Large Avatar */}
              <Avatar className="h-20 w-20 ring-4 ring-background shadow-lg">
                <AvatarFallback className="text-2xl font-semibold bg-gradient-to-br from-primary/80 to-primary text-primary-foreground">
                  {employee.first_name[0]}{employee.last_name[0]}
                </AvatarFallback>
              </Avatar>
              
              {/* Employee Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-2xl font-bold text-foreground">
                      {employee.first_name} {employee.last_name}
                    </h2>
                    <p className="text-muted-foreground text-lg">{employee.job_title || 'No title assigned'}</p>
                    <div className="flex items-center gap-3 mt-3">
                      <StatusIndicator status={employee.employment_status as EmployeeStatus} />
                      <Badge variant="outline" className="font-normal capitalize">
                        {employee.employment_type.replace('_', ' ')}
                      </Badge>
                      <Badge variant="secondary" className="font-mono text-xs">
                        {employee.employee_number}
                      </Badge>
                    </div>
                  </div>
                  
                  {canEdit && (
                    <Button onClick={() => setPromotionDialogOpen(true)} className="shrink-0">
                      <TrendingUp className="h-4 w-4 mr-2" />
                      Promote
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Quick Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="bg-card border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-primary/10 text-primary">
                <Calendar className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Hire Date</p>
                <p className="font-semibold text-foreground">{format(new Date(employee.hire_date), 'MMM d, yyyy')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-emerald-500/10 text-emerald-600">
                <TrendingUp className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Last Promotion</p>
                <p className="font-semibold text-foreground">
                  {lastPromotion ? format(new Date(lastPromotion.effective_from), 'MMM d, yyyy') : 'N/A'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-amber-500/10 text-amber-600">
                <Wallet className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Last Increment</p>
                <p className="font-semibold text-foreground">
                  {lastIncrement ? format(new Date(lastIncrement.effective_from), 'MMM d, yyyy') : 'N/A'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-blue-500/10 text-blue-600">
                <Clock className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Current Shift</p>
                <p className="font-semibold text-foreground">{currentShift?.shift?.name || 'Not assigned'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Enhanced Tabs */}
      <Tabs defaultValue="details" className="w-full">
        <TabsList className="w-full justify-start bg-muted/50 p-1 h-auto flex-wrap">
          <TabsTrigger value="details" className="gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <User className="h-4 w-4" />
            Details
          </TabsTrigger>
          <TabsTrigger value="salary" className="gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <Wallet className="h-4 w-4" />
            Salary
          </TabsTrigger>
          <TabsTrigger value="shift" className="gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <Clock className="h-4 w-4" />
            Shift
          </TabsTrigger>
          <TabsTrigger value="leave" className="gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <Calendar className="h-4 w-4" />
            Leave
            {leaveBalances && leaveBalances.length > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                {leaveBalances.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="education" className="gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <GraduationCap className="h-4 w-4" />
            Education
          </TabsTrigger>
          <TabsTrigger value="experience" className="gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <Briefcase className="h-4 w-4" />
            Experience
          </TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="space-y-6 mt-6">
          {/* Contact Information Card */}
          <Card className="border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Mail className="h-4 w-4 text-primary" />
                Contact Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Work Email</label>
                  <p className="text-foreground">{employee.email}</p>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Personal Email</label>
                  <p className="text-foreground">{employee.personal_email || '-'}</p>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Phone</label>
                  <p className="text-foreground">{employee.phone || '-'}</p>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Employee Number</label>
                  <p className="text-foreground font-mono">{employee.employee_number}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Work Information Card */}
          <Card className="border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Building2 className="h-4 w-4 text-primary" />
                Work Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Department</label>
                  <p className="text-foreground">{employee.department?.name || '-'}</p>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Manager</label>
                  <p className="text-foreground">
                    {employee.manager 
                      ? `${employee.manager.first_name} ${employee.manager.last_name}` 
                      : '-'}
                  </p>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Work Location</label>
                  <p className="text-foreground">{employee.work_location || '-'}</p>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Hire Date</label>
                  <p className="text-foreground">{format(new Date(employee.hire_date), 'MMMM d, yyyy')}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Personal Information */}
          {employee.date_of_birth && (
            <Card className="border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <User className="h-4 w-4 text-primary" />
                  Personal Information
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Date of Birth</label>
                    <p className="text-foreground">{format(new Date(employee.date_of_birth), 'MMMM d, yyyy')}</p>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Gender</label>
                    <p className="text-foreground capitalize">{employee.gender || '-'}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Emergency Contact */}
          {employee.emergency_contact && Object.keys(employee.emergency_contact).length > 0 && (
            <EmergencyContactSection
              value={employee.emergency_contact as EmergencyContact}
              onChange={() => {}}
              disabled
            />
          )}

          {/* Bank Details */}
          {employee.bank_details && Object.keys(employee.bank_details).length > 0 && (
            <BankDetailsSection
              value={employee.bank_details as BankDetails}
              onChange={() => {}}
              disabled
            />
          )}
        </TabsContent>

        <TabsContent value="salary" className="mt-6">
          <SalarySection employeeId={employee.id} canEdit={canEdit} />
        </TabsContent>

        <TabsContent value="shift" className="mt-6 space-y-4">
          <Card className="border-border/50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" />
                Current Shift
              </CardTitle>
              {canEdit && (
                <Button variant="outline" size="sm" onClick={() => setShiftDialogOpen(true)}>
                  <Edit2 className="h-4 w-4 mr-2" />
                  Change Shift
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {currentShift ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-foreground text-lg">{currentShift.shift.name}</span>
                    {currentShift.is_temporary && (
                      <Badge variant="outline" className="text-amber-600 border-amber-300">Temporary</Badge>
                    )}
                  </div>
                  <div className="text-muted-foreground">
                    {format(new Date(`2000-01-01T${currentShift.shift.start_time}`), 'h:mm a')} - {format(new Date(`2000-01-01T${currentShift.shift.end_time}`), 'h:mm a')}
                  </div>
                  <div className="flex gap-4 text-sm text-muted-foreground">
                    <span>Break: {currentShift.shift.break_duration_minutes} min</span>
                    <span>Grace: {currentShift.shift.grace_period_minutes} min</span>
                  </div>
                  <div className="flex gap-1.5 flex-wrap mt-3">
                    {(currentShift.shift.applicable_days as DayOfWeek[]).map((day) => (
                      <Badge key={day} variant="secondary" className="text-xs font-normal">
                        {DAY_LABELS[day]}
                      </Badge>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-3 pt-3 border-t border-border/50">
                    Effective since {format(new Date(currentShift.effective_from), 'MMM d, yyyy')}
                    {currentShift.effective_to && ` until ${format(new Date(currentShift.effective_to), 'MMM d, yyyy')}`}
                  </p>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No shift assigned</p>
                </div>
              )}
            </CardContent>
          </Card>

          {shiftHistory && shiftHistory.length > 1 && (
            <Card className="border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-primary" />
                  Shift History
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {shiftHistory.slice(1).map((assignment) => (
                    <div key={assignment.id} className="flex items-center justify-between py-3 border-b border-border/50 last:border-0">
                      <div>
                        <p className="font-medium text-foreground">{assignment.shift.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(assignment.effective_from), 'MMM d, yyyy')}
                          {assignment.effective_to && ` - ${format(new Date(assignment.effective_to), 'MMM d, yyyy')}`}
                        </p>
                      </div>
                      {assignment.is_temporary && (
                        <Badge variant="outline" className="text-xs">Temporary</Badge>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <ShiftAssignmentDialog
            open={shiftDialogOpen}
            onOpenChange={setShiftDialogOpen}
            employeeId={employee.id}
            employeeName={`${employee.first_name} ${employee.last_name}`}
          />
        </TabsContent>

        <TabsContent value="leave" className="mt-6">
          <LeaveBalanceCard 
            balances={leaveBalances} 
            isLoading={loadingBalances}
            title={`${employee.first_name}'s Leave Balances`}
          />
        </TabsContent>

        <TabsContent value="education" className="mt-6">
          <EducationSection employeeId={employee.id} canEdit={canEdit} />
        </TabsContent>

        <TabsContent value="experience" className="mt-6">
          <ExperienceSection employeeId={employee.id} canEdit={canEdit} />
        </TabsContent>
      </Tabs>
      
      <PromotionDialog
        open={promotionDialogOpen}
        onOpenChange={setPromotionDialogOpen}
        employee={employee}
      />
    </div>
  );
}
