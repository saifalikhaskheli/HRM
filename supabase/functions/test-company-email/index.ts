import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TestEmailRequest {
  company_id: string;
  to: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Log request info for debugging
  const hasAuth = !!req.headers.get('Authorization');
  console.log(`[test-company-email] Method: ${req.method}, Has Auth: ${hasAuth}`);

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ 
      code: 'METHOD_NOT_ALLOWED',
      error: 'Method not allowed' 
    }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Verify authorization
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.log('[test-company-email] Missing authorization header');
      return new Response(JSON.stringify({ 
        code: 'AUTH_MISSING',
        error: 'Missing authorization header' 
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get user from token
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      console.log('[test-company-email] Invalid token:', authError?.message);
      return new Response(JSON.stringify({ 
        code: 'AUTH_INVALID',
        error: 'Invalid or expired token. Please log in again.' 
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body: TestEmailRequest = await req.json();
    const { company_id, to } = body;

    console.log(`[test-company-email] Company: ${company_id}, To: ${to}, User: ${user.id}`);

    if (!company_id || !to) {
      return new Response(JSON.stringify({ 
        code: 'VALIDATION_ERROR',
        error: 'company_id and to are required' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify user is company admin
    const { data: isAdmin } = await supabaseAdmin.rpc('is_active_company_admin', {
      _user_id: user.id,
      _company_id: company_id,
    });

    if (!isAdmin) {
      console.log(`[test-company-email] User ${user.id} is not admin for company ${company_id}`);
      return new Response(JSON.stringify({ 
        code: 'NOT_ADMIN',
        error: 'Not authorized to send test emails for this company' 
      }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get company email settings
    const { data: settings, error: settingsError } = await supabaseAdmin
      .from('company_email_settings')
      .select('*')
      .eq('company_id', company_id)
      .single();

    if (settingsError && settingsError.code !== 'PGRST116') {
      throw settingsError;
    }

    // Get company name for the test email
    const { data: company } = await supabaseAdmin
      .from('companies')
      .select('name')
      .eq('id', company_id)
      .single();

    const companyName = company?.name || 'Your Company';

    // Dynamically import the email service
    const { EmailService } = await import('../_shared/email/email-service.ts');
    const emailService = new EmailService();

    // Send test email
    const result = await emailService.sendRaw({
      to: { email: to },
      subject: `Test Email from ${companyName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #333;">Test Email</h1>
          <p>This is a test email from <strong>${companyName}</strong>.</p>
          <p>If you received this email, your email configuration is working correctly!</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
          <p style="color: #666; font-size: 12px;">
            Provider: ${settings?.use_platform_default ? 'Platform Default' : settings?.provider || 'Unknown'}<br />
            Sent at: ${new Date().toISOString()}
          </p>
        </div>
      `,
      text: `Test Email from ${companyName}\n\nThis is a test email. If you received this, your email configuration is working correctly!\n\nProvider: ${settings?.use_platform_default ? 'Platform Default' : settings?.provider || 'Unknown'}\nSent at: ${new Date().toISOString()}`,
      context: {
        companyId: company_id,
        triggeredBy: user.id,
        triggeredFrom: 'test-company-email',
      },
    });

    // Update last test result
    if (settings) {
      await supabaseAdmin
        .from('company_email_settings')
        .update({
          last_test_at: new Date().toISOString(),
          last_test_result: {
            success: result.success,
            error: result.error,
            provider: result.provider,
            tested_to: to,
          },
          is_verified: result.success,
          verified_at: result.success ? new Date().toISOString() : null,
        })
        .eq('id', settings.id);
    }

    if (result.success) {
      console.log(`Test email sent successfully for company ${company_id} to ${to}`);
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'Test email sent successfully',
        provider: result.provider,
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } else {
      console.error(`Test email failed for company ${company_id}:`, result.error);
      return new Response(JSON.stringify({ 
        success: false, 
        error: result.error,
        provider: result.provider,
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

  } catch (error) {
    console.error('Error in test-company-email:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Internal server error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
