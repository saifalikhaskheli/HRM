import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { subdomain, exclude_company_id } = await req.json();

    if (!subdomain) {
      return new Response(
        JSON.stringify({ available: false, message: 'Subdomain is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate subdomain format
    const subdomainRegex = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;
    if (!subdomainRegex.test(subdomain.toLowerCase())) {
      return new Response(
        JSON.stringify({ 
          available: false, 
          message: 'Invalid subdomain format. Use only lowercase letters, numbers, and hyphens.' 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Reserved subdomains
    const reservedSubdomains = [
      'www', 'api', 'app', 'admin', 'platform', 'support', 'help', 'docs',
      'mail', 'email', 'ftp', 'ssh', 'cdn', 'static', 'assets', 'beta',
      'staging', 'dev', 'test', 'demo', 'preview', 'sandbox', 'portal'
    ];

    if (reservedSubdomains.includes(subdomain.toLowerCase())) {
      return new Response(
        JSON.stringify({ available: false, message: 'This subdomain is reserved' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client with service role key
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check if subdomain exists in company_domains (excluding the requesting company if provided)
    let domainQuery = supabase
      .from('company_domains')
      .select('id')
      .eq('subdomain', subdomain.toLowerCase())
      .eq('is_active', true);

    if (exclude_company_id) {
      domainQuery = domainQuery.neq('company_id', exclude_company_id);
    }

    const { data: existingDomain, error: domainError } = await domainQuery.maybeSingle();

    if (domainError) {
      console.error('Error checking company_domains:', domainError);
      throw domainError;
    }

    if (existingDomain) {
      return new Response(
        JSON.stringify({ available: false, message: 'This subdomain is already taken' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if subdomain is in pending requests (excluding the requesting company if provided)
    let requestQuery = supabase
      .from('subdomain_change_requests')
      .select('id')
      .eq('requested_subdomain', subdomain.toLowerCase())
      .eq('status', 'pending');

    if (exclude_company_id) {
      requestQuery = requestQuery.neq('company_id', exclude_company_id);
    }

    const { data: pendingRequest, error: requestError } = await requestQuery.maybeSingle();

    if (requestError) {
      console.error('Error checking subdomain_change_requests:', requestError);
      throw requestError;
    }

    if (pendingRequest) {
      return new Response(
        JSON.stringify({ available: false, message: 'This subdomain is reserved by a pending request' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Subdomain ${subdomain} is available`);

    return new Response(
      JSON.stringify({ available: true, message: 'Subdomain is available' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error checking subdomain availability:', error);
    return new Response(
      JSON.stringify({ available: false, message: 'Failed to check availability' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
