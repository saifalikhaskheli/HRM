import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CreateCompanyRequest {
  name: string;
  slug?: string;
  industry?: string;
  size_range?: string;
}

// Vercel domain registration helper
async function registerSubdomainWithVercel(
  subdomain: string, 
  baseDomain: string
): Promise<{ success: boolean; verified?: boolean; error?: string }> {
  const VERCEL_API_TOKEN = Deno.env.get('VERCEL_API_TOKEN');
  const VERCEL_PROJECT_ID = Deno.env.get('VERCEL_PROJECT_ID');
  const VERCEL_TEAM_ID = Deno.env.get('VERCEL_TEAM_ID');
  
  if (!VERCEL_API_TOKEN || !VERCEL_PROJECT_ID) {
    console.log('Vercel integration not configured, skipping domain registration');
    return { success: false, error: 'Vercel integration not configured' };
  }
  
  const fullDomain = `${subdomain}.${baseDomain}`;
  console.log(`Registering subdomain ${fullDomain} with Vercel project ${VERCEL_PROJECT_ID}`);
  
  const teamParam = VERCEL_TEAM_ID ? `&teamId=${VERCEL_TEAM_ID}` : '';
  const url = `https://api.vercel.com/v10/projects/${VERCEL_PROJECT_ID}/domains?${teamParam}`;
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${VERCEL_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: fullDomain }),
    });

    const data = await response.json();
    console.log('Vercel add subdomain response:', JSON.stringify(data));

    if (!response.ok) {
      // Domain might already exist (e.g., from a wildcard), which is fine
      if (data.error?.code === 'domain_already_in_use') {
        console.log('Subdomain already registered with Vercel (likely via wildcard)');
        return { success: true, verified: true };
      }
      return { success: false, error: data.error?.message || 'Failed to add subdomain to Vercel' };
    }

    // For subdomains under a verified apex domain, Vercel often auto-verifies
    return { success: true, verified: data.verified ?? false };
  } catch (error) {
    console.error('Error registering subdomain with Vercel:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
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

    // Create Supabase client with user's JWT
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

    console.log(`Creating company for user: ${user.id}`);

    // Use service role for admin operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Check if user is a platform admin - they cannot create companies
    const { data: platformAdmin } = await supabaseAdmin
      .from("platform_admins")
      .select("id")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .maybeSingle();

    if (platformAdmin) {
      console.error("Platform admin attempted to create company:", user.id);
      return new Response(
        JSON.stringify({ 
          error: "Forbidden", 
          message: "Platform admins cannot create companies. Use impersonation to access company data." 
        }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check user's company limit
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("max_companies")
      .eq("id", user.id)
      .single();

    const { count: currentCompanyCount } = await supabaseAdmin
      .from("company_users")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("is_active", true);

    const maxCompanies = profile?.max_companies || 1;

    if ((currentCompanyCount || 0) >= maxCompanies) {
      console.log(`User ${user.id} has reached company limit: ${currentCompanyCount}/${maxCompanies}`);
      return new Response(
        JSON.stringify({ 
          error: "Company Limit Reached", 
          message: `You can only belong to ${maxCompanies} company(ies). Contact platform support to create additional companies.` 
        }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse and validate request body
    const body: CreateCompanyRequest = await req.json();

    if (!body.name || typeof body.name !== "string" || body.name.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: "Validation Error", message: "Company name is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (body.name.length > 255) {
      return new Response(
        JSON.stringify({ error: "Validation Error", message: "Company name must be less than 255 characters" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate slug if not provided
    const slug = body.slug?.trim() || 
      body.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .substring(0, 50) + "-" + Date.now().toString(36);

    // Check if slug already exists
    const { data: existingCompany } = await supabaseAdmin
      .from("companies")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();

    if (existingCompany) {
      return new Response(
        JSON.stringify({ error: "Conflict", message: "A company with this slug already exists" }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create company
    const { data: company, error: companyError } = await supabaseAdmin
      .from("companies")
      .insert({
        name: body.name.trim(),
        slug,
        industry: body.industry?.trim() || null,
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

    console.log(`Company created: ${company.id}`);

    // Add user as company admin
    const { error: userError } = await supabaseAdmin
      .from("company_users")
      .insert({
        company_id: company.id,
        user_id: user.id,
        role: "company_admin",
        is_primary: true,
        is_active: true,
        joined_at: new Date().toISOString(),
      });

    if (userError) {
      console.error("Error adding user to company:", userError);
      // Rollback company creation
      await supabaseAdmin.from("companies").delete().eq("id", company.id);
      return new Response(
        JSON.stringify({ error: "Database Error", message: "Failed to add user to company" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get user profile for employee record
    const { data: userProfile } = await supabaseAdmin
      .from("profiles")
      .select("first_name, last_name, email")
      .eq("id", user.id)
      .single();

    // Create employee record for admin user
    const { error: employeeError } = await supabaseAdmin
      .from("employees")
      .insert({
        company_id: company.id,
        user_id: user.id,
        employee_number: "001",
        first_name: userProfile?.first_name || "Admin",
        last_name: userProfile?.last_name || "",
        email: userProfile?.email || user.email,
        employment_type: "full_time",
        employment_status: "active",
        hire_date: new Date().toISOString().split('T')[0],
        job_title: "Administrator",
      });

    if (employeeError) {
      console.error("Error creating employee record:", employeeError);
      // Non-fatal, company still functional
    } else {
      console.log(`Employee record created for admin user: ${user.id}`);
    }

    // Get free plan for trial subscription
    const { data: freePlan } = await supabaseAdmin
      .from("plans")
      .select("id")
      .eq("name", "Free")
      .maybeSingle();

    if (freePlan) {
      // Get trial settings from platform_settings
      let trialDays = 14; // default
      const { data: trialSettings } = await supabaseAdmin
        .from("platform_settings")
        .select("value")
        .eq("key", "trial")
        .maybeSingle();

      if (trialSettings?.value && typeof trialSettings.value === 'object') {
        const settings = trialSettings.value as { default_days?: number };
        if (settings.default_days && settings.default_days > 0) {
          trialDays = settings.default_days;
        }
      }

      console.log(`Creating trial subscription with ${trialDays} days`);

      // Create subscription
      const trialEnd = new Date();
      trialEnd.setDate(trialEnd.getDate() + trialDays);

      const { error: subError } = await supabaseAdmin
        .from("company_subscriptions")
        .insert({
          company_id: company.id,
          plan_id: freePlan.id,
          status: "trialing",
          billing_interval: "monthly",
          current_period_start: new Date().toISOString(),
          current_period_end: trialEnd.toISOString(),
          trial_ends_at: trialEnd.toISOString(),
        });

      if (subError) {
        console.error("Error creating subscription:", subError);
        // Non-fatal, company still created
      }
    }

    // Get base domain from platform settings or use default
    let baseDomain = 'thefruitbazaar.com';
    const { data: domainSettings } = await supabaseAdmin
      .from("platform_settings")
      .select("value")
      .eq("key", "base_domain")
      .maybeSingle();
    
    if (domainSettings?.value && typeof domainSettings.value === 'string') {
      baseDomain = domainSettings.value;
    } else if (domainSettings?.value && typeof domainSettings.value === 'object') {
      const settings = domainSettings.value as { domain?: string };
      if (settings.domain) baseDomain = settings.domain;
    }

    // Register subdomain with Vercel first
    console.log(`Registering subdomain ${slug} with Vercel...`);
    const vercelResult = await registerSubdomainWithVercel(slug, baseDomain);
    
    // Determine initial domain status based on Vercel registration
    const domainIsVerified = vercelResult.success && vercelResult.verified;
    const vercelStatus = vercelResult.success 
      ? (vercelResult.verified ? 'active' : 'pending') 
      : 'error';
    const vercelError = vercelResult.success ? null : vercelResult.error;

    // Create subdomain for the company with Vercel status
    const { data: domainRecord, error: domainError } = await supabaseAdmin
      .from("company_domains")
      .insert({
        company_id: company.id,
        subdomain: slug,
        is_primary: true,
        is_verified: domainIsVerified,
        is_active: true,
        verified_at: domainIsVerified ? new Date().toISOString() : null,
        vercel_status: vercelStatus,
        vercel_verified: vercelResult.verified ?? false,
        vercel_error: vercelError,
      })
      .select()
      .single();

    if (domainError) {
      console.error("Error creating company domain:", domainError);
      // Non-fatal, company still functional
    } else {
      console.log(`Subdomain created: ${slug}, Vercel status: ${vercelStatus}`);
    }

    // Log audit event
    await supabaseAdmin.from("audit_logs").insert({
      company_id: company.id,
      user_id: user.id,
      action: "create",
      table_name: "companies",
      record_id: company.id,
      actor_role: "company_admin",
      target_type: "company",
      severity: "info",
      new_values: { 
        name: company.name, 
        slug: company.slug,
        subdomain: slug,
        vercel_registered: vercelResult.success,
      },
    });

    // Log billing event for trial start
    if (freePlan) {
      await supabaseAdmin.from("billing_logs").insert({
        company_id: company.id,
        event_type: "trial_started",
        plan_id: freePlan.id,
        triggered_by: user.id,
        metadata: { trial_days: 14, subdomain: slug },
      });
    }

    console.log(`Company provisioning complete: ${company.id}`);

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
          fullDomain: `${slug}.${baseDomain}`,
          vercelRegistered: vercelResult.success,
          vercelVerified: vercelResult.verified,
          vercelError: vercelResult.error,
        },
      }),
      { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Unexpected error in create-company:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: "Internal Server Error", message: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
