import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { EmailService } from "../_shared/email/email-service.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ReactivateUserRequest {
  company_user_id: string;
  user_id: string;
  company_id: string;
}

// Generate a secure random password
function generatePassword(length = 12): string {
  const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => charset[byte % charset.length]).join("");
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Create admin client for user management
    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Get requesting user from auth header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify requesting user
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user: requestingUser }, error: authError } = await userClient.auth.getUser();
    if (authError || !requestingUser) {
      console.error("Auth error:", authError);
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse request body
    const { company_user_id, user_id, company_id }: ReactivateUserRequest = await req.json();

    if (!company_user_id || !user_id || !company_id) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Reactivating user ${user_id} in company ${company_id} by ${requestingUser.id}`);

    // Verify requesting user is company admin
    const { data: requesterRole, error: roleError } = await adminClient
      .from("company_users")
      .select("role")
      .eq("company_id", company_id)
      .eq("user_id", requestingUser.id)
      .eq("is_active", true)
      .single();

    if (roleError || !requesterRole) {
      console.error("Role check error:", roleError);
      return new Response(JSON.stringify({ error: "Not authorized" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!["super_admin", "company_admin"].includes(requesterRole.role)) {
      return new Response(JSON.stringify({ error: "Only admins can reactivate users" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch user and company details
    const [profileResult, companyResult] = await Promise.all([
      adminClient.from("profiles").select("email, first_name, last_name").eq("id", user_id).single(),
      adminClient.from("companies").select("name, slug").eq("id", company_id).single(),
    ]);

    if (profileResult.error || !profileResult.data) {
      console.error("Profile fetch error:", profileResult.error);
      return new Response(JSON.stringify({ error: "User not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (companyResult.error || !companyResult.data) {
      console.error("Company fetch error:", companyResult.error);
      return new Response(JSON.stringify({ error: "Company not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const profile = profileResult.data;
    const company = companyResult.data;

    // Generate new temporary password
    const temporaryPassword = generatePassword();

    // Reset user's password using Admin API
    const { error: passwordError } = await adminClient.auth.admin.updateUserById(user_id, {
      password: temporaryPassword,
    });

    if (passwordError) {
      console.error("Password reset error:", passwordError);
      return new Response(JSON.stringify({ error: "Failed to reset password" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Set force_password_change flag
    const { error: profileUpdateError } = await adminClient
      .from("profiles")
      .update({ force_password_change: true, updated_at: new Date().toISOString() })
      .eq("id", user_id);

    if (profileUpdateError) {
      console.error("Profile update error:", profileUpdateError);
      // Continue anyway - not critical
    }

    // Reactivate the company_user record
    const { error: reactivateError } = await adminClient
      .from("company_users")
      .update({ is_active: true, updated_at: new Date().toISOString() })
      .eq("id", company_user_id)
      .eq("company_id", company_id);

    if (reactivateError) {
      console.error("Reactivate error:", reactivateError);
      return new Response(JSON.stringify({ error: "Failed to reactivate user" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build login URL
    const loginUrl = `https://${company.slug}.thefruitbazaar.com/auth`;

    // Send reactivation email
    let emailResult: { success: boolean; error?: string } = { success: false, error: "Email not sent" };
    try {
      const emailService = new EmailService();
      const result = await emailService.send({
        template: "user_reactivated",
        data: {
          userName: profile.first_name || profile.email.split("@")[0],
          companyName: company.name,
          companyCode: company.slug,
          userId: user_id,
          userEmail: profile.email,
          temporaryPassword,
          loginUrl,
          loginType: "email",
        },
        to: [{ email: profile.email, name: `${profile.first_name || ""} ${profile.last_name || ""}`.trim() || undefined }],
        context: {
          companyId: company_id,
          triggeredBy: requestingUser.id,
          triggeredFrom: "reactivate-user",
        },
      });

      console.log("Email send result:", result);
      emailResult = { success: result.success, error: result.error };
    } catch (emailError) {
      console.error("Email send error:", emailError);
      emailResult = { success: false, error: String(emailError) };
    }

    // Log audit event
    await adminClient.from("audit_logs").insert({
      company_id,
      user_id: requestingUser.id,
      action: "update",
      table_name: "company_users",
      record_id: company_user_id,
      actor_role: requesterRole.role,
      target_type: "user",
      severity: "medium",
      old_values: { is_active: false },
      new_values: { is_active: true },
      metadata: { 
        action_type: "user_reactivated",
        email_sent: emailResult.success,
        target_user_id: user_id,
      },
    });

    // Log security event
    await adminClient.from("security_events").insert({
      company_id,
      user_id: requestingUser.id,
      event_type: "user_reactivated",
      severity: "medium",
      metadata: {
        target_user_id: user_id,
        reactivated_by: requestingUser.id,
      },
    });

    console.log(`User ${user_id} reactivated successfully. Email sent: ${emailResult.success}`);

    return new Response(JSON.stringify({
      success: true,
      message: "User reactivated successfully",
      email_sent: emailResult.success,
      email_error: emailResult.success ? undefined : emailResult.error,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    console.error("Unexpected error:", error);
    return new Response(JSON.stringify({ error: error.message || "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
