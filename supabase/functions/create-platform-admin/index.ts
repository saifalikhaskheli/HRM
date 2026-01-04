import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CreatePlatformAdminRequest {
  email: string;
  password: string;
  first_name?: string;
  last_name?: string;
  role?: 'owner' | 'admin' | 'support';
}

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

    // Parse request body
    const body: CreatePlatformAdminRequest = await req.json();
    const { email, password, first_name, last_name, role = 'admin' } = body;

    console.log(`Creating platform admin for email: ${email}, role: ${role}`);

    // Validate required fields
    if (!email || !password) {
      return new Response(
        JSON.stringify({ error: 'Bad Request', message: 'email and password are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if this is a bootstrap scenario (no platform_admins exist)
    const { data: existingPlatformAdmins, error: platformAdminCheckError } = await supabaseAdmin
      .from('platform_admins')
      .select('id')
      .eq('is_active', true)
      .limit(1);

    if (platformAdminCheckError) {
      console.error('Error checking existing platform admins:', platformAdminCheckError);
    }

    const isBootstrap = !existingPlatformAdmins || existingPlatformAdmins.length === 0;
    console.log('Bootstrap mode:', isBootstrap);

    // If not bootstrap, verify caller is authenticated and is a platform owner
    if (!isBootstrap) {
      const authHeader = req.headers.get('Authorization');
      if (!authHeader) {
        console.error('No authorization header provided');
        return new Response(
          JSON.stringify({ error: 'Unauthorized', message: 'No authorization header' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Create client with user's token to verify permissions
      const supabaseUser = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
        global: { headers: { Authorization: authHeader } },
      });

      const { data: { user: callerUser }, error: userError } = await supabaseUser.auth.getUser();
      if (userError || !callerUser) {
        console.error('Failed to get caller user:', userError);
        return new Response(
          JSON.stringify({ error: 'Unauthorized', message: 'Invalid token' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check if caller is a platform owner
      const { data: callerPlatformRole, error: roleError } = await supabaseAdmin
        .from('platform_admins')
        .select('role')
        .eq('user_id', callerUser.id)
        .eq('is_active', true)
        .single();

      if (roleError || !callerPlatformRole) {
        console.error('Caller is not a platform admin:', roleError);
        return new Response(
          JSON.stringify({ error: 'Forbidden', message: 'You are not a platform admin' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Only platform owners can create new platform admins
      if (callerPlatformRole.role !== 'owner') {
        console.error('Caller is not a platform owner, role:', callerPlatformRole.role);
        return new Response(
          JSON.stringify({ error: 'Forbidden', message: 'Only platform owners can create new platform admins' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Check if user already exists
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(u => u.email === email);

    let userId: string;

    if (existingUser) {
      console.log('User already exists:', existingUser.id);
      userId = existingUser.id;

      // Check if already a platform admin
      const { data: existingPlatformAdmin } = await supabaseAdmin
        .from('platform_admins')
        .select('id, role, is_active')
        .eq('user_id', userId)
        .single();

      if (existingPlatformAdmin) {
        if (existingPlatformAdmin.is_active) {
          return new Response(
            JSON.stringify({ 
              error: 'Conflict', 
              message: 'User is already a platform admin',
              existing_role: existingPlatformAdmin.role
            }),
            { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        } else {
          // Reactivate the platform admin
          await supabaseAdmin
            .from('platform_admins')
            .update({ is_active: true, role: isBootstrap ? 'owner' : role })
            .eq('id', existingPlatformAdmin.id);

          console.log('Reactivated existing platform admin');
          return new Response(
            JSON.stringify({
              success: true,
              message: 'Platform admin reactivated',
              user_id: userId,
              role: isBootstrap ? 'owner' : role,
              is_new_user: false,
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
    } else {
      // Create new user
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          first_name,
          last_name,
        },
      });

      if (createError || !newUser.user) {
        console.error('Failed to create user:', createError);
        return new Response(
          JSON.stringify({ error: 'Failed to create user', message: createError?.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      userId = newUser.user.id;
      console.log('Created new user:', userId);
    }

    // Check if user has any company associations and remove them
    const { data: existingCompanyUsers } = await supabaseAdmin
      .from('company_users')
      .select('id, company_id')
      .eq('user_id', userId);

    if (existingCompanyUsers && existingCompanyUsers.length > 0) {
      console.log(`User ${userId} has ${existingCompanyUsers.length} company associations - removing them`);
      
      // Remove company associations - platform admins should not be company users
      const { error: deleteError } = await supabaseAdmin
        .from('company_users')
        .delete()
        .eq('user_id', userId);

      if (deleteError) {
        console.error('Failed to remove company associations:', deleteError);
        // Non-fatal, continue with platform admin creation
      } else {
        console.log('Successfully removed company associations for new platform admin');
      }
    }

    // Add user to platform_admins
    // In bootstrap mode, first admin is always an owner
    const finalRole = isBootstrap ? 'owner' : role;
    
    const { error: platformAdminError } = await supabaseAdmin
      .from('platform_admins')
      .insert({
        user_id: userId,
        role: finalRole,
        is_active: true,
      });

    if (platformAdminError) {
      console.error('Failed to add platform admin:', platformAdminError);
      return new Response(
        JSON.stringify({ error: 'Failed to add platform admin', message: platformAdminError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Successfully created platform admin with role:', finalRole);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Platform admin created successfully',
        user_id: userId,
        role: finalRole,
        is_new_user: !existingUser,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in create-platform-admin:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Internal Server Error', message: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
