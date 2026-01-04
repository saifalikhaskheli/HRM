import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AssignPlanRequest {
  company_id: string;
  plan_id: string;
  billing_interval?: "monthly" | "yearly";
  stripe_customer_id?: string;
  stripe_subscription_id?: string;
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
    const body: AssignPlanRequest = await req.json();

    // Validate company_id
    if (!body.company_id || typeof body.company_id !== "string") {
      return new Response(
        JSON.stringify({ error: "Validation Error", message: "Company ID is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate plan_id
    if (!body.plan_id || typeof body.plan_id !== "string") {
      return new Response(
        JSON.stringify({ error: "Validation Error", message: "Plan ID is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`User ${user.id} assigning plan ${body.plan_id} to company ${body.company_id}`);

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Verify user is admin of the company
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

    const adminRoles = ["super_admin", "company_admin"];
    if (!adminRoles.includes(userRole.role)) {
      return new Response(
        JSON.stringify({ error: "Forbidden", message: "Only admins can change plans" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify company exists and is active
    const { data: company } = await supabaseAdmin
      .from("companies")
      .select("id, is_active")
      .eq("id", body.company_id)
      .maybeSingle();

    if (!company) {
      return new Response(
        JSON.stringify({ error: "Not Found", message: "Company not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify plan exists and is active
    const { data: plan } = await supabaseAdmin
      .from("plans")
      .select("id, name, price_monthly, price_yearly, is_active")
      .eq("id", body.plan_id)
      .maybeSingle();

    if (!plan || !plan.is_active) {
      return new Response(
        JSON.stringify({ error: "Not Found", message: "Plan not found or inactive" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get current subscription
    const { data: currentSub } = await supabaseAdmin
      .from("company_subscriptions")
      .select("*")
      .eq("company_id", body.company_id)
      .maybeSingle();

    const billingInterval = body.billing_interval || "monthly";
    const now = new Date();
    const periodEnd = new Date();
    periodEnd.setMonth(periodEnd.getMonth() + (billingInterval === "yearly" ? 12 : 1));

    // Check if this is a paid plan (price > 0)
    const isPaidPlan = plan.price_monthly > 0 || plan.price_yearly > 0;
    const wasTrialing = currentSub?.status === "trialing";

    if (currentSub) {
      // Determine new status and trial_ends_at based on plan type
      let newStatus: string;
      let newTrialEndsAt: string | null;

      if (isPaidPlan) {
        // Paid plan = end trial immediately, set status to active
        newStatus = "active";
        newTrialEndsAt = null;
        console.log(`Upgrading to paid plan ${plan.name} - ending trial immediately`);
      } else if (wasTrialing && currentSub.trial_ends_at) {
        // Switching to free plan while trialing = keep trial active
        newStatus = "trialing";
        newTrialEndsAt = currentSub.trial_ends_at;
        console.log(`Switching to free plan ${plan.name} - preserving trial until ${newTrialEndsAt}`);
      } else {
        // Non-trialing user switching to free plan = active
        newStatus = "active";
        newTrialEndsAt = null;
      }

      const { error: updateError } = await supabaseAdmin
        .from("company_subscriptions")
        .update({
          plan_id: body.plan_id,
          status: newStatus,
          billing_interval: billingInterval,
          current_period_start: now.toISOString(),
          current_period_end: periodEnd.toISOString(),
          trial_ends_at: newTrialEndsAt,
          stripe_customer_id: body.stripe_customer_id || currentSub.stripe_customer_id,
          stripe_subscription_id: body.stripe_subscription_id || currentSub.stripe_subscription_id,
          updated_at: now.toISOString(),
        })
        .eq("id", currentSub.id);

      if (updateError) {
        console.error("Error updating subscription:", updateError);
        return new Response(
          JSON.stringify({ error: "Database Error", message: updateError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Log audit event with trial_ended flag
      await supabaseAdmin.from("audit_logs").insert({
        company_id: body.company_id,
        user_id: user.id,
        action: "update",
        table_name: "company_subscriptions",
        record_id: currentSub.id,
        actor_role: userRole.role,
        target_type: "subscription",
        severity: "info",
        old_values: { plan_id: currentSub.plan_id, status: currentSub.status, trial_ends_at: currentSub.trial_ends_at },
        new_values: { plan_id: body.plan_id, status: newStatus, trial_ends_at: newTrialEndsAt },
        metadata: { is_paid_upgrade: isPaidPlan, trial_ended: wasTrialing && isPaidPlan },
      });

      // Log billing event
      const billingEventType = wasTrialing && isPaidPlan 
        ? 'subscription_created' 
        : (isPaidPlan ? 'subscription_upgraded' : 'subscription_downgraded');
      
      await supabaseAdmin.from("billing_logs").insert({
        company_id: body.company_id,
        event_type: billingEventType,
        subscription_id: currentSub.id,
        plan_id: body.plan_id,
        previous_plan_id: currentSub.plan_id,
        triggered_by: user.id,
        metadata: { billing_interval: billingInterval, trial_ended: wasTrialing && isPaidPlan },
      });

      const trialEnded = wasTrialing && isPaidPlan;
      const message = trialEnded 
        ? `Upgraded to ${plan.name}. Your trial has ended.`
        : "Plan updated successfully";

      console.log(`Subscription updated for company ${body.company_id} to plan ${plan.name}, status: ${newStatus}`);

      return new Response(
        JSON.stringify({
          success: true,
          message,
          trial_ended: trialEnded,
          subscription: {
            plan_id: body.plan_id,
            plan_name: plan.name,
            status: newStatus,
            billing_interval: billingInterval,
            current_period_end: periodEnd.toISOString(),
          },
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else {
      // Create new subscription
      const { data: newSub, error: insertError } = await supabaseAdmin
        .from("company_subscriptions")
        .insert({
          company_id: body.company_id,
          plan_id: body.plan_id,
          status: "active",
          billing_interval: billingInterval,
          current_period_start: now.toISOString(),
          current_period_end: periodEnd.toISOString(),
          stripe_customer_id: body.stripe_customer_id || null,
          stripe_subscription_id: body.stripe_subscription_id || null,
        })
        .select()
        .single();

      if (insertError) {
        console.error("Error creating subscription:", insertError);
        return new Response(
          JSON.stringify({ error: "Database Error", message: insertError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Log audit event
      await supabaseAdmin.from("audit_logs").insert({
        company_id: body.company_id,
        user_id: user.id,
        action: "create",
        table_name: "company_subscriptions",
        record_id: newSub.id,
        actor_role: userRole.role,
        target_type: "subscription",
        severity: "info",
        new_values: { plan_id: body.plan_id, status: "active" },
      });

      // Log billing event
      await supabaseAdmin.from("billing_logs").insert({
        company_id: body.company_id,
        event_type: "subscription_created",
        subscription_id: newSub.id,
        plan_id: body.plan_id,
        triggered_by: user.id,
        metadata: { billing_interval: billingInterval },
      });

      console.log(`New subscription created for company ${body.company_id}`);

      return new Response(
        JSON.stringify({
          success: true,
          message: "Plan assigned successfully",
          subscription: {
            id: newSub.id,
            plan_id: body.plan_id,
            plan_name: plan.name,
            status: "active",
            billing_interval: billingInterval,
            current_period_end: periodEnd.toISOString(),
          },
        }),
        { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (error) {
    console.error("Unexpected error in assign-plan:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: "Internal Server Error", message: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
