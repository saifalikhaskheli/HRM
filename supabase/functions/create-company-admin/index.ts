import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CreateCompanyRequest {
  company_name: string;
  admin_email: string;
  admin_first_name?: string;
  admin_last_name?: string;
  plan_id?: string;
  enable_trial?: boolean;
  trial_days?: number;
  billing_interval?: 'monthly' | 'yearly';
  industry?: string;
  size_range?: string;
  modules_override?: string[];
  send_credentials?: boolean;
}

function generateSecurePassword(): string {
  const length = 16;
  const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  let password = "";
  for (let i = 0; i < length; i++) {
    password += charset[array[i] % charset.length];
  }
  return password;
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

    // Verify caller is platform admin
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
        JSON.stringify({ error: "Forbidden", message: "Only platform admins can create companies" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body: CreateCompanyRequest = await req.json();

    if (!body.company_name?.trim() || !body.admin_email?.trim()) {
      return new Response(
        JSON.stringify({ error: "Validation Error", message: "Company name and admin email are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate slug
    const slug = body.company_name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .substring(0, 50) + "-" + Date.now().toString(36);

    // Check if slug exists
    const { data: existingCompany } = await supabaseAdmin
      .from("companies")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();

    if (existingCompany) {
      return new Response(
        JSON.stringify({ error: "Conflict", message: "Company slug already exists" }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get plan configuration if plan_id is provided
    let planConfig: { name: string; trial_enabled: boolean | null; trial_default_days: number | null; trial_restrictions: any } | null = null;
    if (body.plan_id) {
      const { data: plan } = await supabaseAdmin
        .from("plans")
        .select("name, trial_enabled, trial_default_days, trial_restrictions")
        .eq("id", body.plan_id)
        .single();
      planConfig = plan;
    }

    // Check if user already exists
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(u => u.email === body.admin_email.toLowerCase());

    let adminUserId: string;
    let isNewUser = false;
    const tempPassword = generateSecurePassword();

    if (existingUser) {
      adminUserId = existingUser.id;
      console.log(`User already exists: ${adminUserId}`);
    } else {
      // Create new user with temp password
      const { data: newUser, error: createUserError } = await supabaseAdmin.auth.admin.createUser({
        email: body.admin_email.toLowerCase(),
        password: tempPassword,
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

      // Create profile with force_password_change
      await supabaseAdmin.from("profiles").upsert({
        id: adminUserId,
        email: body.admin_email.toLowerCase(),
        first_name: body.admin_first_name || '',
        last_name: body.admin_last_name || '',
        force_password_change: true,
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

    // Handle subscription
    const planId = body.plan_id;
    
    // Determine if trial should be enabled
    // 1. If enable_trial is explicitly false, no trial
    // 2. If plan has trial_enabled = false, no trial
    // 3. Otherwise, trial is enabled
    const planTrialEnabled = planConfig?.trial_enabled !== false;
    const enableTrial = body.enable_trial !== false && planTrialEnabled;
    
    // Determine trial days (from request, or from plan, or default 14)
    const trialDays = body.trial_days ?? planConfig?.trial_default_days ?? 14;

    if (planId) {
      if (enableTrial) {
        // Start with trial
        const trialEnd = new Date();
        trialEnd.setDate(trialEnd.getDate() + trialDays);

        await supabaseAdmin.from("company_subscriptions").insert({
          company_id: company.id,
          plan_id: planId,
          status: "trialing",
          billing_interval: body.billing_interval || "monthly",
          current_period_start: new Date().toISOString(),
          current_period_end: trialEnd.toISOString(),
          trial_ends_at: trialEnd.toISOString(),
          trial_total_days: trialDays,
        });

        console.log(`Company ${company.id} started with ${trialDays}-day trial`);
      } else {
        // Start as active (no trial)
        const periodEnd = new Date();
        periodEnd.setMonth(periodEnd.getMonth() + (body.billing_interval === 'yearly' ? 12 : 1));

        await supabaseAdmin.from("company_subscriptions").insert({
          company_id: company.id,
          plan_id: planId,
          status: "active",
          billing_interval: body.billing_interval || "monthly",
          current_period_start: new Date().toISOString(),
          current_period_end: periodEnd.toISOString(),
          trial_ends_at: null,
          trial_total_days: null,
        });

        console.log(`Company ${company.id} started with active subscription (no trial)`);
      }
    }

    // Create subdomain
    let baseDomain = 'hrplatform.com';
    const { data: domainSettings } = await supabaseAdmin
      .from("platform_settings")
      .select("value")
      .eq("key", "branding")
      .maybeSingle();

    if (domainSettings?.value?.base_domain) {
      baseDomain = domainSettings.value.base_domain;
    }

    await supabaseAdmin.from("company_domains").insert({
      company_id: company.id,
      subdomain: slug,
      is_primary: true,
      is_verified: true,
      is_active: true,
      verified_at: new Date().toISOString(),
    });

    // Log the onboarding event
    await supabaseAdmin.from("onboarding_logs").insert({
      event_type: "company_created",
      company_id: company.id,
      user_id: user.id,
      target_user_id: adminUserId,
      metadata: {
        company_name: body.company_name,
        admin_email: body.admin_email,
        plan_id: planId,
        is_new_user: isNewUser,
        created_by_platform_admin: true,
        trial_enabled: enableTrial,
        trial_days: enableTrial ? trialDays : null,
      },
    });

    // Email status tracking
    let emailStatus: 'sent' | 'skipped' | 'failed' = 'skipped';
    let emailError: string | undefined;

    // Send credentials email if requested and user is new
    if (body.send_credentials !== false && isNewUser) {
      try {
        const adminName = body.admin_first_name || 'Admin';
        const companyUrl = `https://${slug}.${baseDomain}`;
        const loginUrl = `${companyUrl}/auth`;
        const planName = planConfig?.name || '';

        console.log(`Sending onboarding email to ${body.admin_email}`);

        const { data: emailResult, error: emailInvokeError } = await supabaseAdmin.functions.invoke('send-email', {
          headers: {
            // Use service role so send-email can treat this as an internal call (no user JWT dependency)
            Authorization: `Bearer ${supabaseServiceKey}`,
          },
          body: {
            template: 'company_onboarding',
            to: { email: body.admin_email.toLowerCase(), name: adminName },
            data: {
              adminName,
              companyName: body.company_name,
              companyUrl,
              adminEmail: body.admin_email,
              temporaryPassword: tempPassword,
              planName,
              trialDays: enableTrial ? trialDays : 0,
              loginUrl,
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
          console.log("Onboarding email sent successfully:", emailResult);

          // Log credentials sent (metadata only, not password)
          await supabaseAdmin.from("onboarding_logs").insert({
            event_type: "credentials_sent",
            company_id: company.id,
            user_id: user.id,
            target_user_id: adminUserId,
            metadata: {
              email: body.admin_email,
              force_password_change: true,
            },
          });
        }
      } catch (err) {
        console.error("Failed to send onboarding email:", err);
        emailStatus = 'failed';
        emailError = err instanceof Error ? err.message : 'Unknown error';
      }
    }

    // Log audit event
    await supabaseAdmin.from("audit_logs").insert({
      company_id: company.id,
      user_id: user.id,
      action: "create",
      table_name: "companies",
      record_id: company.id,
      actor_role: "platform_admin",
      target_type: "company",
      severity: "info",
      new_values: {
        name: company.name,
        slug: company.slug,
        admin_email: body.admin_email,
        created_by_platform_admin: true,
        trial_enabled: enableTrial,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        company: {
          id: company.id,
          name: company.name,
          slug: company.slug,
        },
        admin: {
          user_id: adminUserId,
          email: body.admin_email,
          is_new_user: isNewUser,
          temporary_password: isNewUser ? tempPassword : undefined,
        },
        domain: {
          subdomain: slug,
          full_url: `https://${slug}.${baseDomain}`,
        },
        subscription: {
          status: enableTrial ? "trialing" : "active",
          trial_days: enableTrial ? trialDays : null,
        },
        email_status: emailStatus,
        email_error: emailError,
      }),
      { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in create-company-admin:", error);
    return new Response(
      JSON.stringify({ error: "Internal Server Error", message: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
