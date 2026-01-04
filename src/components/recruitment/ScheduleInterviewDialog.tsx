import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { CalendarIcon, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useScheduleInterview } from '@/hooks/useRecruitmentWorkflow';
import { useEmployees } from '@/hooks/useEmployees';
import { Database } from '@/integrations/supabase/types';

type InterviewType = Database['public']['Enums']['interview_type'];

const formSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  interview_type: z.enum(['phone', 'video', 'onsite', 'panel', 'technical']),
  round_number: z.number().min(1),
  scheduled_date: z.date(),
  scheduled_time: z.string().min(1, 'Time is required'),
  duration_minutes: z.number().min(15).max(480),
  location: z.string().optional(),
  meeting_link: z.string().url().optional().or(z.literal('')),
  description: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface Panelist {
  employeeId: string;
  name: string;
  role: string;
  isRequired: boolean;
}

interface ScheduleInterviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  candidateId: string;
  candidateName: string;
  currentRound?: number;
}

export function ScheduleInterviewDialog({ 
  open, 
  onOpenChange, 
  candidateId, 
  candidateName,
  currentRound = 1 
}: ScheduleInterviewDialogProps) {
  const [panelists, setPanelists] = useState<Panelist[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');
  const [panelistRole, setPanelistRole] = useState<string>('Interviewer');
  
  const scheduleInterview = useScheduleInterview();
  const { data: employees } = useEmployees();
  
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: `Interview Round ${currentRound}`,
      interview_type: 'video',
      round_number: currentRound,
      scheduled_date: new Date(),
      scheduled_time: '10:00',
      duration_minutes: 60,
      location: '',
      meeting_link: '',
      description: '',
    },
  });
  
  const addPanelist = () => {
    if (!selectedEmployeeId) return;
    
    const employee = employees?.find(e => e.id === selectedEmployeeId);
    if (!employee) return;
    
    if (panelists.some(p => p.employeeId === selectedEmployeeId)) return;
    
    setPanelists([
      ...panelists,
      {
        employeeId: selectedEmployeeId,
        name: `${employee.first_name} ${employee.last_name}`,
        role: panelistRole,
        isRequired: true,
      },
    ]);
    
    setSelectedEmployeeId('');
    setPanelistRole('Interviewer');
  };
  
  const removePanelist = (employeeId: string) => {
    setPanelists(panelists.filter(p => p.employeeId !== employeeId));
  };
  
  const onSubmit = async (values: FormValues) => {
    const [hours, minutes] = values.scheduled_time.split(':').map(Number);
    const scheduledAt = new Date(values.scheduled_date);
    scheduledAt.setHours(hours, minutes, 0, 0);
    
    await scheduleInterview.mutateAsync({
      candidateId,
      interviewType: values.interview_type as InterviewType,
      roundNumber: values.round_number,
      title: values.title,
      description: values.description,
      scheduledAt,
      durationMinutes: values.duration_minutes,
      location: values.location,
      meetingLink: values.meeting_link || undefined,
      panelists: panelists.map(p => ({
        employeeId: p.employeeId,
        role: p.role,
        isRequired: p.isRequired,
      })),
    });
    
    onOpenChange(false);
    form.reset();
    setPanelists([]);
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Schedule Interview for {candidateName}</DialogTitle>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Interview Title</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Technical Interview" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="interview_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Interview Type</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="phone">Phone Call</SelectItem>
                        <SelectItem value="video">Video Call</SelectItem>
                        <SelectItem value="onsite">On-site</SelectItem>
                        <SelectItem value="panel">Panel Interview</SelectItem>
                        <SelectItem value="technical">Technical Assessment</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <div className="grid grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="scheduled_date"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Date</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              'pl-3 text-left font-normal',
                              !field.value && 'text-muted-foreground'
                            )}
                          >
                            {field.value ? format(field.value, 'PPP') : 'Pick a date'}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          disabled={(date) => date < new Date()}
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="scheduled_time"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Time</FormLabel>
                    <FormControl>
                      <Input type="time" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="duration_minutes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Duration (min)</FormLabel>
                    <Select 
                      onValueChange={(v) => field.onChange(parseInt(v))} 
                      defaultValue={field.value.toString()}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="15">15 minutes</SelectItem>
                        <SelectItem value="30">30 minutes</SelectItem>
                        <SelectItem value="45">45 minutes</SelectItem>
                        <SelectItem value="60">1 hour</SelectItem>
                        <SelectItem value="90">1.5 hours</SelectItem>
                        <SelectItem value="120">2 hours</SelectItem>
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
                name="location"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Location (optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Conference Room A" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="meeting_link"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Meeting Link (optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="https://zoom.us/..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes / Instructions (optional)</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Any additional notes for the interviewers..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            {/* Panelists Section */}
            <div className="space-y-3">
              <FormLabel>Interview Panel</FormLabel>
              
              <div className="flex gap-2">
                <Select value={selectedEmployeeId} onValueChange={setSelectedEmployeeId}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select interviewer..." />
                  </SelectTrigger>
                  <SelectContent>
                    {employees?.filter(e => !panelists.some(p => p.employeeId === e.id)).map((employee) => (
                      <SelectItem key={employee.id} value={employee.id}>
                        {employee.first_name} {employee.last_name}
                        {employee.job_title && ` - ${employee.job_title}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                <Select value={panelistRole} onValueChange={setPanelistRole}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Interviewer">Interviewer</SelectItem>
                    <SelectItem value="Lead Interviewer">Lead Interviewer</SelectItem>
                    <SelectItem value="Technical Evaluator">Technical Evaluator</SelectItem>
                    <SelectItem value="HR Representative">HR Representative</SelectItem>
                    <SelectItem value="Hiring Manager">Hiring Manager</SelectItem>
                  </SelectContent>
                </Select>
                
                <Button type="button" variant="outline" size="icon" onClick={addPanelist}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              
              {panelists.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {panelists.map((panelist) => (
                    <Badge key={panelist.employeeId} variant="secondary" className="pl-2 pr-1 py-1">
                      <span>{panelist.name}</span>
                      <span className="text-muted-foreground ml-1">({panelist.role})</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-4 w-4 ml-1 hover:bg-transparent"
                        onClick={() => removePanelist(panelist.employeeId)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
            
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={scheduleInterview.isPending}>
                {scheduleInterview.isPending ? 'Scheduling...' : 'Schedule Interview'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
