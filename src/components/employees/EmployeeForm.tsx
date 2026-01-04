import { useForm } from 'react-hook-form';
import { useEffect, useState, useMemo } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Loader2, Scan, Clock, DollarSign, Users, User, Briefcase, Shield, Building2, Phone, CreditCard } from 'lucide-react';
import { useCreateEmployee, useUpdateEmployee, useEmployees, type Employee } from '@/hooks/useEmployees';
import { useDepartments } from '@/hooks/useDepartments';
import { useNextEmployeeNumber } from '@/hooks/useEmployeeNumber';
import { useActiveShifts, useAssignShift, useDefaultShift, useEnsureDefaultShift } from '@/hooks/useShifts';
import { useAddSalary } from '@/hooks/useSalaryHistory';
import { DocumentScanDialog } from './DocumentScanDialog';
import { EmergencyContactSection, type EmergencyContact } from './EmergencyContactSection';
import { BankDetailsSection, type BankDetails } from './BankDetailsSection';
import { AccordionFormSection, FormProgress } from './AccordionFormSection';
import type { ExtractedData } from '@/hooks/useOCR';
import { format } from 'date-fns';

const employeeSchema = z.object({
  first_name: z.string().min(1, 'First name is required'),
  last_name: z.string().min(1, 'Last name is required'),
  email: z.string().email('Valid email is required'),
  employee_number: z.string().min(1, 'Employee number is required'),
  hire_date: z.string().min(1, 'Hire date is required'),
  job_title: z.string().optional(),
  department_id: z.string().optional(),
  manager_id: z.string().optional(),
  shift_id: z.string().optional(),
  employment_type: z.enum(['full_time', 'part_time', 'contract', 'intern', 'temporary']),
  employment_status: z.enum(['active', 'on_leave', 'terminated', 'suspended']),
  phone: z.string().optional(),
  personal_email: z.string().email().optional().or(z.literal('')),
  work_location: z.string().optional(),
  national_id: z.string().optional(),
  date_of_birth: z.string().optional(),
  gender: z.string().optional(),
  // Salary fields for new employees
  initial_salary: z.coerce.number().optional(),
  salary_currency: z.string().optional(),
});

type EmployeeFormValues = z.infer<typeof employeeSchema>;

interface EmployeeFormProps {
  employee?: Employee | null;
  onSuccess: () => void;
  onCancel: () => void;
}

export function EmployeeForm({ employee, onSuccess, onCancel }: EmployeeFormProps) {
  const createEmployee = useCreateEmployee();
  const updateEmployee = useUpdateEmployee();
  const { data: departments } = useDepartments();
  const { data: shifts } = useActiveShifts();
  const { data: defaultShift } = useDefaultShift();
  const ensureDefaultShift = useEnsureDefaultShift();
  const assignShift = useAssignShift();
  const addSalary = useAddSalary();
  const { data: nextEmployeeNumber, isLoading: isLoadingNumber } = useNextEmployeeNumber();
  const { data: allEmployees } = useEmployees();
  const [scanDialogOpen, setScanDialogOpen] = useState(false);
  const [emergencyContact, setEmergencyContact] = useState<EmergencyContact>(
    (employee?.emergency_contact as EmergencyContact) || {}
  );
  const [bankDetails, setBankDetails] = useState<BankDetails>(
    (employee?.bank_details as BankDetails) || {}
  );

  // Get potential managers (all employees except the current one being edited)
  const potentialManagers = allEmployees?.filter(e => 
    e.id !== employee?.id && e.employment_status === 'active'
  ) || [];
  
  const isEditing = !!employee;
  const isLoading = createEmployee.isPending || updateEmployee.isPending || assignShift.isPending || addSalary.isPending;

  const form = useForm<EmployeeFormValues>({
    resolver: zodResolver(employeeSchema),
    defaultValues: {
      first_name: employee?.first_name || '',
      last_name: employee?.last_name || '',
      email: employee?.email || '',
      employee_number: employee?.employee_number || '',
      hire_date: employee?.hire_date || new Date().toISOString().split('T')[0],
      job_title: employee?.job_title || '',
      department_id: employee?.department_id || '',
      manager_id: employee?.manager_id || '',
      shift_id: '',
      employment_type: employee?.employment_type || 'full_time',
      employment_status: employee?.employment_status || 'active',
      phone: employee?.phone || '',
      personal_email: employee?.personal_email || '',
      work_location: employee?.work_location || '',
      national_id: employee?.national_id || '',
      date_of_birth: employee?.date_of_birth || '',
      gender: employee?.gender || '',
      // Salary defaults
      initial_salary: undefined,
      salary_currency: 'USD',
    },
  });

  const watchedValues = form.watch();

  // Calculate section completion status
  const sectionStatus = useMemo(() => {
    return {
      basic: !!(watchedValues.first_name && watchedValues.last_name && watchedValues.email && watchedValues.employee_number),
      employment: !!(watchedValues.hire_date && watchedValues.employment_type),
      personal: !!(watchedValues.phone || watchedValues.date_of_birth),
      salary: !isEditing ? !!(watchedValues.initial_salary && watchedValues.initial_salary > 0) : true,
      emergency: !!(emergencyContact.name && emergencyContact.phone),
      bank: !!(bankDetails.account_holder && bankDetails.account_number),
    };
  }, [watchedValues, emergencyContact, bankDetails, isEditing]);

  const sections = [
    { id: 'basic', label: 'Basic Info', isComplete: sectionStatus.basic },
    { id: 'employment', label: 'Employment', isComplete: sectionStatus.employment },
    { id: 'personal', label: 'Personal', isComplete: sectionStatus.personal },
    ...(!isEditing ? [{ id: 'salary', label: 'Salary', isComplete: sectionStatus.salary }] : []),
    { id: 'emergency', label: 'Emergency', isComplete: sectionStatus.emergency },
    { id: 'bank', label: 'Bank', isComplete: sectionStatus.bank },
  ];

  // Pre-select default shift for new employees
  useEffect(() => {
    if (!isEditing && defaultShift && !form.getValues('shift_id')) {
      form.setValue('shift_id', defaultShift.id);
    }
  }, [isEditing, defaultShift, form]);

  // Ensure default shift exists
  useEffect(() => {
    if (!isEditing && shifts && shifts.length === 0) {
      ensureDefaultShift.mutate();
    }
  }, [isEditing, shifts]);

  // Auto-populate employee number for new employees
  useEffect(() => {
    if (!isEditing && nextEmployeeNumber?.formatted && !form.getValues('employee_number')) {
      form.setValue('employee_number', nextEmployeeNumber.formatted);
    }
  }, [isEditing, nextEmployeeNumber, form]);

  const handleOCRData = (data: Partial<ExtractedData>) => {
    if (data.firstName) form.setValue('first_name', data.firstName);
    if (data.lastName) form.setValue('last_name', data.lastName);
    if (data.nationalId) form.setValue('national_id', data.nationalId);
    if (data.dateOfBirth) form.setValue('date_of_birth', data.dateOfBirth);
    if (data.gender) form.setValue('gender', data.gender);
    if (data.phone) form.setValue('phone', data.phone);
    if (data.email) form.setValue('personal_email', data.email);
  };

  const normalizeDateOrNull = (value: string | undefined) => {
    const v = (value ?? '').trim();
    return v.length ? v : null;
  };

  const onSubmit = async (values: EmployeeFormValues) => {
    try {
      // Extract fields not stored directly on employee
      const { shift_id, initial_salary, salary_currency, ...employeeValues } = values;

      if (isEditing && employee) {
        await updateEmployee.mutateAsync({
          id: employee.id,
          ...employeeValues,
          department_id: employeeValues.department_id || null,
          manager_id: employeeValues.manager_id || null,
          personal_email: employeeValues.personal_email || null,
          // IMPORTANT: Supabase date columns can't accept "" (empty string)
          date_of_birth: normalizeDateOrNull(employeeValues.date_of_birth),
          emergency_contact: emergencyContact as Record<string, string>,
          bank_details: bankDetails as Record<string, string>,
        });
      } else {
        const newEmployee = await createEmployee.mutateAsync({
          first_name: employeeValues.first_name,
          last_name: employeeValues.last_name,
          email: employeeValues.email,
          employee_number: employeeValues.employee_number,
          hire_date: employeeValues.hire_date,
          job_title: employeeValues.job_title || null,
          department_id: employeeValues.department_id || null,
          manager_id: employeeValues.manager_id || null,
          employment_type: employeeValues.employment_type,
          employment_status: employeeValues.employment_status,
          phone: employeeValues.phone || null,
          personal_email: employeeValues.personal_email || null,
          work_location: employeeValues.work_location || null,
          national_id: employeeValues.national_id || null,
          date_of_birth: normalizeDateOrNull(employeeValues.date_of_birth),
          gender: employeeValues.gender || null,
          emergency_contact: emergencyContact as Record<string, string>,
          bank_details: bankDetails as Record<string, string>,
        });

        // Assign shift to new employee
        if (shift_id && newEmployee?.id) {
          await assignShift.mutateAsync({
            employee_id: newEmployee.id,
            shift_id: shift_id,
            effective_from: employeeValues.hire_date,
            is_temporary: false,
          });
        }

        // Create initial salary record if provided
        if (initial_salary && initial_salary > 0 && newEmployee?.id) {
          await addSalary.mutateAsync({
            employee_id: newEmployee.id,
            base_salary: initial_salary,
            salary_currency: salary_currency || 'USD',
            effective_from: employeeValues.hire_date,
            reason: 'Initial Salary',
          });
        }
      }
      onSuccess();
    } catch (error) {
      // Error handled in mutation
    }
  };

  return (
    <>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          {/* Progress indicator and OCR button */}
          <div className="flex items-center justify-between gap-4 pb-2 border-b border-border/50">
            <div className="flex-1">
              <FormProgress sections={sections} />
            </div>
            {!isEditing && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setScanDialogOpen(true)}
                className="shrink-0"
              >
                <Scan className="h-4 w-4 mr-2" />
                Scan ID
              </Button>
            )}
          </div>

          <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
            {/* Basic Information Section */}
            <AccordionFormSection
              title="Basic Information"
              icon={<User className="h-4 w-4" />}
              defaultOpen={true}
              isComplete={sectionStatus.basic}
              badge={<Badge variant="secondary" className="text-xs">Required</Badge>}
            >
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="first_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>First Name <span className="text-destructive">*</span></FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="John" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="last_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Last Name <span className="text-destructive">*</span></FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Doe" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Work Email <span className="text-destructive">*</span></FormLabel>
                        <FormControl>
                          <Input type="email" {...field} placeholder="john@company.com" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="employee_number"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Employee Number <span className="text-destructive">*</span></FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            readOnly={!isEditing}
                            className={!isEditing ? 'bg-muted/50' : ''}
                            placeholder={isLoadingNumber ? 'Generating...' : 'EMP-001'}
                          />
                        </FormControl>
                        {!isEditing && (
                          <FormDescription>Auto-generated based on company settings</FormDescription>
                        )}
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            </AccordionFormSection>

            {/* Employment Details Section */}
            <AccordionFormSection
              title="Employment Details"
              icon={<Briefcase className="h-4 w-4" />}
              defaultOpen={true}
              isComplete={sectionStatus.employment}
              badge={<Badge variant="secondary" className="text-xs">Required</Badge>}
            >
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="hire_date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Hire Date <span className="text-destructive">*</span></FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="job_title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Job Title</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Software Engineer" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="department_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Department</FormLabel>
                        <Select 
                          onValueChange={(value) => field.onChange(value === '__none__' ? '' : value)} 
                          value={field.value || '__none__'}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select department" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="__none__">
                              <span className="text-muted-foreground">No Department</span>
                            </SelectItem>
                            {departments?.map((dept) => (
                              <SelectItem key={dept.id} value={dept.id}>
                                {dept.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="manager_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          <Users className="h-4 w-4" />
                          Manager
                        </FormLabel>
                        <Select 
                          onValueChange={(value) => field.onChange(value === '__none__' ? '' : value)} 
                          value={field.value || '__none__'}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select manager" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="__none__">
                              <span className="text-muted-foreground">No Manager</span>
                            </SelectItem>
                            {potentialManagers.map((mgr) => (
                              <SelectItem key={mgr.id} value={mgr.id}>
                                {mgr.first_name} {mgr.last_name}
                                {mgr.job_title && ` (${mgr.job_title})`}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                <FormField
                    control={form.control}
                    name="employment_type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Employment Type <span className="text-destructive">*</span></FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || 'full_time'}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="full_time">Full Time</SelectItem>
                            <SelectItem value="part_time">Part Time</SelectItem>
                            <SelectItem value="contract">Contract</SelectItem>
                            <SelectItem value="intern">Intern</SelectItem>
                            <SelectItem value="temporary">Temporary</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="employment_status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Status <span className="text-destructive">*</span></FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || 'active'}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="active">Active</SelectItem>
                            <SelectItem value="on_leave">On Leave</SelectItem>
                            <SelectItem value="suspended">Suspended</SelectItem>
                            <SelectItem value="terminated">Terminated</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Shift Assignment - Only for new employees */}
                {!isEditing && (
                  <FormField
                    control={form.control}
                    name="shift_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          <Clock className="h-4 w-4" />
                          Default Shift
                        </FormLabel>
                        <Select 
                          onValueChange={field.onChange} 
                          value={field.value || undefined}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select shift" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {shifts?.map((shift) => (
                              <SelectItem key={shift.id} value={shift.id}>
                                {shift.name} ({format(new Date(`2000-01-01T${shift.start_time}`), 'h:mm a')} - {format(new Date(`2000-01-01T${shift.end_time}`), 'h:mm a')})
                                {shift.is_default && ' (Default)'}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          The employee will be assigned to this shift starting from their hire date.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                <FormField
                  control={form.control}
                  name="work_location"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <Building2 className="h-4 w-4" />
                        Work Location
                      </FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Office, Remote, Hybrid" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </AccordionFormSection>

            {/* Personal Information Section */}
            <AccordionFormSection
              title="Personal Information"
              icon={<Phone className="h-4 w-4" />}
              defaultOpen={false}
              isComplete={sectionStatus.personal}
            >
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone</FormLabel>
                        <FormControl>
                          <Input type="tel" {...field} placeholder="+1 234 567 8900" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="personal_email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Personal Email</FormLabel>
                        <FormControl>
                          <Input type="email" {...field} placeholder="john.personal@email.com" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="national_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>National ID / CNIC</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="12345-1234567-1" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="date_of_birth"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Date of Birth</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="gender"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Gender</FormLabel>
                        <Select 
                          onValueChange={(value) => field.onChange(value === '__none__' ? '' : value)} 
                          value={field.value || '__none__'}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="__none__">
                              <span className="text-muted-foreground">Not specified</span>
                            </SelectItem>
                            <SelectItem value="male">Male</SelectItem>
                            <SelectItem value="female">Female</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            </AccordionFormSection>

            {/* Initial Salary Section - Only for new employees */}
            {!isEditing && (
              <AccordionFormSection
                title="Initial Salary"
                icon={<DollarSign className="h-4 w-4" />}
                defaultOpen={false}
                isComplete={sectionStatus.salary}
                badge={<Badge variant="outline" className="text-xs">Optional</Badge>}
              >
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="initial_salary"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Base Salary</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            placeholder="e.g., 50000"
                            {...field}
                            value={field.value || ''}
                          />
                        </FormControl>
                        <FormDescription>
                          Monthly or annual base salary
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="salary_currency"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Currency</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || 'USD'}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="USD">USD</SelectItem>
                            <SelectItem value="EUR">EUR</SelectItem>
                            <SelectItem value="GBP">GBP</SelectItem>
                            <SelectItem value="PKR">PKR</SelectItem>
                            <SelectItem value="INR">INR</SelectItem>
                            <SelectItem value="AED">AED</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </AccordionFormSection>
            )}

            {/* Emergency Contact Section */}
            <AccordionFormSection
              title="Emergency Contact"
              icon={<Shield className="h-4 w-4" />}
              defaultOpen={false}
              isComplete={sectionStatus.emergency}
              badge={<Badge variant="outline" className="text-xs">Optional</Badge>}
            >
              <EmergencyContactSection
                value={emergencyContact}
                onChange={setEmergencyContact}
              />
            </AccordionFormSection>

            {/* Bank Details Section */}
            <AccordionFormSection
              title="Bank Details"
              icon={<CreditCard className="h-4 w-4" />}
              defaultOpen={false}
              isComplete={sectionStatus.bank}
              badge={<Badge variant="outline" className="text-xs">Optional</Badge>}
            >
              <BankDetailsSection
                value={bankDetails}
                onChange={setBankDetails}
              />
            </AccordionFormSection>
          </div>

          {/* Sticky Footer */}
          <div className="flex justify-end gap-2 pt-4 border-t border-border/50 bg-background sticky bottom-0">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {isEditing ? 'Update' : 'Create'} Employee
            </Button>
          </div>
        </form>
      </Form>

      <DocumentScanDialog
        open={scanDialogOpen}
        onOpenChange={setScanDialogOpen}
        onDataExtracted={handleOCRData}
      />
    </>
  );
}
