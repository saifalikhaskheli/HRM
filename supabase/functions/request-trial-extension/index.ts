import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RequestTrialExtensionPayload {
  companyId: string;
  requestedDays: number;
  reason: string;
}

serve(async (req: Request) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    // Get auth token
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create client with user's token
    const supabaseUser = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } }
    });

    // Get user
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const payload: RequestTrialExtensionPayload = await req.json();
    const { companyId, requestedDays, reason } = payload;

    console.log(`Trial extension request from user ${user.id} for company ${companyId}`);

    // Validate input
    if (!companyId || !reason || !requestedDays) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: companyId, requestedDays, reason" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (requestedDays < 1 || requestedDays > 30) {
      return new Response(
        JSON.stringify({ error: "Requested days must be between 1 and 30" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Service client for admin operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Check if user is company admin
    const { data: companyUser, error: cuError } = await supabaseAdmin
      .from("company_users")
      .select("role, is_active")
      .eq("company_id", companyId)
      .eq("user_id", user.id)
      .single();

    if (cuError || !companyUser) {
      return new Response(
        JSON.stringify({ error: "User is not a member of this company" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!companyUser.is_active || !["super_admin", "company_admin"].includes(companyUser.role)) {
      return new Response(
        JSON.stringify({ error: "Only company admins can request trial extensions" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get company and subscription
    const { data: company, error: companyError } = await supabaseAdmin
      .from("companies")
      .select("id, name, is_active")
      .eq("id", companyId)
      .single();

    if (companyError || !company) {
      return new Response(
        JSON.stringify({ error: "Company not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: subscription, error: subError } = await supabaseAdmin
      .from("company_subscriptions")
      .select("id, status, trial_ends_at")
      .eq("company_id", companyId)
      .single();

    if (subError || !subscription) {
      return new Response(
        JSON.stringify({ error: "No subscription found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (subscription.status !== "trialing") {
      return new Response(
        JSON.stringify({ error: "Trial extensions are only available for trialing companies" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get platform trial settings
    const { data: trialSettings } = await supabaseAdmin
      .from("platform_settings")
      .select("value")
      .eq("key", "trial")
      .single();

    const settings = trialSettings?.value as {
      extend_allowed?: boolean;
      max_extensions?: number;
      default_days?: number;
    } || { extend_allowed: true, max_extensions: 2 };

    if (!settings.extend_allowed) {
      return new Response(
        JSON.stringify({ error: "Trial extensions are not allowed" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check for pending request
    const { data: pendingRequest } = await supabaseAdmin
      .from("trial_extension_requests")
      .select("id")
      .eq("company_id", companyId)
      .eq("status", "pending")
      .single();

    if (pendingRequest) {
      return new Response(
        JSON.stringify({ error: "You already have a pending extension request" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Count approved extensions
    const { count: approvedCount } = await supabaseAdmin
      .from("trial_extension_requests")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId)
      .eq("status", "approved");

    const maxExtensions = settings.max_extensions || 2;
    if ((approvedCount || 0) >= maxExtensions) {
      return new Response(
        JSON.stringify({ error: `Maximum of ${maxExtensions} trial extensions allowed` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create the request
    const { data: newRequest, error: insertError } = await supabaseAdmin
      .from("trial_extension_requests")
      .insert({
        company_id: companyId,
        requested_by: user.id,
        requested_days: requestedDays,
        reason: reason,
        extension_number: (approvedCount || 0) + 1,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Error creating extension request:", insertError);
      return new Response(
        JSON.stringify({ error: "Failed to create extension request" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Created trial extension request ${newRequest.id}`);

    // Notify platform admins via email
    const { data: platformAdmins } = await supabaseAdmin
      .from("platform_admins")
      .select("user_id")
      .eq("is_active", true);

    if (platformAdmins && platformAdmins.length > 0) {
      const adminIds = platformAdmins.map(a => a.user_id);
      const { data: adminProfiles } = await supabaseAdmin
        .from("profiles")
        .select("email, first_name")
        .in("id", adminIds);

      // Get user profile for the requester
      const { data: requesterProfile } = await supabaseAdmin
        .from("profiles")
        .select("email, first_name, last_name")
        .eq("id", user.id)
        .single();

      const requesterName = requesterProfile
        ? `${requesterProfile.first_name || ''} ${requesterProfile.last_name || ''}`.trim() || requesterProfile.email
        : user.email;

      // Send email to each admin
      if (adminProfiles && adminProfiles.length > 0) {
        for (const admin of adminProfiles) {
          try {
            await supabaseAdmin.functions.invoke("send-email", {
              body: {
                to: [{ email: admin.email, name: admin.first_name || "Admin" }],
                subject: `Trial Extension Request: ${company.name}`,
                html: `
                  <h2>New Trial Extension Request</h2>
                  <p><strong>${requesterName}</strong> from <strong>${company.name}</strong> has requested a trial extension.</p>
                  <ul>
                    <li><strong>Requested Days:</strong> ${requestedDays}</li>
                    <li><strong>Reason:</strong> ${reason}</li>
                    <li><strong>Extension Number:</strong> ${(approvedCount || 0) + 1} of ${maxExtensions}</li>
                  </ul>
                  <p>Please review this request in the platform admin dashboard.</p>
                `,
                text: `New Trial Extension Request\n\n${requesterName} from ${company.name} has requested a ${requestedDays}-day trial extension.\n\nReason: ${reason}\n\nPlease review this request in the platform admin dashboard.`
              }
            });
            console.log(`Sent notification to admin: ${admin.email}`);
          } catch (emailError) {
            console.error(`Failed to send email to ${admin.email}:`, emailError);
          }
        }
      }
    }

    // Log billing event
    await supabaseAdmin.from("billing_logs").insert({
      company_id: companyId,
      event_type: "trial_extension_requested",
      metadata: {
        requested_days: requestedDays,
        request_id: newRequest.id,
        extension_number: (approvedCount || 0) + 1,
        requested_by: user.id,
      },
    });

    // Log audit event
    await supabaseAdmin.from("audit_logs").insert({
      company_id: companyId,
      user_id: user.id,
      action: "create",
      table_name: "trial_extension_requests",
      record_id: newRequest.id,
      actor_role: companyUser.role,
      target_type: "subscription",
      severity: "medium",
      metadata: {
        requested_days: requestedDays,
        extension_number: (approvedCount || 0) + 1,
      },
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        request: newRequest,
        message: "Extension request submitted successfully"
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in request-trial-extension:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
