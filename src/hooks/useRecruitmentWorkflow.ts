import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { toast } from 'sonner';
import { Database } from '@/integrations/supabase/types';

// Types from database
type ScreeningTestType = Database['public']['Enums']['screening_test_type'];
type ScreeningStatus = Database['public']['Enums']['screening_status'];
type InterviewType = Database['public']['Enums']['interview_type'];
type InterviewStatus = Database['public']['Enums']['interview_status'];
type FeedbackRecommendation = Database['public']['Enums']['feedback_recommendation'];
type OfferStatus = Database['public']['Enums']['offer_status'];

export interface ScreeningQuestion {
  id: string;
  type: 'multiple_choice' | 'text' | 'yes_no' | 'rating';
  question: string;
  options?: string[];
  correctAnswer?: string | number;
  points: number;
}

export interface ScreeningTest {
  id: string;
  company_id: string;
  job_id: string | null;
  title: string;
  description: string | null;
  test_type: ScreeningTestType;
  questions: ScreeningQuestion[];
  duration_minutes: number;
  passing_score: number;
  is_template: boolean | null;
  is_active: boolean | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CandidateScreening {
  id: string;
  company_id: string;
  candidate_id: string;
  screening_test_id: string;
  assigned_by: string | null;
  assigned_at: string;
  expires_at: string;
  started_at: string | null;
  completed_at: string | null;
  status: ScreeningStatus;
  answers: unknown[];
  score: number | null;
  evaluation_notes: string | null;
  evaluated_by: string | null;
  evaluated_at: string | null;
  access_token: string;
  screening_test?: ScreeningTest | null;
  candidate?: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
  } | null;
}

export interface Interview {
  id: string;
  company_id: string;
  candidate_id: string;
  interview_type: InterviewType;
  round_number: number;
  title: string;
  description: string | null;
  scheduled_at: string;
  duration_minutes: number;
  location: string | null;
  meeting_link: string | null;
  status: InterviewStatus;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  panelists?: InterviewPanelist[];
  candidate?: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
  } | null;
}

export interface InterviewPanelist {
  id: string;
  interview_id: string;
  employee_id: string;
  role: string | null;
  is_required: boolean | null;
  feedback_submitted: boolean | null;
  employee?: {
    id: string;
    first_name: string;
    last_name: string;
    job_title: string | null;
  } | null;
}

export interface InterviewFeedback {
  id: string;
  interview_id: string;
  panelist_id: string;
  overall_rating: number | null;
  technical_rating: number | null;
  communication_rating: number | null;
  culture_fit_rating: number | null;
  strengths: string | null;
  weaknesses: string | null;
  recommendation: FeedbackRecommendation | null;
  detailed_notes: string | null;
  submitted_at: string;
}

export interface JobOffer {
  id: string;
  company_id: string;
  candidate_id: string;
  job_id: string;
  created_by: string | null;
  status: OfferStatus;
  salary_offered: number;
  salary_currency: string;
  start_date: string;
  offer_expiry_date: string;
  employment_type: Database['public']['Enums']['employment_type'];
  department_id: string | null;
  reporting_to: string | null;
  benefits: Record<string, unknown>;
  additional_terms: string | null;
  candidate_response: string | null;
  negotiation_notes: unknown[];
  sent_at: string | null;
  responded_at: string | null;
  access_token: string;
  created_at: string;
  updated_at: string;
  candidate?: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
  } | null;
  job?: {
    id: string;
    title: string;
  } | null;
}

export interface CandidateTimelineEvent {
  id: string;
  company_id: string;
  candidate_id: string;
  event_type: string;
  title: string;
  description: string | null;
  metadata: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
  created_by_employee?: {
    first_name: string;
    last_name: string;
  } | null;
}

// ============ SCREENING TESTS HOOKS ============

export function useScreeningTests(jobId?: string) {
  const { companyId } = useTenant();
  
  return useQuery({
    queryKey: ['screening-tests', companyId, jobId],
    queryFn: async () => {
      let query = supabase
        .from('screening_tests')
        .select('*')
        .eq('company_id', companyId!)
        .eq('is_active', true)
        .order('created_at', { ascending: false });
      
      if (jobId) {
        query = query.or(`job_id.eq.${jobId},is_template.eq.true`);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      
      return (data || []).map(item => ({
        ...item,
        questions: (item.questions as unknown as ScreeningQuestion[]) || [],
      })) as ScreeningTest[];
    },
    enabled: !!companyId,
  });
}

export function useCreateScreeningTest() {
  const queryClient = useQueryClient();
  const { companyId } = useTenant();
  
  return useMutation({
    mutationFn: async (test: {
      job_id?: string | null;
      title: string;
      description?: string | null;
      test_type?: ScreeningTestType;
      questions: ScreeningQuestion[];
      duration_minutes?: number;
      passing_score?: number;
      is_template?: boolean;
      is_active?: boolean;
      created_by?: string | null;
    }) => {
      const { data, error } = await supabase
        .from('screening_tests')
        .insert({
          company_id: companyId!,
          title: test.title,
          description: test.description,
          job_id: test.job_id,
          test_type: test.test_type || 'questionnaire',
          questions: test.questions as unknown as Database['public']['Tables']['screening_tests']['Insert']['questions'],
          duration_minutes: test.duration_minutes || 60,
          passing_score: test.passing_score || 70,
          is_template: test.is_template,
          is_active: test.is_active ?? true,
          created_by: test.created_by,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['screening-tests'] });
      toast.success('Screening test created successfully');
    },
    onError: (error) => {
      toast.error('Failed to create screening test');
      console.error(error);
    },
  });
}

export function useUpdateScreeningTest() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, questions, ...updates }: { 
      id: string; 
      questions?: ScreeningQuestion[];
      title?: string;
      description?: string | null;
      test_type?: ScreeningTestType;
      duration_minutes?: number;
      passing_score?: number;
      is_template?: boolean;
      is_active?: boolean;
    }) => {
      const updateData: Record<string, unknown> = { ...updates };
      if (questions) {
        updateData.questions = questions as unknown as Database['public']['Tables']['screening_tests']['Update']['questions'];
      }
      
      const { data, error } = await supabase
        .from('screening_tests')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['screening-tests'] });
      toast.success('Screening test updated');
    },
    onError: (error) => {
      toast.error('Failed to update screening test');
      console.error(error);
    },
  });
}

// ============ CANDIDATE SCREENINGS HOOKS ============

export function useCandidateScreenings(candidateId?: string) {
  const { companyId } = useTenant();
  
  return useQuery({
    queryKey: ['candidate-screenings', companyId, candidateId],
    queryFn: async () => {
      let query = supabase
        .from('candidate_screenings')
        .select(`
          *,
          screening_test:screening_tests(*),
          candidate:candidates(id, first_name, last_name, email)
        `)
        .eq('company_id', companyId!)
        .order('assigned_at', { ascending: false });
      
      if (candidateId) {
        query = query.eq('candidate_id', candidateId);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      
      return (data || []).map(item => ({
        ...item,
        answers: (item.answers as unknown[]) || [],
        screening_test: item.screening_test ? {
          ...item.screening_test,
          questions: (item.screening_test.questions as unknown as ScreeningQuestion[]) || [],
        } : null,
      })) as CandidateScreening[];
    },
    enabled: !!companyId,
  });
}

export function useAssignScreening() {
  const queryClient = useQueryClient();
  const { companyId, employeeId } = useTenant();
  
  return useMutation({
    mutationFn: async ({
      candidateId,
      screeningTestId,
      expiresAt,
    }: {
      candidateId: string;
      screeningTestId: string;
      expiresAt: Date;
    }) => {
      const { data, error } = await supabase
        .from('candidate_screenings')
        .insert({
          company_id: companyId!,
          candidate_id: candidateId,
          screening_test_id: screeningTestId,
          assigned_by: employeeId,
          expires_at: expiresAt.toISOString(),
        })
        .select()
        .single();
      
      if (error) throw error;
      
      // Update candidate status to screening if currently applied
      await supabase
        .from('candidates')
        .update({ status: 'screening' as const, current_stage_started_at: new Date().toISOString() })
        .eq('id', candidateId)
        .eq('status', 'applied');
      
      // Add timeline event
      await supabase.from('candidate_timeline').insert({
        company_id: companyId!,
        candidate_id: candidateId,
        event_type: 'screening_assigned',
        title: 'Screening Test Assigned',
        description: 'A screening test has been assigned',
        created_by: employeeId,
        metadata: { screening_id: data.id, access_token: data.access_token },
      });
      
      // Send notification email
      try {
        await supabase.functions.invoke('send-recruitment-notification', {
          body: { 
            type: 'screening_assigned', 
            candidateId,
            screeningId: data.id,
            accessToken: data.access_token,
          },
        });
      } catch (e) {
        console.error('Failed to send notification email:', e);
      }
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['candidate-screenings'] });
      queryClient.invalidateQueries({ queryKey: ['candidate-timeline'] });
      queryClient.invalidateQueries({ queryKey: ['candidates'] });
      toast.success('Screening assigned successfully');
    },
    onError: (error) => {
      toast.error('Failed to assign screening');
      console.error(error);
    },
  });
}

export function useEvaluateScreening() {
  const queryClient = useQueryClient();
  const { employeeId } = useTenant();
  
  return useMutation({
    mutationFn: async ({
      id,
      score,
      status,
      evaluationNotes,
    }: {
      id: string;
      score: number;
      status: 'passed' | 'failed';
      evaluationNotes?: string;
    }) => {
      const { data, error } = await supabase
        .from('candidate_screenings')
        .update({
          score,
          status,
          evaluation_notes: evaluationNotes,
          evaluated_by: employeeId,
          evaluated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['candidate-screenings'] });
      toast.success('Screening evaluated');
    },
    onError: (error) => {
      toast.error('Failed to evaluate screening');
      console.error(error);
    },
  });
}

// ============ INTERVIEWS HOOKS ============

export function useInterviews(candidateId?: string) {
  const { companyId } = useTenant();
  
  return useQuery({
    queryKey: ['interviews', companyId, candidateId],
    queryFn: async () => {
      let query = supabase
        .from('interviews')
        .select(`
          *,
          candidate:candidates(id, first_name, last_name, email),
          panelists:interview_panelists(
            *,
            employee:employees(id, first_name, last_name, email, job_title)
          )
        `)
        .eq('company_id', companyId!)
        .order('scheduled_at', { ascending: true });
      
      if (candidateId) {
        query = query.eq('candidate_id', candidateId);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as Interview[];
    },
    enabled: !!companyId,
  });
}

export function useMyInterviews() {
  const { employeeId } = useTenant();
  
  return useQuery({
    queryKey: ['my-interviews', employeeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('interview_panelists')
        .select(`
          *,
          interview:interviews(
            *,
            candidate:candidates(id, first_name, last_name, email)
          )
        `)
        .eq('employee_id', employeeId!)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!employeeId,
  });
}

export function useScheduleInterview() {
  const queryClient = useQueryClient();
  const { companyId, employeeId } = useTenant();
  
  return useMutation({
    mutationFn: async ({
      candidateId,
      interviewType,
      roundNumber,
      title,
      description,
      scheduledAt,
      durationMinutes,
      location,
      meetingLink,
      panelists,
    }: {
      candidateId: string;
      interviewType: InterviewType;
      roundNumber: number;
      title: string;
      description?: string;
      scheduledAt: Date;
      durationMinutes: number;
      location?: string;
      meetingLink?: string;
      panelists: { employeeId: string; role: string; isRequired: boolean }[];
    }) => {
      // Create interview
      const { data: interview, error: interviewError } = await supabase
        .from('interviews')
        .insert({
          company_id: companyId!,
          candidate_id: candidateId,
          interview_type: interviewType,
          round_number: roundNumber,
          title,
          description,
          scheduled_at: scheduledAt.toISOString(),
          duration_minutes: durationMinutes,
          location,
          meeting_link: meetingLink,
          created_by: employeeId,
        })
        .select()
        .single();
      
      if (interviewError) throw interviewError;
      
      // Add panelists
      if (panelists.length > 0) {
        const { error: panelistError } = await supabase
          .from('interview_panelists')
          .insert(
            panelists.map((p) => ({
              interview_id: interview.id,
              employee_id: p.employeeId,
              role: p.role,
              is_required: p.isRequired,
            }))
          );
        
        if (panelistError) throw panelistError;
      }
      
      // Update candidate status to interviewing if in screening or applied
      await supabase
        .from('candidates')
        .update({ status: 'interviewing' as const, current_stage_started_at: new Date().toISOString() })
        .eq('id', candidateId)
        .in('status', ['applied', 'screening']);
      
      // Add timeline event
      await supabase.from('candidate_timeline').insert({
        company_id: companyId!,
        candidate_id: candidateId,
        event_type: 'interview_scheduled',
        title: `Interview Scheduled: ${title}`,
        description: `${interviewType} interview scheduled for ${scheduledAt.toLocaleDateString()}`,
        created_by: employeeId,
        metadata: { interview_id: interview.id },
      });
      
      // Send notification emails
      try {
        await supabase.functions.invoke('send-recruitment-notification', {
          body: { 
            type: 'interview_scheduled', 
            candidateId,
            interviewId: interview.id,
            panelistIds: panelists.map(p => p.employeeId),
          },
        });
      } catch (e) {
        console.error('Failed to send notification emails:', e);
      }
      
      return interview;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['interviews'] });
      queryClient.invalidateQueries({ queryKey: ['candidate-timeline'] });
      queryClient.invalidateQueries({ queryKey: ['candidates'] });
      toast.success('Interview scheduled successfully');
    },
    onError: (error) => {
      toast.error('Failed to schedule interview');
      console.error(error);
    },
  });
}

export function useUpdateInterviewStatus() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({
      id,
      status,
      notes,
    }: {
      id: string;
      status: InterviewStatus;
      notes?: string;
    }) => {
      const { data, error } = await supabase
        .from('interviews')
        .update({ status, notes })
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['interviews'] });
      toast.success('Interview status updated');
    },
    onError: (error) => {
      toast.error('Failed to update interview');
      console.error(error);
    },
  });
}

// ============ INTERVIEW FEEDBACK HOOKS ============

export function useInterviewFeedback(interviewId: string) {
  return useQuery({
    queryKey: ['interview-feedback', interviewId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('interview_feedback')
        .select(`
          *,
          panelist:interview_panelists(
            *,
            employee:employees(id, first_name, last_name, job_title)
          )
        `)
        .eq('interview_id', interviewId);
      
      if (error) throw error;
      return (data || []) as (InterviewFeedback & { panelist: InterviewPanelist })[];
    },
    enabled: !!interviewId,
  });
}

export function useSubmitFeedback() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (feedback: Omit<InterviewFeedback, 'id' | 'submitted_at'>) => {
      const { data, error } = await supabase
        .from('interview_feedback')
        .insert(feedback)
        .select()
        .single();
      
      if (error) throw error;
      
      // Mark panelist as feedback submitted
      await supabase
        .from('interview_panelists')
        .update({ feedback_submitted: true })
        .eq('id', feedback.panelist_id);
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['interview-feedback'] });
      queryClient.invalidateQueries({ queryKey: ['interviews'] });
      toast.success('Feedback submitted successfully');
    },
    onError: (error) => {
      toast.error('Failed to submit feedback');
      console.error(error);
    },
  });
}

// ============ JOB OFFERS HOOKS ============

export function useOffers(candidateId?: string) {
  const { companyId } = useTenant();
  
  return useQuery({
    queryKey: ['job-offers', companyId, candidateId],
    queryFn: async () => {
      let query = supabase
        .from('job_offers')
        .select(`
          *,
          candidate:candidates(id, first_name, last_name, email),
          job:jobs(id, title)
        `)
        .eq('company_id', companyId!)
        .order('created_at', { ascending: false });
      
      if (candidateId) {
        query = query.eq('candidate_id', candidateId);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as JobOffer[];
    },
    enabled: !!companyId,
  });
}

export function useCreateOffer() {
  const queryClient = useQueryClient();
  const { companyId, employeeId } = useTenant();
  
  return useMutation({
    mutationFn: async (offer: {
      candidate_id: string;
      job_id: string;
      status?: OfferStatus;
      salary_offered: number;
      salary_currency?: string;
      start_date: string;
      offer_expiry_date: string;
      employment_type?: Database['public']['Enums']['employment_type'];
      department_id?: string | null;
      reporting_to?: string | null;
      benefits?: Record<string, unknown>;
      additional_terms?: string | null;
    }) => {
      const insertData = {
        company_id: companyId!,
        created_by: employeeId,
        candidate_id: offer.candidate_id,
        job_id: offer.job_id,
        status: offer.status || 'draft' as const,
        salary_offered: offer.salary_offered,
        salary_currency: offer.salary_currency || 'USD',
        start_date: offer.start_date,
        offer_expiry_date: offer.offer_expiry_date,
        employment_type: offer.employment_type || 'full_time' as const,
        department_id: offer.department_id,
        reporting_to: offer.reporting_to,
        benefits: offer.benefits || {},
        additional_terms: offer.additional_terms,
      };
      
      const { data, error } = await supabase
        .from('job_offers')
        .insert(insertData as Database['public']['Tables']['job_offers']['Insert'])
        .select()
        .single();
      
      if (error) throw error;
      
      // Update candidate status to offered
      await supabase
        .from('candidates')
        .update({ status: 'offered' as const, current_stage_started_at: new Date().toISOString() })
        .eq('id', offer.candidate_id);
      
      // Add timeline event
      await supabase.from('candidate_timeline').insert({
        company_id: companyId!,
        candidate_id: offer.candidate_id,
        event_type: 'offer_created',
        title: 'Job Offer Created',
        description: `Offer created with salary ${offer.salary_currency || 'USD'} ${offer.salary_offered}`,
        created_by: employeeId,
        metadata: { offer_id: data.id },
      });
      
      // Send notification email to candidate (only if offer is sent, not draft)
      if (offer.status === 'sent') {
        try {
          await supabase.functions.invoke('send-recruitment-notification', {
            body: { 
              type: 'offer_sent', 
              candidateId: offer.candidate_id,
              offerId: data.id,
            },
          });
        } catch (e) {
          console.error('Failed to send offer notification:', e);
        }
      }
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['job-offers'] });
      queryClient.invalidateQueries({ queryKey: ['candidate-timeline'] });
      queryClient.invalidateQueries({ queryKey: ['candidates'] });
      toast.success('Offer created successfully');
    },
    onError: (error) => {
      toast.error('Failed to create offer');
      console.error(error);
    },
  });
}

export function useUpdateOfferStatus() {
  const queryClient = useQueryClient();
  const { companyId, employeeId } = useTenant();
  
  return useMutation({
    mutationFn: async ({
      id,
      candidateId,
      status,
      sentAt,
      respondedAt,
      candidateResponse,
    }: {
      id: string;
      candidateId: string;
      status: OfferStatus;
      sentAt?: string;
      respondedAt?: string;
      candidateResponse?: string;
    }) => {
      const { data, error } = await supabase
        .from('job_offers')
        .update({
          status,
          sent_at: sentAt,
          responded_at: respondedAt,
          candidate_response: candidateResponse,
        })
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      
      // Update candidate status based on offer status
      if (status === 'accepted') {
        await supabase
          .from('candidates')
          .update({ status: 'hired' as const, current_stage_started_at: new Date().toISOString() })
          .eq('id', candidateId);
      } else if (status === 'declined' || status === 'withdrawn') {
        await supabase
          .from('candidates')
          .update({ 
            status: 'rejected' as const, 
            rejected_reason: `Offer ${status}`,
            current_stage_started_at: new Date().toISOString() 
          })
          .eq('id', candidateId);
      }
      
      // Add timeline event
      await supabase.from('candidate_timeline').insert({
        company_id: companyId!,
        candidate_id: candidateId,
        event_type: 'offer_status_changed',
        title: `Offer Status: ${status}`,
        description: `Offer status changed to ${status}`,
        created_by: employeeId,
        metadata: { offer_id: id, new_status: status },
      });
      
      // Send notification email when offer is sent
      if (status === 'sent') {
        try {
          await supabase.functions.invoke('send-recruitment-notification', {
            body: { 
              type: 'offer_sent', 
              candidateId,
              offerId: id,
            },
          });
        } catch (e) {
          console.error('Failed to send offer notification:', e);
        }
      }
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['job-offers'] });
      queryClient.invalidateQueries({ queryKey: ['candidate-timeline'] });
      queryClient.invalidateQueries({ queryKey: ['candidates'] });
      toast.success('Offer updated');
    },
    onError: (error) => {
      toast.error('Failed to update offer');
      console.error(error);
    },
  });
}

// ============ HIRE CANDIDATE (CONVERT TO EMPLOYEE) ============

export function useConvertCandidateToEmployee() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({
      candidateId,
      offerId,
      createLogin = false,
    }: {
      candidateId: string;
      offerId: string;
      createLogin?: boolean;
    }) => {
      const { data, error } = await supabase.rpc('convert_candidate_to_employee', {
        _candidate_id: candidateId,
        _offer_id: offerId,
        _create_login: createLogin,
      });
      
      if (error) throw error;
      return data as string; // Returns employee_id
    },
    onSuccess: (employeeId) => {
      queryClient.invalidateQueries({ queryKey: ['candidates'] });
      queryClient.invalidateQueries({ queryKey: ['candidate-timeline'] });
      queryClient.invalidateQueries({ queryKey: ['job-offers'] });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      toast.success('Candidate successfully converted to employee!');
      return employeeId;
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to convert candidate');
      console.error(error);
    },
  });
}

// For candidate portal - accept offer
export function useAcceptOffer() {
  return useMutation({
    mutationFn: async ({
      offerId,
      accessToken,
      responseNotes,
    }: {
      offerId: string;
      accessToken: string;
      responseNotes?: string;
    }) => {
      const { data, error } = await supabase.rpc('accept_job_offer', {
        _offer_id: offerId,
        _access_token: accessToken,
        _response_notes: responseNotes,
      });
      
      if (error) throw error;
      return data as { success: boolean; employee_id: string; message: string };
    },
    onSuccess: () => {
      toast.success('Offer accepted! Welcome aboard!');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to accept offer');
    },
  });
}

// For candidate portal - decline offer
export function useDeclineOffer() {
  return useMutation({
    mutationFn: async ({
      offerId,
      accessToken,
      reason,
    }: {
      offerId: string;
      accessToken: string;
      reason?: string;
    }) => {
      const { data, error } = await supabase.rpc('decline_job_offer', {
        _offer_id: offerId,
        _access_token: accessToken,
        _reason: reason,
      });
      
      if (error) throw error;
      return data as { success: boolean; message: string };
    },
    onSuccess: () => {
      toast.success('Offer declined');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to decline offer');
    },
  });
}

// ============ CANDIDATE TIMELINE HOOKS ============

export function useCandidateTimeline(candidateId: string) {
  const { companyId } = useTenant();
  
  return useQuery({
    queryKey: ['candidate-timeline', candidateId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('candidate_timeline')
        .select('*')
        .eq('candidate_id', candidateId)
        .eq('company_id', companyId!)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return (data || []) as CandidateTimelineEvent[];
    },
    enabled: !!candidateId && !!companyId,
  });
}

export function useAddTimelineEvent() {
  const queryClient = useQueryClient();
  const { companyId, employeeId } = useTenant();
  
  return useMutation({
    mutationFn: async ({
      candidateId,
      eventType,
      title,
      description,
      metadata,
    }: {
      candidateId: string;
      eventType: string;
      title: string;
      description?: string;
      metadata?: Record<string, unknown>;
    }) => {
      const insertData = {
        company_id: companyId!,
        candidate_id: candidateId,
        event_type: eventType,
        title,
        description,
        metadata: metadata || {},
        created_by: employeeId,
      };
      
      const { data, error } = await supabase
        .from('candidate_timeline')
        .insert(insertData as Database['public']['Tables']['candidate_timeline']['Insert'])
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['candidate-timeline'] });
    },
    onError: (error) => {
      toast.error('Failed to add timeline event');
      console.error(error);
    },
  });
}
