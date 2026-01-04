import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EmailSettingsRequest {
  company_id: string;
  use_platform_default?: boolean;
  provider?: string;
  from_email?: string;
  from_name?: string;
  smtp_host?: string;
  smtp_port?: number;
  smtp_username?: string;
  smtp_password?: string;
  smtp_secure?: boolean;
  api_key?: string;
  aws_region?: string;
  aws_access_key_id?: string;
  aws_secret_access_key?: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Log request info for debugging
  const hasAuth = !!req.headers.get('Authorization');
  console.log(`[manage-email-settings] Method: ${req.method}, Has Auth: ${hasAuth}`);

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Verify authorization
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.log('[manage-email-settings] Missing authorization header');
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
      console.log('[manage-email-settings] Invalid token:', authError?.message);
      return new Response(JSON.stringify({ 
        code: 'AUTH_INVALID',
        error: 'Invalid or expired token. Please log in again.' 
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Parse body for all requests (POST method from supabase.functions.invoke)
    const body = await req.json().catch(() => ({}));
    const action = body.action || 'save'; // 'get', 'save', or 'delete'
    const companyId = body.company_id;

    console.log(`[manage-email-settings] Action: ${action}, Company: ${companyId}, User: ${user.id}`);

    if (!companyId) {
      return new Response(JSON.stringify({ 
        code: 'VALIDATION_ERROR',
        error: 'company_id is required' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify user is company admin
    const { data: isAdmin } = await supabaseAdmin.rpc('is_active_company_admin', {
      _user_id: user.id,
      _company_id: companyId,
    });

    if (!isAdmin) {
      console.log(`[manage-email-settings] User ${user.id} is not admin for company ${companyId}`);
      return new Response(JSON.stringify({ 
        code: 'NOT_ADMIN',
        error: 'Not authorized to manage email settings for this company' 
      }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // GET - Fetch settings
    if (action === 'get') {

      const { data: settings, error } = await supabaseAdmin
        .from('company_email_settings')
        .select('*')
        .eq('company_id', companyId)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
        throw error;
      }

      // Mask sensitive fields
      const maskedSettings = settings ? {
        ...settings,
        smtp_password: settings.smtp_password ? '••••••••' : null,
        api_key: settings.api_key ? '••••••••' : null,
        aws_secret_access_key: settings.aws_secret_access_key ? '••••••••' : null,
      } : null;

      return new Response(JSON.stringify({ settings: maskedSettings }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // SAVE - Create or update settings
    if (action === 'save') {
      // Check if settings exist
      const { data: existing } = await supabaseAdmin
        .from('company_email_settings')
        .select('id, smtp_password, api_key, aws_secret_access_key')
        .eq('company_id', companyId)
        .single();

      // Prepare update data - don't overwrite passwords with masked values
      const updateData: Record<string, unknown> = {
        company_id: companyId,
        use_platform_default: body.use_platform_default ?? true,
        provider: body.provider,
        from_email: body.from_email,
        from_name: body.from_name,
        smtp_host: body.smtp_host,
        smtp_port: body.smtp_port,
        smtp_username: body.smtp_username,
        smtp_secure: body.smtp_secure,
        aws_region: body.aws_region,
        is_verified: false, // Reset verification on settings change
      };

      // Only update passwords if not masked
      if (body.smtp_password && body.smtp_password !== '••••••••') {
        updateData.smtp_password = body.smtp_password;
      } else if (existing?.smtp_password) {
        updateData.smtp_password = existing.smtp_password;
      }

      if (body.api_key && body.api_key !== '••••••••') {
        updateData.api_key = body.api_key;
      } else if (existing?.api_key) {
        updateData.api_key = existing.api_key;
      }

      if (body.aws_access_key_id) {
        updateData.aws_access_key_id = body.aws_access_key_id;
      }

      if (body.aws_secret_access_key && body.aws_secret_access_key !== '••••••••') {
        updateData.aws_secret_access_key = body.aws_secret_access_key;
      } else if (existing?.aws_secret_access_key) {
        updateData.aws_secret_access_key = existing.aws_secret_access_key;
      }

      let result;
      if (existing) {
        // Update
        const { data, error } = await supabaseAdmin
          .from('company_email_settings')
          .update(updateData)
          .eq('id', existing.id)
          .select()
          .single();

        if (error) throw error;
        result = data;
      } else {
        // Insert
        const { data, error } = await supabaseAdmin
          .from('company_email_settings')
          .insert(updateData)
          .select()
          .single();

        if (error) throw error;
        result = data;
      }

      // Mask sensitive fields in response
      const maskedResult = {
        ...result,
        smtp_password: result.smtp_password ? '••••••••' : null,
        api_key: result.api_key ? '••••••••' : null,
        aws_secret_access_key: result.aws_secret_access_key ? '••••••••' : null,
      };

      console.log(`Email settings ${existing ? 'updated' : 'created'} for company ${companyId}`);

      return new Response(JSON.stringify({ settings: maskedResult }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // DELETE - Remove settings (revert to platform default)
    if (action === 'delete') {
      const { error } = await supabaseAdmin
        .from('company_email_settings')
        .delete()
        .eq('company_id', companyId);

      if (error) throw error;

      console.log(`Email settings deleted for company ${companyId}`);

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in manage-email-settings:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Internal server error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
