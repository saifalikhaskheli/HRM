import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NotificationRequest {
  type: 'screening_assigned' | 'interview_scheduled' | 'offer_sent';
  candidateId: string;
  screeningId?: string;
  accessToken?: string;
  interviewId?: string;
  panelistIds?: string[];
  offerId?: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const body: NotificationRequest = await req.json();
    const { type, candidateId, screeningId, accessToken, interviewId, panelistIds, offerId } = body;

    console.log(`Processing ${type} notification for candidate ${candidateId}`);

    // Fetch candidate info
    const { data: candidate, error: candidateError } = await supabase
      .from('candidates')
      .select(`
        id, first_name, last_name, email,
        job:jobs(id, title, company:companies(id, name, slug))
      `)
      .eq('id', candidateId)
      .single();

    if (candidateError || !candidate) {
      console.error('Failed to fetch candidate:', candidateError);
      return new Response(
        JSON.stringify({ success: false, error: 'Candidate not found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    const candidateName = `${candidate.first_name} ${candidate.last_name}`;
    const companyName = (candidate.job as any)?.company?.name || 'Company';
    const jobTitle = (candidate.job as any)?.title || 'Position';
    const companySlug = (candidate.job as any)?.company?.slug || '';
    const baseUrl = Deno.env.get('SITE_URL') || `https://${companySlug}.lovable.app`;

    let emailSubject = '';
    let emailHtml = '';
    let emailText = '';
    const recipientEmails: { email: string; name: string }[] = [];

    // Build email based on notification type
    if (type === 'screening_assigned' && screeningId && accessToken) {
      const { data: screening } = await supabase
        .from('candidate_screenings')
        .select(`
          id, expires_at,
          screening_test:screening_tests(id, title, duration_minutes)
        `)
        .eq('id', screeningId)
        .single();

      const testTitle = (screening?.screening_test as any)?.title || 'Assessment';
      const duration = (screening?.screening_test as any)?.duration_minutes || 60;
      const expiresAt = screening?.expires_at ? new Date(screening.expires_at).toLocaleDateString() : 'soon';
      const screeningUrl = `${baseUrl}/screening/${accessToken}`;

      emailSubject = `Complete Your ${testTitle} for ${jobTitle} at ${companyName}`;
      emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #6366f1;">Screening Test Assigned</h1>
          <p>Hello ${candidateName},</p>
          <p>Thank you for your application for the <strong>${jobTitle}</strong> position at <strong>${companyName}</strong>.</p>
          <p>We would like you to complete a screening assessment as part of our evaluation process:</p>
          <div style="background: #f8fafc; border-left: 4px solid #6366f1; padding: 15px; margin: 20px 0;">
            <p><strong>Test:</strong> ${testTitle}</p>
            <p><strong>Duration:</strong> ${duration} minutes</p>
            <p><strong>Complete by:</strong> ${expiresAt}</p>
          </div>
          <p style="text-align: center; margin: 30px 0;">
            <a href="${screeningUrl}" style="background: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Start Assessment</a>
          </p>
          <p style="color: #64748b; font-size: 14px;">If you have any questions, please reply to this email.</p>
        </div>
      `;
      emailText = `Screening Test Assigned\n\nHello ${candidateName},\n\nPlease complete the ${testTitle} assessment for your ${jobTitle} application at ${companyName}.\n\nStart here: ${screeningUrl}\n\nComplete by: ${expiresAt}`;

      recipientEmails.push({ email: candidate.email, name: candidateName });
    }

    if (type === 'interview_scheduled' && interviewId) {
      const { data: interview } = await supabase
        .from('interviews')
        .select(`
          id, title, interview_type, scheduled_at, duration_minutes, location, meeting_link,
          panelists:interview_panelists(
            employee:employees(id, first_name, last_name, email)
          )
        `)
        .eq('id', interviewId)
        .single();

      if (!interview) {
        console.error('Interview not found');
        return new Response(
          JSON.stringify({ success: false, error: 'Interview not found' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
        );
      }

      const scheduledDate = new Date(interview.scheduled_at).toLocaleDateString('en-US', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
      });
      const scheduledTime = new Date(interview.scheduled_at).toLocaleTimeString('en-US', {
        hour: '2-digit', minute: '2-digit'
      });
      const meetingInfo = interview.meeting_link 
        ? `<p><strong>Meeting Link:</strong> <a href="${interview.meeting_link}">${interview.meeting_link}</a></p>`
        : interview.location 
          ? `<p><strong>Location:</strong> ${interview.location}</p>`
          : '';

      // Email to candidate
      emailSubject = `Interview Scheduled: ${interview.title} at ${companyName}`;
      emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #6366f1;">Interview Scheduled</h1>
          <p>Hello ${candidateName},</p>
          <p>Your interview for the <strong>${jobTitle}</strong> position at <strong>${companyName}</strong> has been scheduled.</p>
          <div style="background: #f8fafc; border-left: 4px solid #6366f1; padding: 15px; margin: 20px 0;">
            <p><strong>Interview:</strong> ${interview.title}</p>
            <p><strong>Type:</strong> ${interview.interview_type}</p>
            <p><strong>Date:</strong> ${scheduledDate}</p>
            <p><strong>Time:</strong> ${scheduledTime}</p>
            <p><strong>Duration:</strong> ${interview.duration_minutes} minutes</p>
            ${meetingInfo}
          </div>
          <p>We look forward to speaking with you!</p>
          <p style="color: #64748b; font-size: 14px;">If you need to reschedule, please reply to this email as soon as possible.</p>
        </div>
      `;
      emailText = `Interview Scheduled\n\nHello ${candidateName},\n\nYour ${interview.title} interview for ${jobTitle} at ${companyName} is scheduled for ${scheduledDate} at ${scheduledTime}.\n\n${interview.meeting_link || interview.location || ''}\n\nDuration: ${interview.duration_minutes} minutes`;

      recipientEmails.push({ email: candidate.email, name: candidateName });

      // Also notify panelists
      if (interview.panelists && Array.isArray(interview.panelists)) {
        for (const panelist of interview.panelists) {
          const emp = (panelist as any).employee;
          if (emp?.email) {
            recipientEmails.push({ 
              email: emp.email, 
              name: `${emp.first_name} ${emp.last_name}` 
            });
          }
        }
      }
    }

    if (type === 'offer_sent' && offerId) {
      const { data: offer } = await supabase
        .from('job_offers')
        .select('id, salary_offered, salary_currency, start_date, offer_expiry_date, access_token')
        .eq('id', offerId)
        .single();

      if (!offer) {
        console.error('Offer not found');
        return new Response(
          JSON.stringify({ success: false, error: 'Offer not found' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
        );
      }

      const startDate = new Date(offer.start_date).toLocaleDateString();
      const expiryDate = new Date(offer.offer_expiry_date).toLocaleDateString();
      const salary = `${offer.salary_currency} ${offer.salary_offered.toLocaleString()}`;

      emailSubject = `Job Offer: ${jobTitle} at ${companyName}`;
      emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #10b981;">Congratulations!</h1>
          <p>Dear ${candidateName},</p>
          <p>We are pleased to offer you the position of <strong>${jobTitle}</strong> at <strong>${companyName}</strong>!</p>
          <div style="background: #f0fdf4; border-left: 4px solid #10b981; padding: 15px; margin: 20px 0;">
            <p><strong>Position:</strong> ${jobTitle}</p>
            <p><strong>Salary:</strong> ${salary}</p>
            <p><strong>Start Date:</strong> ${startDate}</p>
            <p><strong>Offer Valid Until:</strong> ${expiryDate}</p>
          </div>
          <p>Please review the offer details and let us know your decision.</p>
          <p style="color: #64748b; font-size: 14px;">If you have any questions about the offer, please don't hesitate to reach out.</p>
        </div>
      `;
      emailText = `Congratulations!\n\nDear ${candidateName},\n\nWe are pleased to offer you the ${jobTitle} position at ${companyName}!\n\nSalary: ${salary}\nStart Date: ${startDate}\nOffer Valid Until: ${expiryDate}\n\nPlease review and let us know your decision.`;

      recipientEmails.push({ email: candidate.email, name: candidateName });
    }

    // Send emails
    if (recipientEmails.length > 0 && emailSubject && emailHtml) {
      for (const recipient of recipientEmails) {
        console.log(`Sending ${type} email to ${recipient.email}`);
        
        // Log email
        await supabase.from('email_logs').insert({
          company_id: (candidate.job as any)?.company?.id,
          recipient_email: recipient.email,
          recipient_name: recipient.name,
          subject: emailSubject,
          template_type: type,
          status: 'pending',
          triggered_from: 'send-recruitment-notification',
        });

        // Use send-email function
        try {
          await supabase.functions.invoke('send-email', {
            body: {
              to: [recipient],
              subject: emailSubject,
              html: emailHtml,
              text: emailText,
              companyId: (candidate.job as any)?.company?.id,
            },
          });
        } catch (e) {
          console.error(`Failed to send email to ${recipient.email}:`, e);
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, emailsSent: recipientEmails.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in send-recruitment-notification:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
