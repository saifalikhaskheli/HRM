import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface WildcardHealthResult {
  baseDomain: string;
  wildcardConfigured: boolean;
  rootResolvable: boolean;
  testSubdomains: {
    subdomain: string;
    resolvable: boolean;
    ipAddress: string | null;
  }[];
  expectedIp: string | null;
  message: string;
  instructions: string[];
  vercelInstructions: string[];
  lovableInstructions: string[];
}

async function checkDnsResolution(hostname: string): Promise<{ resolvable: boolean; ipAddress: string | null }> {
  try {
    // Use Google's DNS-over-HTTPS API
    const response = await fetch(`https://dns.google/resolve?name=${hostname}&type=A`, {
      headers: { 'Accept': 'application/dns-json' },
    });
    
    if (!response.ok) {
      return { resolvable: false, ipAddress: null };
    }
    
    const data = await response.json();
    
    if (data.Answer && data.Answer.length > 0) {
      const aRecord = data.Answer.find((r: any) => r.type === 1);
      return { 
        resolvable: true, 
        ipAddress: aRecord?.data || null 
      };
    }
    
    return { resolvable: false, ipAddress: null };
  } catch (error) {
    console.error(`DNS check failed for ${hostname}:`, error);
    return { resolvable: false, ipAddress: null };
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { baseDomain } = await req.json();
    
    if (!baseDomain) {
      return new Response(
        JSON.stringify({ error: 'baseDomain is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[check-wildcard-health] Checking wildcard DNS for: ${baseDomain}`);

    // Check root domain
    const rootCheck = await checkDnsResolution(baseDomain);
    console.log(`[check-wildcard-health] Root domain check:`, rootCheck);

    // Generate random test subdomains to check wildcard
    const testSubdomains = [
      `test-${Date.now()}`,
      `wildcard-check-${Math.random().toString(36).substring(7)}`,
      'wildcard-test-12345',
    ];

    const subdomainResults = await Promise.all(
      testSubdomains.map(async (sub) => {
        const hostname = `${sub}.${baseDomain}`;
        const result = await checkDnsResolution(hostname);
        console.log(`[check-wildcard-health] Subdomain ${hostname}:`, result);
        return {
          subdomain: sub,
          resolvable: result.resolvable,
          ipAddress: result.ipAddress,
        };
      })
    );

    // Determine if wildcard is configured
    // Wildcard is configured if random subdomains resolve to the same IP as root
    const allSubdomainsResolve = subdomainResults.every(r => r.resolvable);
    const allSameIp = subdomainResults.every(r => r.ipAddress === rootCheck.ipAddress);
    const wildcardConfigured = allSubdomainsResolve && allSameIp && rootCheck.resolvable;

    // Build response message
    let message: string;
    if (wildcardConfigured) {
      message = `Wildcard DNS is properly configured for *.${baseDomain}`;
    } else if (rootCheck.resolvable && !allSubdomainsResolve) {
      message = `Root domain resolves but wildcard is not configured`;
    } else if (!rootCheck.resolvable) {
      message = `Root domain ${baseDomain} is not resolvable`;
    } else {
      message = `Wildcard DNS configuration is incomplete`;
    }

    // Build instructions based on hosting type
    const instructions = [
      'Configure wildcard DNS at your domain registrar (Cloudflare, GoDaddy, Namecheap, etc.)',
      `Add an A record for *.${baseDomain.split('.')[0]} pointing to your server IP`,
      'Wait for DNS propagation (can take up to 48 hours)',
    ];

    const vercelInstructions = [
      '1. Go to your Vercel project dashboard',
      '2. Navigate to Settings → Domains',
      `3. Add ${baseDomain} as a domain`,
      `4. Add *.${baseDomain} as a wildcard domain`,
      '5. Configure DNS:',
      `   - A record: *.${baseDomain.split('.')[0]} → 76.76.21.21`,
      `   - Or CNAME: *.${baseDomain.split('.')[0]} → cname.vercel-dns.com`,
      '6. Vercel will auto-provision SSL for wildcard domains',
    ];

    const lovableInstructions = [
      '1. Go to your Lovable project Settings → Domains',
      `2. Add ${baseDomain} as a custom domain`,
      `3. Add *.${baseDomain} as a wildcard domain (if supported)`,
      '4. Configure DNS:',
      `   - A record: @ → 185.158.133.1 (for root)`,
      `   - A record: *.${baseDomain.split('.')[0]} → 185.158.133.1 (for wildcard)`,
      '5. Wait for SSL provisioning',
    ];

    const result: WildcardHealthResult = {
      baseDomain,
      wildcardConfigured,
      rootResolvable: rootCheck.resolvable,
      testSubdomains: subdomainResults,
      expectedIp: rootCheck.ipAddress,
      message,
      instructions,
      vercelInstructions,
      lovableInstructions,
    };

    console.log(`[check-wildcard-health] Result:`, { baseDomain, wildcardConfigured, rootResolvable: rootCheck.resolvable });

    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[check-wildcard-health] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
