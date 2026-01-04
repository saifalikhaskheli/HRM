-- ================================================================
-- RECRUITMENT → EMPLOYEE AUTO-CONVERSION
-- ================================================================

-- ================================================================
-- FUNCTION: Convert accepted candidate to employee
-- Creates employee record from candidate data when offer is accepted
-- ================================================================
CREATE OR REPLACE FUNCTION public.convert_candidate_to_employee(
    _candidate_id UUID,
    _offer_id UUID,
    _create_login BOOLEAN DEFAULT false
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    _candidate RECORD;
    _offer RECORD;
    _job RECORD;
    _company_id UUID;
    _employee_id UUID;
    _employee_number TEXT;
    _new_user_id UUID;
BEGIN
    -- Get candidate details
    SELECT * INTO _candidate
    FROM public.candidates
    WHERE id = _candidate_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Candidate not found';
    END IF;
    
    _company_id := _candidate.company_id;
    
    -- Get offer details
    SELECT * INTO _offer
    FROM public.job_offers
    WHERE id = _offer_id
      AND candidate_id = _candidate_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Offer not found for candidate';
    END IF;
    
    IF _offer.status != 'accepted' THEN
        RAISE EXCEPTION 'Offer must be in accepted status';
    END IF;
    
    -- Get job details
    SELECT * INTO _job
    FROM public.jobs
    WHERE id = _offer.job_id;
    
    -- Generate employee number
    _employee_number := public.generate_employee_number(_company_id);
    
    -- Create employee record
    INSERT INTO public.employees (
        company_id,
        first_name,
        last_name,
        email,
        phone,
        employee_number,
        job_title,
        department_id,
        manager_id,
        salary,
        salary_currency,
        employment_type,
        employment_status,
        hire_date,
        metadata
    ) VALUES (
        _company_id,
        _candidate.first_name,
        _candidate.last_name,
        _candidate.email,
        _candidate.phone,
        _employee_number,
        _job.title,
        _offer.department_id,
        _offer.reporting_to,
        _offer.salary_offered,
        _offer.salary_currency,
        _offer.employment_type,
        'active',
        _offer.start_date,
        jsonb_build_object(
            'source', 'recruitment',
            'candidate_id', _candidate_id,
            'offer_id', _offer_id,
            'job_id', _job.id
        )
    )
    RETURNING id INTO _employee_id;
    
    -- Update candidate with hired employee reference
    UPDATE public.candidates
    SET status = 'hired',
        hired_employee_id = _employee_id,
        current_stage_started_at = NOW()
    WHERE id = _candidate_id;
    
    -- Add timeline event
    INSERT INTO public.candidate_timeline (
        company_id,
        candidate_id,
        event_type,
        title,
        description,
        metadata
    ) VALUES (
        _company_id,
        _candidate_id,
        'hired',
        'Candidate Hired',
        'Successfully converted to employee: ' || _employee_number,
        jsonb_build_object(
            'employee_id', _employee_id,
            'employee_number', _employee_number
        )
    );
    
    -- Log audit event
    PERFORM public.log_audit_event(
        _company_id,
        auth.uid(),
        'create',
        'employees',
        _employee_id,
        NULL,
        jsonb_build_object(
            'action', 'candidate_conversion',
            'candidate_id', _candidate_id,
            'offer_id', _offer_id
        )
    );
    
    RETURN _employee_id;
END;
$$;

-- ================================================================
-- FUNCTION: Accept offer (for candidate portal)
-- Updates offer status and triggers conversion
-- ================================================================
CREATE OR REPLACE FUNCTION public.accept_job_offer(
    _offer_id UUID,
    _access_token UUID,
    _response_notes TEXT DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    _offer RECORD;
    _employee_id UUID;
BEGIN
    -- Validate access token and get offer
    SELECT * INTO _offer
    FROM public.job_offers
    WHERE id = _offer_id
      AND access_token = _access_token
      AND status = 'sent';
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invalid or expired offer link';
    END IF;
    
    -- Check if offer has expired
    IF _offer.offer_expiry_date < CURRENT_DATE THEN
        UPDATE public.job_offers
        SET status = 'expired'
        WHERE id = _offer_id;
        
        RAISE EXCEPTION 'This offer has expired';
    END IF;
    
    -- Update offer to accepted
    UPDATE public.job_offers
    SET status = 'accepted',
        responded_at = NOW(),
        candidate_response = COALESCE(_response_notes, 'Offer accepted')
    WHERE id = _offer_id;
    
    -- Auto-convert candidate to employee
    _employee_id := public.convert_candidate_to_employee(
        _offer.candidate_id,
        _offer_id,
        false -- Don't auto-create login by default
    );
    
    RETURN jsonb_build_object(
        'success', true,
        'employee_id', _employee_id,
        'message', 'Offer accepted successfully. Welcome aboard!'
    );
END;
$$;

-- ================================================================
-- FUNCTION: Decline offer (for candidate portal)
-- ================================================================
CREATE OR REPLACE FUNCTION public.decline_job_offer(
    _offer_id UUID,
    _access_token UUID,
    _reason TEXT DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    _offer RECORD;
BEGIN
    -- Validate access token and get offer
    SELECT * INTO _offer
    FROM public.job_offers
    WHERE id = _offer_id
      AND access_token = _access_token
      AND status = 'sent';
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invalid or expired offer link';
    END IF;
    
    -- Update offer to declined
    UPDATE public.job_offers
    SET status = 'declined',
        responded_at = NOW(),
        candidate_response = COALESCE(_reason, 'Offer declined')
    WHERE id = _offer_id;
    
    -- Update candidate status back to rejected
    UPDATE public.candidates
    SET status = 'rejected',
        rejected_reason = 'Declined job offer: ' || COALESCE(_reason, 'No reason provided'),
        current_stage_started_at = NOW()
    WHERE id = _offer.candidate_id;
    
    -- Add timeline event
    INSERT INTO public.candidate_timeline (
        company_id,
        candidate_id,
        event_type,
        title,
        description,
        metadata
    ) VALUES (
        _offer.company_id,
        _offer.candidate_id,
        'offer_declined',
        'Offer Declined',
        'Candidate declined the job offer',
        jsonb_build_object('reason', _reason)
    );
    
    RETURN jsonb_build_object(
        'success', true,
        'message', 'Offer declined'
    );
END;
$$;

-- ================================================================
-- Grant permissions
-- ================================================================
GRANT EXECUTE ON FUNCTION public.convert_candidate_to_employee TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_job_offer TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.decline_job_offer TO anon, authenticated;