import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ReviewReminder {
  review_id: string;
  company_id: string;
  reviewer_id: string;
  reviewer_user_id: string;
  reviewer_email: string;
  reviewer_name: string;
  employee_name: string;
  review_period_end: string;
  days_until_due: number;
  status: string;
}

interface EscalationRecord {
  review_id: string;
  company_id: string;
  reviewer_id: string;
  employee_id: string;
  manager_of_reviewer: string;
  days_overdue: number;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log("Starting performance review reminders cron...");

    let remindersSent = 0;
    let escalationsSent = 0;
    let errors = 0;

    // 1. Process review reminders
    const { data: reminders, error: remindersError } = await supabase
      .rpc('get_reviews_needing_reminders');

    if (remindersError) {
      console.error("Error fetching reminders:", remindersError);
    } else {
      console.log(`Found ${reminders?.length || 0} reviews needing reminders`);

      for (const reminder of (reminders || []) as ReviewReminder[]) {
        // Check if we already sent this reminder today
        const today = new Date().toISOString().split('T')[0];
        const { data: existingReminder } = await supabase
          .from('review_reminders')
          .select('id')
          .eq('review_id', reminder.review_id)
          .eq('reminder_type', 'reminder')
          .eq('days_remaining', reminder.days_until_due)
          .gte('sent_at', today)
          .single();

        if (existingReminder) {
          console.log(`Reminder already sent for review ${reminder.review_id}`);
          continue;
        }

        try {
          // Send reminder email
          const urgency = reminder.days_until_due <= 1 ? 'urgent' : 
                         reminder.days_until_due <= 3 ? 'warning' : 'info';
          
          const subject = reminder.days_until_due === 1
            ? `⚠️ Last Day: Performance review for ${reminder.employee_name} due today`
            : `⏰ Reminder: Performance review for ${reminder.employee_name} due in ${reminder.days_until_due} days`;

          await supabase.functions.invoke('send-notification', {
            body: {
              userId: reminder.reviewer_user_id,
              type: 'review_reminder',
              title: subject,
              message: `Your performance review for ${reminder.employee_name} is due on ${new Date(reminder.review_period_end).toLocaleDateString()}. Please complete it before the deadline.`,
              link: `/app/performance`,
            }
          });

          // Log the reminder
          await supabase.from('review_reminders').insert({
            review_id: reminder.review_id,
            company_id: reminder.company_id,
            reminder_type: 'reminder',
            days_remaining: reminder.days_until_due,
            sent_to: reminder.reviewer_user_id,
          });

          console.log(`Sent reminder for review ${reminder.review_id} to ${reminder.reviewer_email}`);
          remindersSent++;
        } catch (err) {
          console.error(`Failed to send reminder for review ${reminder.review_id}:`, err);
          errors++;
        }
      }
    }

    // 2. Process escalations for overdue reviews
    const { data: escalations, error: escalationsError } = await supabase
      .rpc('get_reviews_needing_escalation', { _escalation_days: 7 });

    if (escalationsError) {
      console.error("Error fetching escalations:", escalationsError);
    } else {
      console.log(`Found ${escalations?.length || 0} reviews needing escalation`);

      for (const escalation of (escalations || []) as EscalationRecord[]) {
        // Check if we already escalated this review
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        
        const { data: existingEscalation } = await supabase
          .from('review_reminders')
          .select('id')
          .eq('review_id', escalation.review_id)
          .eq('reminder_type', 'escalation')
          .gte('sent_at', weekAgo.toISOString())
          .single();

        if (existingEscalation) {
          console.log(`Escalation already sent for review ${escalation.review_id}`);
          continue;
        }

        try {
          // Get manager's user info
          const { data: manager } = await supabase
            .from('employees')
            .select('user_id, first_name, last_name, email')
            .eq('id', escalation.manager_of_reviewer)
            .single();

          if (!manager?.user_id) {
            console.log(`No user linked to manager ${escalation.manager_of_reviewer}`);
            continue;
          }

          // Get reviewer and employee names
          const { data: reviewer } = await supabase
            .from('employees')
            .select('first_name, last_name')
            .eq('id', escalation.reviewer_id)
            .single();

          const { data: employee } = await supabase
            .from('employees')
            .select('first_name, last_name')
            .eq('id', escalation.employee_id)
            .single();

          const reviewerName = reviewer ? `${reviewer.first_name} ${reviewer.last_name}` : 'A reviewer';
          const employeeName = employee ? `${employee.first_name} ${employee.last_name}` : 'an employee';

          // Send escalation notification to manager
          await supabase.functions.invoke('send-notification', {
            body: {
              userId: manager.user_id,
              type: 'review_escalation',
              title: `⚠️ Overdue Review: ${reviewerName}'s review for ${employeeName}`,
              message: `The performance review by ${reviewerName} for ${employeeName} is ${escalation.days_overdue} days overdue. Please follow up.`,
              link: `/app/performance`,
            }
          });

          // Log the escalation
          await supabase.from('review_reminders').insert({
            review_id: escalation.review_id,
            company_id: escalation.company_id,
            reminder_type: 'escalation',
            days_remaining: -escalation.days_overdue,
            sent_to: manager.user_id,
          });

          console.log(`Sent escalation for review ${escalation.review_id} to manager ${manager.email}`);
          escalationsSent++;
        } catch (err) {
          console.error(`Failed to send escalation for review ${escalation.review_id}:`, err);
          errors++;
        }
      }
    }

    console.log(`Cron completed: ${remindersSent} reminders, ${escalationsSent} escalations, ${errors} errors`);

    return new Response(
      JSON.stringify({
        success: true,
        remindersSent,
        escalationsSent,
        errors,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in cron-performance-reminders:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
