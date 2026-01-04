import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const VERCEL_API_TOKEN = Deno.env.get('VERCEL_API_TOKEN');
const VERCEL_PROJECT_ID = Deno.env.get('VERCEL_PROJECT_ID');
const VERCEL_TEAM_ID = Deno.env.get('VERCEL_TEAM_ID');

interface VercelDomainResponse {
  name: string;
  apexName: string;
  projectId: string;
  verified: boolean;
  verification?: Array<{
    type: string;
    domain: string;
    value: string;
    reason: string;
  }>;
  error?: {
    code: string;
    message: string;
  };
}

interface VercelDomainConfig {
  configuredBy: string | null;
  misconfigured: boolean;
}

async function addDomainToVercel(domain: string): Promise<{ success: boolean; data?: VercelDomainResponse; error?: string }> {
  console.log(`Adding domain ${domain} to Vercel project ${VERCEL_PROJECT_ID}`);
  
  const teamParam = VERCEL_TEAM_ID ? `&teamId=${VERCEL_TEAM_ID}` : '';
  const url = `https://api.vercel.com/v10/projects/${VERCEL_PROJECT_ID}/domains?${teamParam}`;
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${VERCEL_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: domain }),
    });

    const data = await response.json();
    console.log('Vercel add domain response:', JSON.stringify(data));

    if (!response.ok) {
      // Handle specific error cases
      if (data.error?.code === 'domain_already_in_use') {
        return { success: false, error: 'This domain is already in use by another Vercel project' };
      }
      if (data.error?.code === 'domain_taken') {
        return { success: false, error: 'This domain is already registered on Vercel by another account' };
      }
      return { success: false, error: data.error?.message || 'Failed to add domain to Vercel' };
    }

    return { success: true, data };
  } catch (error) {
    console.error('Error adding domain to Vercel:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

async function removeDomainFromVercel(domain: string): Promise<{ success: boolean; error?: string }> {
  console.log(`Removing domain ${domain} from Vercel project ${VERCEL_PROJECT_ID}`);
  
  const teamParam = VERCEL_TEAM_ID ? `?teamId=${VERCEL_TEAM_ID}` : '';
  const url = `https://api.vercel.com/v9/projects/${VERCEL_PROJECT_ID}/domains/${domain}${teamParam}`;
  
  try {
    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${VERCEL_API_TOKEN}`,
      },
    });

    if (!response.ok) {
      const data = await response.json();
      console.error('Vercel remove domain error:', data);
      return { success: false, error: data.error?.message || 'Failed to remove domain from Vercel' };
    }

    console.log('Domain removed successfully from Vercel');
    return { success: true };
  } catch (error) {
    console.error('Error removing domain from Vercel:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

async function getDomainStatus(domain: string): Promise<{ 
  success: boolean; 
  verified?: boolean; 
  configured?: boolean;
  misconfigured?: boolean;
  error?: string;
}> {
  console.log(`Checking domain status for ${domain}`);
  
  const teamParam = VERCEL_TEAM_ID ? `?teamId=${VERCEL_TEAM_ID}` : '';
  
  try {
    // Get domain info
    const domainUrl = `https://api.vercel.com/v9/projects/${VERCEL_PROJECT_ID}/domains/${domain}${teamParam}`;
    const domainResponse = await fetch(domainUrl, {
      headers: { 'Authorization': `Bearer ${VERCEL_API_TOKEN}` },
    });

    if (!domainResponse.ok) {
      if (domainResponse.status === 404) {
        return { success: false, error: 'Domain not found in Vercel project' };
      }
      const data = await domainResponse.json();
      return { success: false, error: data.error?.message || 'Failed to get domain status' };
    }

    const domainData: VercelDomainResponse = await domainResponse.json();
    console.log('Domain data:', JSON.stringify(domainData));

    // Get domain configuration
    const configUrl = `https://api.vercel.com/v6/domains/${domain}/config${teamParam}`;
    const configResponse = await fetch(configUrl, {
      headers: { 'Authorization': `Bearer ${VERCEL_API_TOKEN}` },
    });

    let misconfigured = false;
    if (configResponse.ok) {
      const configData: VercelDomainConfig = await configResponse.json();
      console.log('Domain config:', JSON.stringify(configData));
      misconfigured = configData.misconfigured;
    }

    return {
      success: true,
      verified: domainData.verified,
      configured: !misconfigured,
      misconfigured,
    };
  } catch (error) {
    console.error('Error getting domain status:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

async function verifyDomainOnVercel(domain: string): Promise<{ success: boolean; verified?: boolean; error?: string }> {
  console.log(`Triggering verification for domain ${domain}`);
  
  const teamParam = VERCEL_TEAM_ID ? `?teamId=${VERCEL_TEAM_ID}` : '';
  const url = `https://api.vercel.com/v9/projects/${VERCEL_PROJECT_ID}/domains/${domain}/verify${teamParam}`;
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${VERCEL_API_TOKEN}`,
      },
    });

    const data = await response.json();
    console.log('Vercel verify response:', JSON.stringify(data));

    if (!response.ok) {
      return { success: false, error: data.error?.message || 'Verification failed' };
    }

    return { success: true, verified: data.verified };
  } catch (error) {
    console.error('Error verifying domain:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  try {
    // Verify required environment variables
    if (!VERCEL_API_TOKEN || !VERCEL_PROJECT_ID) {
      console.error('Missing Vercel configuration');
      return json({ error: 'Vercel integration not configured' }, 500);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
      console.error('Missing Supabase configuration');
      return json({ error: 'Server misconfigured' }, 500);
    }

    // --- Auth (manual) ---
    // We keep config.toml verify_jwt=false, but we still require a valid logged-in user here.
    const authHeader = req.headers.get('Authorization') || '';
    if (!authHeader.startsWith('Bearer ')) {
      return json({ error: 'Missing Authorization header' }, 401);
    }

    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userError } = await authClient.auth.getUser();
    if (userError || !userData?.user) {
      console.error('Auth failed:', userError);
      return json({ error: 'Invalid JWT' }, 401);
    }

    const { action, domain, domainId, companyId } = await req.json();
    console.log(`Processing action: ${action} for domain: ${domain}`);

    if (!action || !domain) {
      return json({ error: 'Action and domain are required' }, 400);
    }

    // Create service role client for DB updates / authorization checks
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // --- Authorization (platform admin OR company admin for companyId) ---
    if (!companyId) {
      return json({ error: 'companyId is required' }, 400);
    }

    const userId = userData.user.id;

    const { data: platformAdmin, error: platformAdminError } = await adminClient
      .from('platform_admins')
      .select('id')
      .eq('user_id', userId)
      .eq('is_active', true)
      .maybeSingle();

    if (platformAdminError) {
      console.error('Failed to check platform_admins:', platformAdminError);
      return json({ error: 'Authorization check failed' }, 500);
    }

    let allowed = Boolean(platformAdmin);

    if (!allowed) {
      const { data: companyUser, error: companyUserError } = await adminClient
        .from('company_users')
        .select('id, role')
        .eq('user_id', userId)
        .eq('company_id', companyId)
        .eq('is_active', true)
        .in('role', ['super_admin', 'company_admin'])
        .maybeSingle();

      if (companyUserError) {
        console.error('Failed to check company_users:', companyUserError);
        return json({ error: 'Authorization check failed' }, 500);
      }

      allowed = Boolean(companyUser);
    }

    if (!allowed) {
      return json({ error: 'Not authorized' }, 403);
    }

    let result;

    switch (action) {
      case 'add': {
        result = await addDomainToVercel(domain);

        if (domainId) {
          if (result.success) {
            await adminClient
              .from('company_domains')
              .update({
                vercel_status: result.data?.verified ? 'active' : 'pending',
                vercel_verified: result.data?.verified || false,
                vercel_error: null,
              })
              .eq('id', domainId);
          } else {
            await adminClient
              .from('company_domains')
              .update({
                vercel_status: 'error',
                vercel_error: result.error,
              })
              .eq('id', domainId);
          }
        }

        break;
      }

      case 'remove': {
        result = await removeDomainFromVercel(domain);
        break;
      }

      case 'status': {
        result = await getDomainStatus(domain);

        if (result.success && domainId) {
          const status =
            result.verified && result.configured
              ? 'active'
              : result.misconfigured
                ? 'misconfigured'
                : 'pending';

          await adminClient
            .from('company_domains')
            .update({
              vercel_status: status,
              vercel_verified: result.verified || false,
              is_verified: Boolean(result.verified && result.configured),
              is_active: Boolean(result.verified && result.configured),
              vercel_error: result.misconfigured ? 'DNS misconfigured' : null,
            })
            .eq('id', domainId);
        }

        break;
      }

      case 'verify': {
        // If domain isn't attached to the project yet, attach it first, then verify.
        const preflight = await getDomainStatus(domain);
        if (!preflight.success && /not found/i.test(preflight.error || '')) {
          console.log('Domain not found on project; attempting to add it first');
          const addResult = await addDomainToVercel(domain);
          if (!addResult.success) {
            result = { success: false, error: addResult.error || 'Failed to add domain to Vercel' };
            break;
          }
        }

        result = await verifyDomainOnVercel(domain);

        if (result.success && domainId) {
          await adminClient
            .from('company_domains')
            .update({
              vercel_status: result.verified ? 'active' : 'pending',
              vercel_verified: result.verified || false,
              is_verified: result.verified || false,
              is_active: result.verified || false,
              verified_at: result.verified ? new Date().toISOString() : null,
              vercel_error: null,
            })
            .eq('id', domainId);
        }

        break;
      }

      default:
        return json({ error: `Unknown action: ${action}` }, 400);
    }

    return json(result);
  } catch (error) {
    console.error('Error in manage-vercel-domain:', error);
    return json({ error: error instanceof Error ? error.message : 'Unknown error' }, 500);
  }
});

