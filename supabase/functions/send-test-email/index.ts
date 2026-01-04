import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SendTestEmailRequest {
  to: string;
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

    // Create Supabase clients
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

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

    // Use service role for admin operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Check if user is a platform admin
    const { data: platformAdmin } = await supabaseAdmin
      .from("platform_admins")
      .select("id, role")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .maybeSingle();

    if (!platformAdmin) {
      console.error("User is not a platform admin:", user.id);
      return new Response(
        JSON.stringify({ error: "Forbidden", message: "Only platform admins can send test emails" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request body
    const body: SendTestEmailRequest = await req.json();

    if (!body.to || typeof body.to !== "string") {
      return new Response(
        JSON.stringify({ error: "Validation Error", message: "Recipient email is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Sending test email to: ${body.to}`);

    // Get email settings from platform_settings
    const { data: emailSettings } = await supabaseAdmin
      .from("platform_settings")
      .select("value")
      .eq("key", "email")
      .maybeSingle();

    const settings = emailSettings?.value as { 
      provider?: string; 
      from_name?: string; 
      from_address?: string; 
    } || {};

    const provider = settings.provider || "console";
    const fromName = settings.from_name || "HR Platform";
    const fromAddress = settings.from_address || "noreply@example.com";

    console.log(`Using email provider: ${provider}`);

    // For console provider, just log
    if (provider === "console") {
      console.log("=== TEST EMAIL (Console Provider) ===");
      console.log(`From: ${fromName} <${fromAddress}>`);
      console.log(`To: ${body.to}`);
      console.log(`Subject: Test Email from HR Platform`);
      console.log(`Body: This is a test email to verify your email configuration is working correctly.`);
      console.log("=====================================");

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "Test email logged to console (development mode). Configure an email provider (SendGrid, MailerSend, AWS SES) to send real emails.",
          provider: "console"
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // For actual providers, check if required API keys are configured
    let apiKeyConfigured = false;
    let apiKeyName = "";

    switch (provider) {
      case "sendgrid":
        apiKeyName = "SENDGRID_API_KEY";
        apiKeyConfigured = !!Deno.env.get("SENDGRID_API_KEY");
        break;
      case "mailersend":
        apiKeyName = "MAILERSEND_API_KEY";
        apiKeyConfigured = !!Deno.env.get("MAILERSEND_API_KEY");
        break;
      case "aws-ses":
        apiKeyName = "AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY";
        apiKeyConfigured = !!Deno.env.get("AWS_ACCESS_KEY_ID") && !!Deno.env.get("AWS_SECRET_ACCESS_KEY");
        break;
      case "brevo":
        apiKeyName = "BREVO_API_KEY";
        apiKeyConfigured = !!Deno.env.get("BREVO_API_KEY");
        break;
      case "resend":
        apiKeyName = "RESEND_API_KEY";
        apiKeyConfigured = !!Deno.env.get("RESEND_API_KEY");
        break;
    }

    if (!apiKeyConfigured) {
      console.warn(`Email provider ${provider} selected but ${apiKeyName} not configured`);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Configuration Error",
          message: `Email provider "${provider}" is selected but ${apiKeyName} is not configured. Please add the secret in Supabase Edge Functions settings.`,
          provider
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Import and use provider directly based on platform settings
    const { EmailProviderFactory } = await import("../_shared/email/provider-factory.ts");
    const { BrevoEmailProvider } = await import("../_shared/email/providers/brevo.ts");
    const { ResendEmailProvider } = await import("../_shared/email/providers/resend.ts");
    const { MailerSendEmailProvider } = await import("../_shared/email/providers/mailersend.ts");
    const { SendGridEmailProvider } = await import("../_shared/email/providers/sendgrid.ts");
    const { AwsSesEmailProvider } = await import("../_shared/email/providers/aws-ses.ts");
    
    // Create provider based on platform settings (not env vars)
    const config = { fromEmail: fromAddress, fromName };
    let emailProvider;
    
    switch (provider) {
      case "brevo":
        emailProvider = new BrevoEmailProvider({
          ...config,
          apiKey: Deno.env.get("BREVO_API_KEY") || "",
        });
        break;
      case "resend":
        emailProvider = new ResendEmailProvider({
          ...config,
          apiKey: Deno.env.get("RESEND_API_KEY") || "",
        });
        break;
      case "mailersend":
        emailProvider = new MailerSendEmailProvider(config);
        break;
      case "sendgrid":
        emailProvider = new SendGridEmailProvider(config);
        break;
      case "aws-ses":
        emailProvider = new AwsSesEmailProvider(config);
        break;
      default:
        emailProvider = new MailerSendEmailProvider(config);
    }
    
    console.log(`Using provider instance: ${emailProvider.name}`);
    
    const result = await emailProvider.send({
      to: [{ email: body.to }],
      subject: "Test Email from HR Platform",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #333;">Test Email</h1>
          <p>This is a test email to verify your email configuration is working correctly.</p>
          <p style="color: #666; font-size: 14px;">Sent from: ${fromName} (${fromAddress})</p>
          <p style="color: #666; font-size: 14px;">Provider: ${provider}</p>
          <p style="color: #666; font-size: 14px;">Timestamp: ${new Date().toISOString()}</p>
        </div>
      `,
      text: `Test Email\n\nThis is a test email to verify your email configuration is working correctly.\n\nSent from: ${fromName} (${fromAddress})\nProvider: ${provider}\nTimestamp: ${new Date().toISOString()}`,
    });

    if (!result.success) {
      console.error("Error sending test email:", result.error);
      return new Response(
        JSON.stringify({ error: "Email Error", message: result.error }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Test email sent successfully to ${body.to}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Test email sent to ${body.to}`,
        provider: result.provider,
        messageId: result.messageId
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Unexpected error in send-test-email:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: "Internal Server Error", message: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});