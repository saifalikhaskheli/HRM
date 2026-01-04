import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface InviteUserRequest {
  company_id: string;
  email: string;
  role: "company_admin" | "hr_manager" | "manager" | "employee";
  first_name?: string;
  last_name?: string;
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
    const body: InviteUserRequest = await req.json();

    // Validate company_id
    if (!body.company_id || typeof body.company_id !== "string") {
      return new Response(
        JSON.stringify({ error: "Validation Error", message: "Company ID is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!body.email || !emailRegex.test(body.email)) {
      return new Response(
        JSON.stringify({ error: "Validation Error", message: "Valid email is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate role
    const validRoles = ["company_admin", "hr_manager", "manager", "employee"];
    if (!body.role || !validRoles.includes(body.role)) {
      return new Response(
        JSON.stringify({ error: "Validation Error", message: "Valid role is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`User ${user.id} inviting ${body.email} to company ${body.company_id}`);

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Verify inviter has permission (admin or higher)
    const { data: inviterRole } = await supabaseAdmin
      .from("company_users")
      .select("role, is_active")
      .eq("company_id", body.company_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!inviterRole || !inviterRole.is_active) {
      return new Response(
        JSON.stringify({ error: "Forbidden", message: "You are not a member of this company" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const adminRoles = ["super_admin", "company_admin"];
    if (!adminRoles.includes(inviterRole.role)) {
      return new Response(
        JSON.stringify({ error: "Forbidden", message: "Only admins can invite users" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Prevent inviting with super_admin role
    const disallowedRoles = ["super_admin"];
    if (disallowedRoles.includes(body.role)) {
      return new Response(
        JSON.stringify({ error: "Forbidden", message: "Cannot invite super admins" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify company is active
    const { data: company } = await supabaseAdmin
      .from("companies")
      .select("id, is_active, name")
      .eq("id", body.company_id)
      .maybeSingle();

    if (!company || !company.is_active) {
      return new Response(
        JSON.stringify({ error: "Forbidden", message: "Company is not active" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if user already exists
    const { data: existingProfile } = await supabaseAdmin
      .from("profiles")
      .select("id, max_companies")
      .eq("email", body.email.toLowerCase())
      .maybeSingle();

    if (existingProfile) {
      // Check if already a member of this company
      const { data: existingMember } = await supabaseAdmin
        .from("company_users")
        .select("id")
        .eq("company_id", body.company_id)
        .eq("user_id", existingProfile.id)
        .maybeSingle();

      if (existingMember) {
        return new Response(
          JSON.stringify({ error: "Conflict", message: "User is already a member of this company" }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check if user has reached their company limit
      const { count: currentCompanyCount } = await supabaseAdmin
        .from("company_users")
        .select("id", { count: "exact", head: true })
        .eq("user_id", existingProfile.id)
        .eq("is_active", true);

      const maxCompanies = existingProfile.max_companies || 1;

      if ((currentCompanyCount || 0) >= maxCompanies) {
        console.log(`User ${body.email} has reached company limit: ${currentCompanyCount}/${maxCompanies}`);
        return new Response(
          JSON.stringify({ 
            error: "Company Limit Reached", 
            message: `This user can only belong to ${maxCompanies} company(ies). They need to contact platform support to increase their limit.` 
          }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Add existing user to company
      const { error: addError } = await supabaseAdmin
        .from("company_users")
        .insert({
          company_id: body.company_id,
          user_id: existingProfile.id,
          role: body.role,
          is_primary: false,
          is_active: true,
          invited_by: user.id,
          invited_at: new Date().toISOString(),
          joined_at: new Date().toISOString(),
        });

      if (addError) {
        console.error("Error adding user to company:", addError);
        return new Response(
          JSON.stringify({ error: "Database Error", message: addError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Log audit event
      await supabaseAdmin.from("audit_logs").insert({
        company_id: body.company_id,
        user_id: user.id,
        action: "create",
        table_name: "company_users",
        actor_role: inviterRole.role,
        target_type: "user",
        severity: "info",
        new_values: { email: body.email, role: body.role, invited_existing_user: true },
      });

      console.log(`Existing user ${body.email} added to company ${body.company_id}`);

      return new Response(
        JSON.stringify({
          success: true,
          message: "User added to company",
          user_added: true,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create invitation for new user (using Supabase Auth invite)
    const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      body.email,
      {
        data: {
          first_name: body.first_name || null,
          last_name: body.last_name || null,
          invited_to_company: body.company_id,
          invited_role: body.role,
          invited_by: user.id,
        },
        redirectTo: `${Deno.env.get("SUPABASE_URL")?.replace(".supabase.co", ".lovable.app")}/onboarding`,
      }
    );

    if (inviteError) {
      console.error("Error inviting user:", inviteError);
      return new Response(
        JSON.stringify({ error: "Invite Error", message: inviteError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Log audit event
    await supabaseAdmin.from("audit_logs").insert({
      company_id: body.company_id,
      user_id: user.id,
      action: "create",
      table_name: "company_users",
      actor_role: inviterRole.role,
      target_type: "user",
      severity: "info",
      new_values: { email: body.email, role: body.role, invitation_sent: true },
    });

    console.log(`Invitation sent to ${body.email} for company ${body.company_id}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Invitation sent",
        invitation_id: inviteData.user?.id,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Unexpected error in invite-user:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: "Internal Server Error", message: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
