import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface UseCompanyLinkRequest {
  token: string;
  company_name: string;
  admin_email: string;
  admin_first_name?: string;
  admin_last_name?: string;
  admin_password: string;
  industry?: string;
  size_range?: string;
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const body: UseCompanyLinkRequest = await req.json();

    if (!body.token || !body.company_name?.trim() || !body.admin_email?.trim() || !body.admin_password) {
      return new Response(
        JSON.stringify({ error: "Validation Error", message: "Token, company name, email, and password are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate the link
    const { data: linkValidation, error: validationError } = await supabaseAdmin
      .rpc('validate_company_creation_link', { _token: body.token });

    if (validationError) {
      console.error("Link validation error:", validationError);
      return new Response(
        JSON.stringify({ error: "Validation Error", message: validationError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const validation = linkValidation?.[0];
    if (!validation?.is_valid) {
      return new Response(
        JSON.stringify({ error: "Invalid Link", message: validation?.error_message || "This link is invalid or expired" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // If link has email restriction, verify it matches
    if (validation.email && validation.email.toLowerCase() !== body.admin_email.toLowerCase()) {
      return new Response(
        JSON.stringify({ error: "Email Mismatch", message: "This link is restricted to a different email address" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get link details including enable_trial
    const { data: linkDetails } = await supabaseAdmin
      .from("company_creation_links")
      .select("enable_trial, trial_days, plan_id, billing_interval")
      .eq("id", validation.link_id)
      .single();

    // Generate slug
    const slug = body.company_name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .substring(0, 50) + "-" + Date.now().toString(36);

    // Check if user already exists
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(u => u.email === body.admin_email.toLowerCase());

    let adminUserId: string;
    let isNewUser = false;

    if (existingUser) {
      adminUserId = existingUser.id;
    } else {
      // Create new user
      const { data: newUser, error: createUserError } = await supabaseAdmin.auth.admin.createUser({
        email: body.admin_email.toLowerCase(),
        password: body.admin_password,
        email_confirm: true,
        user_metadata: {
          first_name: body.admin_first_name || '',
          last_name: body.admin_last_name || '',
        },
      });

      if (createUserError) {
        console.error("Error creating user:", createUserError);
        return new Response(
          JSON.stringify({ error: "User Creation Failed", message: createUserError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      adminUserId = newUser.user.id;
      isNewUser = true;

      // Create profile
      await supabaseAdmin.from("profiles").upsert({
        id: adminUserId,
        email: body.admin_email.toLowerCase(),
        first_name: body.admin_first_name || '',
        last_name: body.admin_last_name || '',
        force_password_change: false, // User set their own password
      });
    }

    // Create company
    const { data: company, error: companyError } = await supabaseAdmin
      .from("companies")
      .insert({
        name: body.company_name.trim(),
        slug,
        industry: body.industry || null,
        size_range: body.size_range || null,
        is_active: true,
      })
      .select()
      .single();

    if (companyError) {
      console.error("Error creating company:", companyError);
      return new Response(
        JSON.stringify({ error: "Database Error", message: companyError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Add user as company admin
    await supabaseAdmin.from("company_users").insert({
      company_id: company.id,
      user_id: adminUserId,
      role: "company_admin",
      is_primary: true,
      is_active: true,
      joined_at: new Date().toISOString(),
    });

    // Create employee record
    await supabaseAdmin.from("employees").insert({
      company_id: company.id,
      user_id: adminUserId,
      employee_number: "001",
      first_name: body.admin_first_name || "Admin",
      last_name: body.admin_last_name || "",
      email: body.admin_email,
      employment_type: "full_time",
      employment_status: "active",
      hire_date: new Date().toISOString().split('T')[0],
      job_title: "Administrator",
    });

    // Handle subscription from link configuration
    const planId = validation.plan_id;
    const enableTrial = linkDetails?.enable_trial !== false;
    const trialDays = linkDetails?.trial_days ?? validation.trial_days ?? 14;
    const billingInterval = linkDetails?.billing_interval ?? validation.billing_interval ?? "monthly";

    if (planId) {
      if (enableTrial) {
        // Start with trial
        const trialEnd = new Date();
        trialEnd.setDate(trialEnd.getDate() + trialDays);

        await supabaseAdmin.from("company_subscriptions").insert({
          company_id: company.id,
          plan_id: planId,
          status: "trialing",
          billing_interval: billingInterval,
          current_period_start: new Date().toISOString(),
          current_period_end: trialEnd.toISOString(),
          trial_ends_at: trialEnd.toISOString(),
          trial_total_days: trialDays,
        });

        console.log(`Company ${company.id} started with ${trialDays}-day trial via link`);
      } else {
        // Start as active (no trial)
        const periodEnd = new Date();
        periodEnd.setMonth(periodEnd.getMonth() + (billingInterval === 'yearly' ? 12 : 1));

        await supabaseAdmin.from("company_subscriptions").insert({
          company_id: company.id,
          plan_id: planId,
          status: "active",
          billing_interval: billingInterval,
          current_period_start: new Date().toISOString(),
          current_period_end: periodEnd.toISOString(),
          trial_ends_at: null,
          trial_total_days: null,
        });

        console.log(`Company ${company.id} started with active subscription (no trial) via link`);
      }
    }

    // Create subdomain
    let baseDomain = 'hrplatform.com';
    const { data: brandingSettings } = await supabaseAdmin
      .from("platform_settings")
      .select("value")
      .eq("key", "branding")
      .maybeSingle();

    if (brandingSettings?.value?.base_domain) {
      baseDomain = brandingSettings.value.base_domain;
    }

    await supabaseAdmin.from("company_domains").insert({
      company_id: company.id,
      subdomain: slug,
      is_primary: true,
      is_verified: true,
      is_active: true,
      verified_at: new Date().toISOString(),
    });

    // Mark link as used
    await supabaseAdmin
      .from("company_creation_links")
      .update({
        uses: 1,
        used_at: new Date().toISOString(),
        used_by_company_id: company.id,
      })
      .eq("id", validation.link_id);

    // Log the event
    await supabaseAdmin.from("onboarding_logs").insert({
      event_type: "link_used",
      company_id: company.id,
      user_id: adminUserId,
      link_id: validation.link_id,
      metadata: {
        company_name: body.company_name,
        admin_email: body.admin_email,
        is_new_user: isNewUser,
        trial_enabled: enableTrial,
        trial_days: enableTrial ? trialDays : null,
      },
    });

    // Notify platform admin that link was used
    const { data: link } = await supabaseAdmin
      .from("company_creation_links")
      .select("created_by")
      .eq("id", validation.link_id)
      .single();

    if (link?.created_by) {
      // Could send notification email to platform admin here
      console.log(`Link used - should notify platform admin: ${link.created_by}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        company: {
          id: company.id,
          name: company.name,
          slug: company.slug,
        },
        domain: {
          subdomain: slug,
          full_url: `https://${slug}.${baseDomain}`,
        },
        is_new_user: isNewUser,
        subscription: {
          status: enableTrial ? "trialing" : "active",
          trial_days: enableTrial ? trialDays : null,
        },
      }),
      { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in use-company-link:", error);
    return new Response(
      JSON.stringify({ error: "Internal Server Error", message: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
