import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SubscriptionCheck {
  company_id: string;
  status: string;
  days_past_due: number;
  should_freeze: boolean;
}

/**
 * Check subscription health for all companies and freeze those past due
 * 
 * This function should be called periodically (e.g., via cron) to:
 * 1. Detect past-due subscriptions
 * 2. Freeze companies with subscriptions past the grace period
 * 3. Log freeze events for audit
 */
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Grace period in days before freezing
    const GRACE_PERIOD_DAYS = 7;

    // Find all subscriptions that are past due or have expired
    const now = new Date();
    const { data: subscriptions, error: subError } = await supabaseAdmin
      .from("company_subscriptions")
      .select(`
        id,
        company_id,
        status,
        current_period_end,
        trial_ends_at,
        companies (
          id,
          name,
          is_active
        )
      `);

    if (subError) {
      throw new Error(`Failed to fetch subscriptions: ${subError.message}`);
    }

    const results: SubscriptionCheck[] = [];
    const toFreeze: string[] = [];
    const toUnfreeze: string[] = [];

    for (const sub of subscriptions || []) {
      const companyData = sub.companies;
      if (!companyData || !Array.isArray(companyData) || companyData.length === 0) continue;
      const company = companyData[0] as { id: string; name: string; is_active: boolean };

      const periodEnd = new Date(sub.current_period_end);
      const trialEnd = sub.trial_ends_at ? new Date(sub.trial_ends_at) : null;
      
      // Calculate days past due
      let daysPastDue = 0;
      if (sub.status === 'past_due' || periodEnd < now) {
        daysPastDue = Math.floor((now.getTime() - periodEnd.getTime()) / (1000 * 60 * 60 * 24));
      }

      // Check trial expiration
      if (sub.status === 'trialing' && trialEnd && trialEnd < now) {
        daysPastDue = Math.floor((now.getTime() - trialEnd.getTime()) / (1000 * 60 * 60 * 24));
      }

      const shouldFreeze = daysPastDue > GRACE_PERIOD_DAYS;
      const shouldUnfreeze = !shouldFreeze && !company.is_active && 
        (sub.status === 'active' || sub.status === 'trialing');

      results.push({
        company_id: company.id,
        status: sub.status,
        days_past_due: daysPastDue,
        should_freeze: shouldFreeze,
      });

      if (shouldFreeze && company.is_active) {
        toFreeze.push(company.id);
      } else if (shouldUnfreeze) {
        toUnfreeze.push(company.id);
      }
    }

    // Freeze companies past grace period
    if (toFreeze.length > 0) {
      const { error: freezeError } = await supabaseAdmin
        .from("companies")
        .update({ is_active: false })
        .in("id", toFreeze);

      if (freezeError) {
        console.error("Error freezing companies:", freezeError);
      } else {
        // Update subscription status to paused
        await supabaseAdmin
          .from("company_subscriptions")
          .update({ status: "paused" })
          .in("company_id", toFreeze);

        // Log freeze events
        for (const companyId of toFreeze) {
          await supabaseAdmin.from("audit_logs").insert({
            table_name: "companies",
            action: "update",
            record_id: companyId,
            company_id: companyId,
            actor_role: "system",
            target_type: "company",
            severity: "warn",
            metadata: { action: "auto_freeze", reason: "subscription_past_due" },
            new_values: { is_active: false },
            old_values: { is_active: true },
          });

          await supabaseAdmin.from("security_events").insert({
            event_type: "suspicious_activity",
            company_id: companyId,
            description: "Company automatically frozen due to past-due subscription",
            severity: "high",
            metadata: { reason: "subscription_past_due", auto_action: true },
          });

          // Log billing event
          await supabaseAdmin.from("billing_logs").insert({
            company_id: companyId,
            event_type: "company_frozen",
            metadata: { reason: "subscription_past_due", auto_action: true },
          });
        }
      }
    }

    // Unfreeze companies with valid subscriptions
    if (toUnfreeze.length > 0) {
      const { error: unfreezeError } = await supabaseAdmin
        .from("companies")
        .update({ is_active: true })
        .in("id", toUnfreeze);

      if (unfreezeError) {
        console.error("Error unfreezing companies:", unfreezeError);
      } else {
        for (const companyId of toUnfreeze) {
          await supabaseAdmin.from("audit_logs").insert({
            table_name: "companies",
            action: "update",
            record_id: companyId,
            company_id: companyId,
            actor_role: "system",
            target_type: "company",
            severity: "info",
            metadata: { action: "auto_unfreeze", reason: "subscription_restored" },
            new_values: { is_active: true },
            old_values: { is_active: false },
          });

          // Log billing event
          await supabaseAdmin.from("billing_logs").insert({
            company_id: companyId,
            event_type: "company_unfrozen",
            metadata: { reason: "subscription_restored", auto_action: true },
          });
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        checked: results.length,
        frozen: toFreeze.length,
        unfrozen: toUnfreeze.length,
        details: results,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Subscription health check error:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
