import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { EmailService } from "../_shared/email/index.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RequestMultiCompanyRequest {
  requested_count: number;
  reason: string;
}

serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.error("No authorization header provided");
      return new Response(
        JSON.stringify({ error: "Unauthorized", message: "No authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // User client for auth verification
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Verify user is authenticated
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      console.error("Auth error:", authError?.message);
      return new Response(
        JSON.stringify({ error: "Unauthorized", message: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request body
    const body: RequestMultiCompanyRequest = await req.json();

    // Validate
    if (!body.reason || body.reason.trim().length < 10) {
      return new Response(
        JSON.stringify({ error: "Validation Error", message: "Please provide a reason (at least 10 characters)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const requestedCount = body.requested_count || 2;
    if (requestedCount < 2 || requestedCount > 50) {
      return new Response(
        JSON.stringify({ error: "Validation Error", message: "Requested count must be between 2 and 50" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Get user profile
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("email, first_name, last_name, max_companies")
      .eq("id", user.id)
      .single();

    if (!profile) {
      return new Response(
        JSON.stringify({ error: "Not Found", message: "User profile not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if user already has sufficient access
    if (profile.max_companies >= requestedCount) {
      return new Response(
        JSON.stringify({ 
          error: "Already Granted", 
          message: `You already have access to ${profile.max_companies} companies` 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check for pending requests
    const { data: existingRequest } = await supabaseAdmin
      .from("multi_company_requests")
      .select("id, status")
      .eq("user_id", user.id)
      .eq("status", "pending")
      .maybeSingle();

    if (existingRequest) {
      return new Response(
        JSON.stringify({ 
          error: "Pending Request", 
          message: "You already have a pending request. Please wait for it to be reviewed." 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userName = [profile.first_name, profile.last_name].filter(Boolean).join(" ") || "Unknown";

    // Create the request
    const { data: request, error: insertError } = await supabaseAdmin
      .from("multi_company_requests")
      .insert({
        user_id: user.id,
        user_email: profile.email,
        user_name: userName,
        requested_count: requestedCount,
        reason: body.reason.trim(),
        status: "pending",
      })
      .select()
      .single();

    if (insertError) {
      console.error("Error creating request:", insertError);
      return new Response(
        JSON.stringify({ error: "Database Error", message: insertError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Multi-company access request created: ${request.id} by ${profile.email}`);

    // Get platform admin emails
    const { data: platformAdmins } = await supabaseAdmin
      .from("platform_admins")
      .select("user_id")
      .eq("is_active", true);

    if (platformAdmins && platformAdmins.length > 0) {
      const adminUserIds = platformAdmins.map(a => a.user_id);
      
      const { data: adminProfiles } = await supabaseAdmin
        .from("profiles")
        .select("email, first_name")
        .in("id", adminUserIds);

      if (adminProfiles && adminProfiles.length > 0) {
        const emailService = new EmailService();

        // Send notification to each platform admin
        for (const admin of adminProfiles) {
          try {
            await emailService.sendRaw({
              to: { email: admin.email, name: admin.first_name || undefined },
              subject: `[Action Required] Multi-Company Access Request from ${userName}`,
              html: `
                <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                  <h2 style="color: #333; margin-bottom: 20px;">New Multi-Company Access Request</h2>
                  
                  <div style="background: #f5f5f5; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
                    <p style="margin: 0 0 10px 0;"><strong>User:</strong> ${userName}</p>
                    <p style="margin: 0 0 10px 0;"><strong>Email:</strong> ${profile.email}</p>
                    <p style="margin: 0 0 10px 0;"><strong>Current Limit:</strong> ${profile.max_companies} company(ies)</p>
                    <p style="margin: 0 0 10px 0;"><strong>Requested:</strong> ${requestedCount} companies</p>
                  </div>
                  
                  <div style="background: #fff; border: 1px solid #e0e0e0; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
                    <h3 style="color: #333; margin: 0 0 10px 0;">Reason:</h3>
                    <p style="margin: 0; color: #555; white-space: pre-wrap;">${body.reason.trim()}</p>
                  </div>
                  
                  <p style="color: #666; font-size: 14px;">
                    To approve or reject this request, go to the Platform Admin &gt; Users page.
                  </p>
                  
                  <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 20px 0;" />
                  
                  <p style="color: #999; font-size: 12px;">
                    This is an automated notification from the HR Platform.
                  </p>
                </div>
              `,
              text: `New Multi-Company Access Request\n\nUser: ${userName}\nEmail: ${profile.email}\nCurrent Limit: ${profile.max_companies}\nRequested: ${requestedCount}\n\nReason:\n${body.reason.trim()}\n\nTo approve or reject this request, go to the Platform Admin > Users page.`,
            });
            console.log(`Notification email sent to platform admin: ${admin.email}`);
          } catch (emailError) {
            console.error(`Failed to send email to ${admin.email}:`, emailError);
            // Continue with other admins
          }
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Your request has been submitted. Platform administrators will review it shortly.",
        request_id: request.id,
      }),
      { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Unexpected error in request-multi-company:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: "Internal Server Error", message: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
