import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Create admin client with service role
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Check if any active platform admins exist
    const { data: existingPlatformAdmins, error: platformAdminCheckError } = await supabaseAdmin
      .from('platform_admins')
      .select('id')
      .eq('is_active', true)
      .limit(1);

    if (platformAdminCheckError) {
      console.error('Error checking existing platform admins:', platformAdminCheckError);
      return new Response(
        JSON.stringify({ error: 'Failed to check platform admins', message: platformAdminCheckError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const hasAdmins = existingPlatformAdmins && existingPlatformAdmins.length > 0;
    console.log('Platform admins exist:', hasAdmins);

    return new Response(
      JSON.stringify({
        success: true,
        has_admins: hasAdmins,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in check-platform-admin:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Internal Server Error', message: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
