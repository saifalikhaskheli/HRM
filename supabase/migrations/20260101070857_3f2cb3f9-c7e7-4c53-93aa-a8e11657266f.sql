-- Phase 1: Complete Recruitment Workflow Database Schema

-- 1. Create new enums
CREATE TYPE screening_test_type AS ENUM ('questionnaire', 'coding', 'personality', 'skills');
CREATE TYPE screening_status AS ENUM ('pending', 'in_progress', 'completed', 'expired', 'passed', 'failed');
CREATE TYPE interview_type AS ENUM ('phone', 'video', 'onsite', 'panel', 'technical');
CREATE TYPE interview_status AS ENUM ('scheduled', 'in_progress', 'completed', 'cancelled', 'rescheduled', 'no_show');
CREATE TYPE feedback_recommendation AS ENUM ('strong_hire', 'hire', 'neutral', 'no_hire', 'strong_no_hire');
CREATE TYPE offer_status AS ENUM ('draft', 'pending_approval', 'approved', 'sent', 'accepted', 'declined', 'negotiating', 'expired', 'withdrawn');

-- 2. Create screening_tests table
CREATE TABLE public.screening_tests (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    job_id UUID REFERENCES public.jobs(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    description TEXT,
    test_type screening_test_type NOT NULL DEFAULT 'questionnaire',
    questions JSONB NOT NULL DEFAULT '[]'::jsonb,
    duration_minutes INTEGER NOT NULL DEFAULT 60,
    passing_score INTEGER NOT NULL DEFAULT 70,
    is_template BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES public.employees(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 3. Create candidate_screenings table
CREATE TABLE public.candidate_screenings (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    candidate_id UUID NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
    screening_test_id UUID NOT NULL REFERENCES public.screening_tests(id) ON DELETE CASCADE,
    assigned_by UUID REFERENCES public.employees(id),
    assigned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    status screening_status NOT NULL DEFAULT 'pending',
    answers JSONB DEFAULT '[]'::jsonb,
    score INTEGER,
    evaluation_notes TEXT,
    evaluated_by UUID REFERENCES public.employees(id),
    evaluated_at TIMESTAMP WITH TIME ZONE,
    access_token UUID NOT NULL DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 4. Create interviews table
CREATE TABLE public.interviews (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    candidate_id UUID NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
    interview_type interview_type NOT NULL DEFAULT 'video',
    round_number INTEGER NOT NULL DEFAULT 1,
    title TEXT NOT NULL,
    description TEXT,
    scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
    duration_minutes INTEGER NOT NULL DEFAULT 60,
    location TEXT,
    meeting_link TEXT,
    status interview_status NOT NULL DEFAULT 'scheduled',
    notes TEXT,
    created_by UUID REFERENCES public.employees(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 5. Create interview_panelists table
CREATE TABLE public.interview_panelists (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    interview_id UUID NOT NULL REFERENCES public.interviews(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    role TEXT DEFAULT 'Interviewer',
    is_required BOOLEAN DEFAULT true,
    feedback_submitted BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(interview_id, employee_id)
);

-- 6. Create interview_feedback table
CREATE TABLE public.interview_feedback (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    interview_id UUID NOT NULL REFERENCES public.interviews(id) ON DELETE CASCADE,
    panelist_id UUID NOT NULL REFERENCES public.interview_panelists(id) ON DELETE CASCADE,
    overall_rating INTEGER CHECK (overall_rating >= 1 AND overall_rating <= 5),
    technical_rating INTEGER CHECK (technical_rating >= 1 AND technical_rating <= 5),
    communication_rating INTEGER CHECK (communication_rating >= 1 AND communication_rating <= 5),
    culture_fit_rating INTEGER CHECK (culture_fit_rating >= 1 AND culture_fit_rating <= 5),
    strengths TEXT,
    weaknesses TEXT,
    recommendation feedback_recommendation,
    detailed_notes TEXT,
    submitted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(interview_id, panelist_id)
);

-- 7. Create job_offers table
CREATE TABLE public.job_offers (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    candidate_id UUID NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
    job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
    created_by UUID REFERENCES public.employees(id),
    status offer_status NOT NULL DEFAULT 'draft',
    salary_offered NUMERIC NOT NULL,
    salary_currency TEXT NOT NULL DEFAULT 'USD',
    start_date DATE NOT NULL,
    offer_expiry_date DATE NOT NULL,
    employment_type employment_type NOT NULL DEFAULT 'full_time',
    department_id UUID REFERENCES public.departments(id),
    reporting_to UUID REFERENCES public.employees(id),
    benefits JSONB DEFAULT '{}'::jsonb,
    additional_terms TEXT,
    candidate_response TEXT,
    negotiation_notes JSONB DEFAULT '[]'::jsonb,
    sent_at TIMESTAMP WITH TIME ZONE,
    responded_at TIMESTAMP WITH TIME ZONE,
    access_token UUID NOT NULL DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 8. Create candidate_timeline table
CREATE TABLE public.candidate_timeline (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    candidate_id UUID NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_by UUID REFERENCES public.employees(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 9. Update candidates table with new columns
ALTER TABLE public.candidates 
ADD COLUMN IF NOT EXISTS current_stage_started_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
ADD COLUMN IF NOT EXISTS overall_rating NUMERIC,
ADD COLUMN IF NOT EXISTS expected_salary NUMERIC,
ADD COLUMN IF NOT EXISTS expected_salary_currency TEXT DEFAULT 'USD',
ADD COLUMN IF NOT EXISTS notice_period_days INTEGER,
ADD COLUMN IF NOT EXISTS availability_date DATE;

-- 10. Create indexes for performance
CREATE INDEX idx_screening_tests_company ON public.screening_tests(company_id);
CREATE INDEX idx_screening_tests_job ON public.screening_tests(job_id);
CREATE INDEX idx_candidate_screenings_candidate ON public.candidate_screenings(candidate_id);
CREATE INDEX idx_candidate_screenings_status ON public.candidate_screenings(status);
CREATE INDEX idx_candidate_screenings_expires ON public.candidate_screenings(expires_at);
CREATE INDEX idx_candidate_screenings_token ON public.candidate_screenings(access_token);
CREATE INDEX idx_interviews_candidate ON public.interviews(candidate_id);
CREATE INDEX idx_interviews_scheduled ON public.interviews(scheduled_at);
CREATE INDEX idx_interviews_status ON public.interviews(status);
CREATE INDEX idx_interview_panelists_employee ON public.interview_panelists(employee_id);
CREATE INDEX idx_job_offers_candidate ON public.job_offers(candidate_id);
CREATE INDEX idx_job_offers_status ON public.job_offers(status);
CREATE INDEX idx_job_offers_token ON public.job_offers(access_token);
CREATE INDEX idx_candidate_timeline_candidate ON public.candidate_timeline(candidate_id);

-- 11. Enable RLS on all new tables
ALTER TABLE public.screening_tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidate_screenings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interview_panelists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interview_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidate_timeline ENABLE ROW LEVEL SECURITY;

-- 12. RLS Policies for screening_tests
CREATE POLICY "screening_tests_select_member" ON public.screening_tests
    FOR SELECT USING (is_active_company_member(auth.uid(), company_id));

CREATE POLICY "screening_tests_insert_hr" ON public.screening_tests
    FOR INSERT WITH CHECK (can_use_recruitment(auth.uid(), company_id));

CREATE POLICY "screening_tests_update_hr" ON public.screening_tests
    FOR UPDATE USING (can_use_recruitment(auth.uid(), company_id))
    WITH CHECK (can_use_recruitment(auth.uid(), company_id));

CREATE POLICY "screening_tests_delete_hr" ON public.screening_tests
    FOR DELETE USING (can_use_recruitment(auth.uid(), company_id));

-- 13. RLS Policies for candidate_screenings
CREATE POLICY "candidate_screenings_select_hr" ON public.candidate_screenings
    FOR SELECT USING (can_use_recruitment(auth.uid(), company_id));

CREATE POLICY "candidate_screenings_select_by_token" ON public.candidate_screenings
    FOR SELECT USING (true);

CREATE POLICY "candidate_screenings_insert_hr" ON public.candidate_screenings
    FOR INSERT WITH CHECK (can_use_recruitment(auth.uid(), company_id));

CREATE POLICY "candidate_screenings_update_hr" ON public.candidate_screenings
    FOR UPDATE USING (can_use_recruitment(auth.uid(), company_id))
    WITH CHECK (can_use_recruitment(auth.uid(), company_id));

CREATE POLICY "candidate_screenings_update_by_token" ON public.candidate_screenings
    FOR UPDATE USING (true)
    WITH CHECK (true);

CREATE POLICY "candidate_screenings_delete_hr" ON public.candidate_screenings
    FOR DELETE USING (can_use_recruitment(auth.uid(), company_id));

-- 14. RLS Policies for interviews
CREATE POLICY "interviews_select_hr" ON public.interviews
    FOR SELECT USING (can_use_recruitment(auth.uid(), company_id));

CREATE POLICY "interviews_select_panelist" ON public.interviews
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.interview_panelists ip
            JOIN public.employees e ON e.id = ip.employee_id
            WHERE ip.interview_id = interviews.id AND e.user_id = auth.uid()
        )
    );

CREATE POLICY "interviews_insert_hr" ON public.interviews
    FOR INSERT WITH CHECK (can_use_recruitment(auth.uid(), company_id));

CREATE POLICY "interviews_update_hr" ON public.interviews
    FOR UPDATE USING (can_use_recruitment(auth.uid(), company_id))
    WITH CHECK (can_use_recruitment(auth.uid(), company_id));

CREATE POLICY "interviews_delete_hr" ON public.interviews
    FOR DELETE USING (can_use_recruitment(auth.uid(), company_id));

-- 15. RLS Policies for interview_panelists
CREATE POLICY "interview_panelists_select_hr" ON public.interview_panelists
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.interviews i
            WHERE i.id = interview_panelists.interview_id
            AND can_use_recruitment(auth.uid(), i.company_id)
        )
    );

CREATE POLICY "interview_panelists_select_own" ON public.interview_panelists
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.employees e
            WHERE e.id = interview_panelists.employee_id AND e.user_id = auth.uid()
        )
    );

CREATE POLICY "interview_panelists_insert_hr" ON public.interview_panelists
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.interviews i
            WHERE i.id = interview_panelists.interview_id
            AND can_use_recruitment(auth.uid(), i.company_id)
        )
    );

CREATE POLICY "interview_panelists_update_hr" ON public.interview_panelists
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.interviews i
            WHERE i.id = interview_panelists.interview_id
            AND can_use_recruitment(auth.uid(), i.company_id)
        )
    );

CREATE POLICY "interview_panelists_delete_hr" ON public.interview_panelists
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.interviews i
            WHERE i.id = interview_panelists.interview_id
            AND can_use_recruitment(auth.uid(), i.company_id)
        )
    );

-- 16. RLS Policies for interview_feedback
CREATE POLICY "interview_feedback_select_hr" ON public.interview_feedback
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.interviews i
            WHERE i.id = interview_feedback.interview_id
            AND can_use_recruitment(auth.uid(), i.company_id)
        )
    );

CREATE POLICY "interview_feedback_select_own" ON public.interview_feedback
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.interview_panelists ip
            JOIN public.employees e ON e.id = ip.employee_id
            WHERE ip.id = interview_feedback.panelist_id AND e.user_id = auth.uid()
        )
    );

CREATE POLICY "interview_feedback_insert_panelist" ON public.interview_feedback
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.interview_panelists ip
            JOIN public.employees e ON e.id = ip.employee_id
            WHERE ip.id = interview_feedback.panelist_id AND e.user_id = auth.uid()
        )
    );

CREATE POLICY "interview_feedback_update_own" ON public.interview_feedback
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.interview_panelists ip
            JOIN public.employees e ON e.id = ip.employee_id
            WHERE ip.id = interview_feedback.panelist_id AND e.user_id = auth.uid()
        )
    );

-- 17. RLS Policies for job_offers
CREATE POLICY "job_offers_select_hr" ON public.job_offers
    FOR SELECT USING (can_use_recruitment(auth.uid(), company_id));

CREATE POLICY "job_offers_select_by_token" ON public.job_offers
    FOR SELECT USING (true);

CREATE POLICY "job_offers_insert_hr" ON public.job_offers
    FOR INSERT WITH CHECK (can_use_recruitment(auth.uid(), company_id));

CREATE POLICY "job_offers_update_hr" ON public.job_offers
    FOR UPDATE USING (can_use_recruitment(auth.uid(), company_id))
    WITH CHECK (can_use_recruitment(auth.uid(), company_id));

CREATE POLICY "job_offers_update_by_token" ON public.job_offers
    FOR UPDATE USING (true)
    WITH CHECK (true);

CREATE POLICY "job_offers_delete_hr" ON public.job_offers
    FOR DELETE USING (can_use_recruitment(auth.uid(), company_id));

-- 18. RLS Policies for candidate_timeline
CREATE POLICY "candidate_timeline_select_hr" ON public.candidate_timeline
    FOR SELECT USING (can_use_recruitment(auth.uid(), company_id));

CREATE POLICY "candidate_timeline_insert_hr" ON public.candidate_timeline
    FOR INSERT WITH CHECK (can_use_recruitment(auth.uid(), company_id));

-- 19. Add triggers for updated_at
CREATE TRIGGER update_screening_tests_updated_at
    BEFORE UPDATE ON public.screening_tests
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_candidate_screenings_updated_at
    BEFORE UPDATE ON public.candidate_screenings
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_interviews_updated_at
    BEFORE UPDATE ON public.interviews
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_job_offers_updated_at
    BEFORE UPDATE ON public.job_offers
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();