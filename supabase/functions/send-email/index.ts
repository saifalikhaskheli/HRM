import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { 
  EmailService, 
  EmailTemplateType, 
  EmailTemplateData,
  EmailRecipient,
} from "../_shared/email/index.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SendEmailRequest {
  template: EmailTemplateType;
  data: EmailTemplateData[EmailTemplateType];
  to: EmailRecipient | EmailRecipient[];
  cc?: EmailRecipient[];
  bcc?: EmailRecipient[];
  tags?: Record<string, string>;
}

interface SendRawEmailRequest {
  to: EmailRecipient | EmailRecipient[];
  subject: string;
  html: string;
  text?: string;
  cc?: EmailRecipient[];
  bcc?: EmailRecipient[];
  tags?: Record<string, string>;
}

serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authorization
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Unauthorized", message: "No authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Extract the token from the header
    const token = authHeader.replace("Bearer ", "");
    
    // Check if this is a service role call (internal edge function to edge function)
    const isServiceRole = token === supabaseServiceKey;
    
    let senderId = "service-role";
    
    if (!isServiceRole) {
      // Verify user token
      const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } },
      });

      const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
      if (authError || !user) {
        return new Response(
          JSON.stringify({ error: "Unauthorized", message: "Invalid token" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      senderId = user.id;
    }

    const body = await req.json();
    const emailService = new EmailService();

    // Check if this is a raw email or template email
    if (body.template) {
      // Template-based email
      const request = body as SendEmailRequest;
      
      if (!request.template || !request.data || !request.to) {
        return new Response(
          JSON.stringify({ error: "Validation Error", message: "template, data, and to are required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`Sending template email: ${request.template} to ${JSON.stringify(request.to)}`);

      const result = await emailService.send({
        template: request.template,
        data: request.data,
        to: request.to,
        cc: request.cc,
        bcc: request.bcc,
        tags: {
          ...request.tags,
          sent_by: senderId,
        },
      });

      if (!result.success) {
        console.error("Email send failed:", result.error);
        return new Response(
          JSON.stringify({ error: "Email Error", message: result.error, provider: result.provider }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "Email sent successfully",
          messageId: result.messageId,
          provider: result.provider,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );

    } else {
      // Raw email
      const request = body as SendRawEmailRequest;

      if (!request.to || !request.subject || !request.html) {
        return new Response(
          JSON.stringify({ error: "Validation Error", message: "to, subject, and html are required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`Sending raw email: "${request.subject}" to ${JSON.stringify(request.to)}`);

      const result = await emailService.sendRaw({
        to: request.to,
        subject: request.subject,
        html: request.html,
        text: request.text,
        cc: request.cc,
        bcc: request.bcc,
        tags: {
          ...request.tags,
          sent_by: senderId,
        },
      });

      if (!result.success) {
        console.error("Email send failed:", result.error);
        return new Response(
          JSON.stringify({ error: "Email Error", message: result.error, provider: result.provider }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "Email sent successfully",
          messageId: result.messageId,
          provider: result.provider,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

  } catch (error) {
    console.error("Unexpected error in send-email:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    
    // Log application error
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      if (supabaseUrl && supabaseServiceKey) {
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        await supabase.from("application_logs").insert({
          service: "send-email",
          level: "error",
          message: `Email send failed: ${errorMessage}`,
          context: { error: errorMessage },
        });
      }
    } catch (logError) {
      console.error("Failed to log error:", logError);
    }

    return new Response(
      JSON.stringify({ error: "Internal Server Error", message: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
