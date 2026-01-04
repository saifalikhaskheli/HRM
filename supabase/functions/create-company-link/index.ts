import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CreateLinkRequest {
  plan_id?: string;
  email?: string;  // Optional: restrict to specific email
  modules?: string[];
  enable_trial?: boolean;
  trial_days?: number;
  billing_interval?: 'monthly' | 'yearly';
  expires_in_hours?: number;
  notes?: string;
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Check if user is platform admin
    const { data: platformAdmin } = await supabaseAdmin
      .from("platform_admins")
      .select("id, role")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .maybeSingle();

    if (!platformAdmin) {
      return new Response(
        JSON.stringify({ error: "Forbidden", message: "Only platform admins can create company links" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body: CreateLinkRequest = await req.json();

    // Get plan configuration if plan_id is provided
    let planConfig: { name: string; trial_enabled: boolean | null; trial_default_days: number | null } | null = null;
    if (body.plan_id) {
      const { data: plan } = await supabaseAdmin
        .from("plans")
        .select("name, trial_enabled, trial_default_days")
        .eq("id", body.plan_id)
        .single();
      planConfig = plan;
    }

    // Determine trial settings
    const planTrialEnabled = planConfig?.trial_enabled !== false;
    const enableTrial = body.enable_trial !== false && planTrialEnabled;
    const trialDays = body.trial_days ?? planConfig?.trial_default_days ?? 14;

    // Calculate expiry
    const expiresInHours = body.expires_in_hours || 72; // Default 3 days
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + expiresInHours);

    // Create the link
    const { data: link, error: linkError } = await supabaseAdmin
      .from("company_creation_links")
      .insert({
        plan_id: body.plan_id || null,
        email: body.email || null,
        modules: body.modules || [],
        enable_trial: enableTrial,
        trial_days: enableTrial ? trialDays : null,
        billing_interval: body.billing_interval || 'monthly',
        expires_at: expiresAt.toISOString(),
        max_uses: 1,
        uses: 0,
        created_by: user.id,
        notes: body.notes || null,
      })
      .select()
      .single();

    if (linkError) {
      console.error("Error creating link:", linkError);
      return new Response(
        JSON.stringify({ error: "Database Error", message: linkError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get base domain for URL
    let baseDomain = 'hrplatform.com';
    const { data: brandingSettings } = await supabaseAdmin
      .from("platform_settings")
      .select("value")
      .eq("key", "branding")
      .maybeSingle();

    if (brandingSettings?.value?.base_domain) {
      baseDomain = brandingSettings.value.base_domain;
    }

    const signupUrl = `https://${baseDomain}/setup?token=${link.token}`;

    // Log the event
    await supabaseAdmin.from("onboarding_logs").insert({
      event_type: "link_generated",
      user_id: user.id,
      link_id: link.id,
      metadata: {
        plan_id: body.plan_id,
        email: body.email,
        enable_trial: enableTrial,
        trial_days: enableTrial ? trialDays : null,
        expires_at: expiresAt.toISOString(),
        expires_in_hours: expiresInHours,
      },
    });

    // Email status tracking
    let emailStatus: 'sent' | 'skipped' | 'failed' = 'skipped';
    let emailError: string | undefined;

    // Send email if email is specified
    if (body.email) {
      try {
        const planName = planConfig?.name || '';
        const senderName = user.email || 'Platform Admin';
        const expiresAtFormatted = expiresAt.toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        });

        console.log(`Sending creation link email to ${body.email}`);

        const { data: emailResult, error: emailInvokeError } = await supabaseAdmin.functions.invoke('send-email', {
          headers: {
            // Use service role so send-email can treat this as an internal call (no user JWT dependency)
            Authorization: `Bearer ${supabaseServiceKey}`,
          },
          body: {
            template: 'company_creation_link',
            to: { email: body.email },
            data: {
              recipientEmail: body.email,
              signupUrl,
              expiresAt: expiresAtFormatted,
              planName,
              trialDays: enableTrial ? trialDays : 0,
              senderName,
            },
          },
        });

        if (emailInvokeError) {
          console.error("Failed to invoke send-email:", emailInvokeError);
          emailStatus = 'failed';
          emailError = emailInvokeError.message;
        } else if (emailResult?.error) {
          console.error("Email send failed:", emailResult.error, emailResult.message);
          emailStatus = 'failed';
          emailError = emailResult.message || emailResult.error;
        } else {
          emailStatus = 'sent';
          console.log("Link email sent successfully:", emailResult);
        }
      } catch (err) {
        console.error("Failed to send link email:", err);
        emailStatus = 'failed';
        emailError = err instanceof Error ? err.message : 'Unknown error';
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        link: {
          id: link.id,
          token: link.token,
          signup_url: signupUrl,
          expires_at: link.expires_at,
          email: link.email,
          enable_trial: enableTrial,
          trial_days: enableTrial ? trialDays : null,
        },
        email_status: emailStatus,
        email_error: emailError,
      }),
      { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in create-company-link:", error);
    return new Response(
      JSON.stringify({ error: "Internal Server Error", message: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
