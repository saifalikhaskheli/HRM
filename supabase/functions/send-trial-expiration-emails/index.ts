import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const EMAIL_THRESHOLDS = [7, 3, 1];

interface TrialingCompany {
  company_id: string;
  trial_ends_at: string;
  companies: {
    id: string;
    name: string;
  };
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log("Starting trial expiration email job...");

    const now = new Date();
    const today = now.toISOString().split("T")[0];

    // Get all trialing companies
    const { data: trialingCompanies, error: fetchError } = await supabase
      .from("company_subscriptions")
      .select(`
        company_id,
        trial_ends_at,
        companies!inner(id, name)
      `)
      .eq("status", "trialing")
      .not("trial_ends_at", "is", null);

    if (fetchError) {
      console.error("Error fetching trialing companies:", fetchError);
      throw fetchError;
    }

    console.log(`Found ${trialingCompanies?.length || 0} trialing companies`);

    let emailsSent = 0;
    let errors = 0;

    for (const sub of (trialingCompanies || []) as unknown as TrialingCompany[]) {
      const trialEndDate = new Date(sub.trial_ends_at);
      const diffTime = trialEndDate.getTime() - now.getTime();
      const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      console.log(`Company ${sub.companies.name}: ${daysRemaining} days remaining`);

      // Check if this matches any of our thresholds
      if (!EMAIL_THRESHOLDS.includes(daysRemaining)) {
        continue;
      }

      const emailType = `trial_expiring_${daysRemaining}_day${daysRemaining === 1 ? '' : 's'}`;
      
      // Get company admins
      const { data: companyUsers, error: usersError } = await supabase
        .from("company_users")
        .select("user_id")
        .eq("company_id", sub.company_id)
        .eq("is_active", true)
        .in("role", ["super_admin", "company_admin"]);

      if (usersError || !companyUsers?.length) {
        console.log(`No admins found for company ${sub.companies.name}`);
        continue;
      }

      const userIds = companyUsers.map(cu => cu.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, email, first_name")
        .in("id", userIds);

      if (!profiles?.length) {
        console.log(`No profiles found for company admins`);
        continue;
      }

      // Get platform trial settings for extension info
      const { data: trialSettings } = await supabase
        .from("platform_settings")
        .select("value")
        .eq("key", "trial")
        .single();

      const settings = trialSettings?.value as {
        extend_allowed?: boolean;
        max_extensions?: number;
      } || { extend_allowed: true, max_extensions: 2 };

      // Count approved extensions for this company
      const { count: extensionCount } = await supabase
        .from("trial_extension_requests")
        .select("id", { count: "exact", head: true })
        .eq("company_id", sub.company_id)
        .eq("status", "approved");

      const canRequestExtension = settings.extend_allowed && 
        (extensionCount || 0) < (settings.max_extensions || 2);

      // Check for pending extension request
      const { data: pendingRequest } = await supabase
        .from("trial_extension_requests")
        .select("id")
        .eq("company_id", sub.company_id)
        .eq("status", "pending")
        .single();

      const hasPendingRequest = !!pendingRequest;

      for (const profile of profiles) {
        // Check if we already sent this email today
        const { data: existingLog } = await supabase
          .from("trial_email_logs")
          .select("id")
          .eq("company_id", sub.company_id)
          .eq("email_type", emailType)
          .eq("recipient_email", profile.email)
          .eq("sent_date", today)
          .single();

        if (existingLog) {
          console.log(`Email ${emailType} already sent to ${profile.email} today`);
          continue;
        }

        // Build email content
        const urgencyLevel = daysRemaining === 1 ? "urgent" : daysRemaining === 3 ? "warning" : "info";
        const subject = daysRemaining === 1 
          ? `⚠️ Last Day: Your ${sub.companies.name} trial ends today!`
          : daysRemaining === 3
          ? `⏰ Only 3 days left in your ${sub.companies.name} trial`
          : `📅 7 days left in your ${sub.companies.name} trial`;

        const upgradeUrl = `${Deno.env.get("APP_URL") || "https://app.example.com"}/app/settings/billing`;
        const extensionUrl = `${Deno.env.get("APP_URL") || "https://app.example.com"}/app/settings/billing`;

        let extensionMessage = "";
        if (canRequestExtension && !hasPendingRequest) {
          extensionMessage = `
            <p>Need more time? You can <a href="${extensionUrl}" style="color: #6366f1;">request a trial extension</a>.</p>
          `;
        } else if (hasPendingRequest) {
          extensionMessage = `<p>Your trial extension request is pending review.</p>`;
        }

        const htmlContent = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: ${urgencyLevel === 'urgent' ? '#dc2626' : urgencyLevel === 'warning' ? '#f59e0b' : '#6366f1'}; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
              .header h1 { color: white; margin: 0; font-size: 24px; }
              .content { background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; }
              .footer { background: #f9fafb; padding: 20px; text-align: center; font-size: 12px; color: #6b7280; border-radius: 0 0 8px 8px; }
              .button { display: inline-block; background: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500; margin: 20px 0; }
              .countdown { font-size: 48px; font-weight: bold; color: ${urgencyLevel === 'urgent' ? '#dc2626' : urgencyLevel === 'warning' ? '#f59e0b' : '#6366f1'}; text-align: center; margin: 20px 0; }
              .features { background: #f0f9ff; border-left: 4px solid #6366f1; padding: 15px; margin: 20px 0; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>${daysRemaining === 1 ? '⚠️ Last Day!' : daysRemaining === 3 ? '⏰ 3 Days Left' : '📅 7 Days Left'}</h1>
              </div>
              <div class="content">
                <p>Hi ${profile.first_name || 'there'},</p>
                
                <div class="countdown">${daysRemaining} day${daysRemaining === 1 ? '' : 's'}</div>
                <p style="text-align: center;">until your trial of <strong>${sub.companies.name}</strong> expires</p>
                
                ${daysRemaining === 1 ? `
                  <p><strong>Your trial ends today!</strong> To continue using all features without interruption, upgrade now.</p>
                ` : daysRemaining === 3 ? `
                  <p>Your trial is ending soon. Upgrade now to ensure uninterrupted access to all features.</p>
                ` : `
                  <p>You have one week left to explore all the features. Ready to commit? Upgrade today!</p>
                `}
                
                <div class="features">
                  <p><strong>When you upgrade, you'll keep:</strong></p>
                  <ul>
                    <li>All your employee data and records</li>
                    <li>Leave and time tracking history</li>
                    <li>Performance reviews and documents</li>
                    <li>Full access to all modules</li>
                  </ul>
                </div>
                
                <p style="text-align: center;">
                  <a href="${upgradeUrl}" class="button">Upgrade Now</a>
                </p>
                
                ${extensionMessage}
              </div>
              <div class="footer">
                <p>Questions? Contact our support team for help.</p>
              </div>
            </div>
          </body>
          </html>
        `;

        const textContent = `
Your ${sub.companies.name} trial expires in ${daysRemaining} day${daysRemaining === 1 ? '' : 's'}!

${daysRemaining === 1 ? 'Your trial ends today! Upgrade now to continue.' : 'Upgrade now to keep all your data and continue using all features.'}

Upgrade: ${upgradeUrl}

${canRequestExtension && !hasPendingRequest ? `Need more time? Request an extension: ${extensionUrl}` : ''}
        `.trim();

        try {
          // Send email
          await supabase.functions.invoke("send-email", {
            body: {
              to: [{ email: profile.email, name: profile.first_name || "User" }],
              subject: subject,
              html: htmlContent,
              text: textContent,
            }
          });

          // Log the sent email
          await supabase.from("trial_email_logs").insert({
            company_id: sub.company_id,
            email_type: emailType,
            recipient_email: profile.email,
            days_remaining: daysRemaining,
            sent_date: today,
          });

          console.log(`Sent ${emailType} email to ${profile.email} for ${sub.companies.name}`);
          emailsSent++;
        } catch (emailError) {
          console.error(`Failed to send email to ${profile.email}:`, emailError);
          errors++;
        }
      }
    }

    console.log(`Job completed: ${emailsSent} emails sent, ${errors} errors`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        emailsSent,
        errors,
        message: `Sent ${emailsSent} trial expiration emails`
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in send-trial-expiration-emails:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
