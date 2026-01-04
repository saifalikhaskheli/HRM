import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface FreezeCompanyRequest {
  company_id: string;
  action: "freeze" | "unfreeze";
  reason?: string;
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

    // Parse and validate request body
    const body: FreezeCompanyRequest = await req.json();

    // Validate company_id
    if (!body.company_id || typeof body.company_id !== "string") {
      return new Response(
        JSON.stringify({ error: "Validation Error", message: "Company ID is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate action
    if (!body.action || !["freeze", "unfreeze"].includes(body.action)) {
      return new Response(
        JSON.stringify({ error: "Validation Error", message: "Action must be 'freeze' or 'unfreeze'" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`User ${user.id} ${body.action}ing company ${body.company_id}`);

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Verify user is super_admin of the company (only owners can freeze)
    const { data: userRole } = await supabaseAdmin
      .from("company_users")
      .select("role, is_active")
      .eq("company_id", body.company_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!userRole || !userRole.is_active) {
      return new Response(
        JSON.stringify({ error: "Forbidden", message: "You are not a member of this company" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Only super_admin can freeze/unfreeze
    if (userRole.role !== "super_admin") {
      return new Response(
        JSON.stringify({ error: "Forbidden", message: "Only company owners can freeze/unfreeze" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get current company state
    const { data: company } = await supabaseAdmin
      .from("companies")
      .select("id, name, is_active")
      .eq("id", body.company_id)
      .maybeSingle();

    if (!company) {
      return new Response(
        JSON.stringify({ error: "Not Found", message: "Company not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const newActiveState = body.action === "unfreeze";
    const wasActive = company.is_active;

    if (wasActive === newActiveState) {
      return new Response(
        JSON.stringify({
          success: true,
          message: `Company is already ${newActiveState ? "active" : "frozen"}`,
          company: { id: company.id, is_active: company.is_active },
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update company status
    const { error: updateError } = await supabaseAdmin
      .from("companies")
      .update({
        is_active: newActiveState,
        updated_at: new Date().toISOString(),
      })
      .eq("id", body.company_id);

    if (updateError) {
      console.error("Error updating company:", updateError);
      return new Response(
        JSON.stringify({ error: "Database Error", message: updateError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update subscription status if freezing
    if (body.action === "freeze") {
      await supabaseAdmin
        .from("company_subscriptions")
        .update({
          status: "paused",
          updated_at: new Date().toISOString(),
        })
        .eq("company_id", body.company_id);
    }

    // Log audit event
    await supabaseAdmin.from("audit_logs").insert({
      company_id: body.company_id,
      user_id: user.id,
      action: "update",
      table_name: "companies",
      record_id: body.company_id,
      actor_role: userRole.role,
      target_type: "company",
      severity: body.action === "freeze" ? "warn" : "info",
      old_values: { is_active: wasActive },
      new_values: { is_active: newActiveState, reason: body.reason || null },
    });

    // Log security event
    await supabaseAdmin.from("security_events").insert({
      company_id: body.company_id,
      user_id: user.id,
      event_type: body.action === "freeze" ? "suspicious_activity" : "login_success",
      severity: body.action === "freeze" ? "high" : "low",
      description: `Company ${body.action === "freeze" ? "frozen" : "unfrozen"}${body.reason ? ": " + body.reason : ""}`,
    });

    // Log billing event
    await supabaseAdmin.from("billing_logs").insert({
      company_id: body.company_id,
      event_type: body.action === "freeze" ? "company_frozen" : "company_unfrozen",
      triggered_by: user.id,
      metadata: { reason: body.reason || null, manual: true },
    });

    console.log(`Company ${body.company_id} ${body.action}d by ${user.id}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Company ${body.action === "freeze" ? "frozen" : "unfrozen"} successfully`,
        company: {
          id: body.company_id,
          name: company.name,
          is_active: newActiveState,
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Unexpected error in freeze-company:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: "Internal Server Error", message: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
