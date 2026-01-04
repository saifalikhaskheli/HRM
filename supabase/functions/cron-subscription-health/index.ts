import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log("Starting subscription health cron...");

    const results = {
      trialsExpired: 0,
      trialWarningsSent: 0,
      companiesFrozen: 0,
      errors: 0,
    };

    // 1. Process expired trials (transition status)
    console.log("Processing expired trials...");
    const { data: expiredTrials, error: expireError } = await supabase
      .rpc('process_expired_trials', { _freeze_after_days: 14 }); // Freeze 14 days after expiry

    if (expireError) {
      console.error("Error processing expired trials:", expireError);
      results.errors++;
    } else {
      for (const trial of expiredTrials || []) {
        console.log(`Processed ${trial.company_name}: ${trial.action_taken}`);
        if (trial.action_taken === 'frozen') {
          results.companiesFrozen++;
        } else {
          results.trialsExpired++;
        }
      }
    }

    // 2. Send trial expiring warnings (7, 3, 1 days)
    console.log("Checking for trial warnings...");
    const warningDays = [7, 3, 1];
    
    for (const days of warningDays) {
      const { data: expiringTrials, error: fetchError } = await supabase
        .rpc('get_expiring_trials', { _days_threshold: days });

      if (fetchError) {
        console.error(`Error fetching ${days}-day expiring trials:`, fetchError);
        continue;
      }

      const exactDayTrials = (expiringTrials || []).filter(
        (t: { days_remaining: number }) => t.days_remaining === days
      );

      console.log(`Found ${exactDayTrials.length} trials expiring in exactly ${days} days`);

      for (const trial of exactDayTrials as {
        company_id: string;
        company_name: string;
        trial_ends_at: string;
        days_remaining: number;
        admin_emails: string[];
      }[]) {
        const today = new Date().toISOString().split('T')[0];
        const emailType = `trial_expiring_${days}_day${days === 1 ? '' : 's'}`;

        // Check if we already sent this warning today
        const { data: existingLog } = await supabase
          .from('trial_email_logs')
          .select('id')
          .eq('company_id', trial.company_id)
          .eq('email_type', emailType)
          .eq('sent_date', today)
          .single();

        if (existingLog) {
          console.log(`Warning already sent today for ${trial.company_name}`);
          continue;
        }

        // Get admin user IDs for notifications
        const { data: companyAdmins } = await supabase
          .from('company_users')
          .select('user_id')
          .eq('company_id', trial.company_id)
          .eq('is_active', true)
          .in('role', ['super_admin', 'company_admin']);

        for (const admin of companyAdmins || []) {
          try {
            const urgency = days === 1 ? '⚠️ URGENT: ' : days === 3 ? '⏰ ' : '📅 ';
            
            await supabase.functions.invoke('send-notification', {
              body: {
                userId: admin.user_id,
                type: 'trial_expiring',
                title: `${urgency}Your trial expires in ${days} day${days === 1 ? '' : 's'}`,
                message: days === 1
                  ? `Your ${trial.company_name} trial ends today! Upgrade now to avoid losing access.`
                  : `Your ${trial.company_name} trial expires on ${new Date(trial.trial_ends_at).toLocaleDateString()}. Upgrade to continue using all features.`,
                link: '/app/settings/billing',
              }
            });

            results.trialWarningsSent++;
          } catch (err) {
            console.error(`Failed to send notification to admin:`, err);
            results.errors++;
          }
        }

        // Log that we sent warnings
        for (const email of trial.admin_emails || []) {
          await supabase.from('trial_email_logs').insert({
            company_id: trial.company_id,
            email_type: emailType,
            recipient_email: email,
            days_remaining: days,
            sent_date: today,
          });
        }
      }
    }

    // 3. Send trial expired notifications
    console.log("Sending trial expired notifications...");
    const { data: justExpired } = await supabase
      .from('company_subscriptions')
      .select(`
        company_id,
        trial_ends_at,
        companies(name)
      `)
      .eq('status', 'trial_expired')
      .gte('updated_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()); // Last 24 hours

    for (const sub of justExpired || []) {
      const company = sub.companies as unknown as { name: string };
      
      const { data: companyAdmins } = await supabase
        .from('company_users')
        .select('user_id')
        .eq('company_id', sub.company_id)
        .eq('is_active', true)
        .in('role', ['super_admin', 'company_admin']);

      for (const admin of companyAdmins || []) {
        try {
          await supabase.functions.invoke('send-notification', {
            body: {
              userId: admin.user_id,
              type: 'trial_expired',
              title: '🚫 Trial Expired',
              message: `Your ${company?.name || 'company'} trial has expired. Upgrade to restore full access.`,
              link: '/app/settings/billing',
            }
          });
        } catch (err) {
          console.error('Failed to send trial expired notification:', err);
          results.errors++;
        }
      }
    }

    console.log(`Subscription health cron completed:`, results);

    return new Response(
      JSON.stringify({ success: true, ...results }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in cron-subscription-health:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
