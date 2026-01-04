import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DnsResult {
  provider: string;
  ip: string | null;
  success: boolean;
}

interface HealthCheckResult {
  domain: string;
  rootResolved: boolean;
  rootIp: string | null;
  wildcardConfigured: boolean;
  wwwResolved: boolean;
  wwwIp: string | null;
  isHealthy: boolean;
  messages: string[];
  expectedIp?: string;
  ipMismatch?: boolean;
  // New fields for global DNS check
  checkSource: string;
  dnsProviders: DnsResult[];
  propagationStatus: 'complete' | 'partial' | 'pending';
}

const HOSTING_IPS: Record<string, string> = {
  lovable: '185.158.133.1',
  vercel: '76.76.21.21',
};

// Use DNS-over-HTTPS for global, consistent results
async function resolveDomainGlobal(domain: string): Promise<{ success: boolean; addresses: string[]; providers: DnsResult[] }> {
  const providers: DnsResult[] = [];
  const allAddresses: string[] = [];

  // Check with Google DNS (8.8.8.8)
  try {
    const googleResponse = await fetch(`https://dns.google/resolve?name=${domain}&type=A`, {
      headers: { 'Accept': 'application/dns-json' },
    });
    
    if (googleResponse.ok) {
      const data = await googleResponse.json();
      if (data.Answer && data.Answer.length > 0) {
        const aRecord = data.Answer.find((r: any) => r.type === 1);
        if (aRecord?.data) {
          providers.push({ provider: 'Google DNS', ip: aRecord.data, success: true });
          allAddresses.push(aRecord.data);
        }
      } else {
        providers.push({ provider: 'Google DNS', ip: null, success: false });
      }
    }
  } catch (error) {
    console.log(`Google DNS check failed for ${domain}:`, error);
    providers.push({ provider: 'Google DNS', ip: null, success: false });
  }

  // Check with Cloudflare DNS (1.1.1.1)
  try {
    const cfResponse = await fetch(`https://cloudflare-dns.com/dns-query?name=${domain}&type=A`, {
      headers: { 'Accept': 'application/dns-json' },
    });
    
    if (cfResponse.ok) {
      const data = await cfResponse.json();
      if (data.Answer && data.Answer.length > 0) {
        const aRecord = data.Answer.find((r: any) => r.type === 1);
        if (aRecord?.data) {
          providers.push({ provider: 'Cloudflare DNS', ip: aRecord.data, success: true });
          if (!allAddresses.includes(aRecord.data)) {
            allAddresses.push(aRecord.data);
          }
        }
      } else {
        providers.push({ provider: 'Cloudflare DNS', ip: null, success: false });
      }
    }
  } catch (error) {
    console.log(`Cloudflare DNS check failed for ${domain}:`, error);
    providers.push({ provider: 'Cloudflare DNS', ip: null, success: false });
  }

  const success = allAddresses.length > 0;
  return { success, addresses: allAddresses, providers };
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { domain, hostingProvider } = await req.json();

    if (!domain) {
      return new Response(
        JSON.stringify({ error: 'Domain is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Clean the domain
    const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/\/$/, '').toLowerCase();
    
    console.log(`[check-domain-health] Checking domain: ${cleanDomain}, provider: ${hostingProvider}`);

    const messages: string[] = [];
    let wildcardConfigured = false;
    let rootResolved = false;
    let rootIp: string | null = null;
    let wwwResolved = false;
    let wwwIp: string | null = null;

    // Get expected IP based on hosting provider
    const expectedIp = hostingProvider ? HOSTING_IPS[hostingProvider] : undefined;

    // Step 1: Check if the root domain resolves (using global DNS)
    const rootResult = await resolveDomainGlobal(cleanDomain);
    if (rootResult.success && rootResult.addresses.length > 0) {
      rootResolved = true;
      rootIp = rootResult.addresses[0];
      messages.push(`✓ Root domain resolves to ${rootResult.addresses.join(', ')} (via global DNS)`);
    } else {
      messages.push(`✗ Root domain does not resolve globally`);
    }

    // Step 2: Check if a test subdomain resolves (indicates wildcard DNS)
    const testSubdomain = `_healthcheck-${Date.now()}`;
    const testDomain = `${testSubdomain}.${cleanDomain}`;
    
    const subdomainResult = await resolveDomainGlobal(testDomain);
    if (subdomainResult.success && subdomainResult.addresses.length > 0) {
      messages.push(`✓ Wildcard subdomain resolves to ${subdomainResult.addresses.join(', ')}`);
      
      if (rootIp && subdomainResult.addresses.includes(rootIp)) {
        wildcardConfigured = true;
        messages.push(`✓ Wildcard DNS correctly configured (points to same IP as root)`);
      } else if (rootIp) {
        wildcardConfigured = true;
        messages.push(`⚠ Wildcard DNS configured but points to different IP: ${subdomainResult.addresses.join(', ')}`);
      } else {
        wildcardConfigured = true;
        messages.push(`✓ Wildcard DNS is configured`);
      }
    } else {
      messages.push(`✗ Wildcard subdomain does not resolve`);
      messages.push(`→ To enable subdomains, add a wildcard A record: *.${cleanDomain} → your server IP`);
    }

    // Step 3: Check www subdomain
    const wwwResult = await resolveDomainGlobal(`www.${cleanDomain}`);
    if (wwwResult.success && wwwResult.addresses.length > 0) {
      wwwResolved = true;
      wwwIp = wwwResult.addresses[0];
      messages.push(`✓ www subdomain resolves to ${wwwResult.addresses.join(', ')}`);
    } else {
      messages.push(`✗ www subdomain does not resolve`);
    }

    // Check IP mismatch
    const ipMismatch = expectedIp && rootIp ? rootIp !== expectedIp : false;
    if (ipMismatch && expectedIp) {
      messages.push(`⚠ IP mismatch: expected ${expectedIp} (${hostingProvider}), got ${rootIp}`);
      messages.push(`→ DNS may still be propagating from old nameservers. This can take 24-48 hours.`);
    }

    // Determine propagation status
    let propagationStatus: 'complete' | 'partial' | 'pending' = 'pending';
    const successfulProviders = rootResult.providers.filter(p => p.success && p.ip === expectedIp).length;
    const totalProviders = rootResult.providers.length;
    
    if (expectedIp) {
      if (successfulProviders === totalProviders && totalProviders > 0) {
        propagationStatus = 'complete';
      } else if (successfulProviders > 0) {
        propagationStatus = 'partial';
      } else if (rootResolved) {
        // Resolves but to wrong IP
        propagationStatus = 'pending';
      }
    } else {
      // No expected IP, just check if it resolves
      propagationStatus = rootResolved ? 'complete' : 'pending';
    }

    // Determine overall health
    const isHealthy = rootResolved && !ipMismatch;

    // Build summary message
    if (isHealthy && wildcardConfigured) {
      messages.unshift('✓ Domain is fully configured for subdomain routing');
    } else if (ipMismatch) {
      messages.unshift(`⏳ DNS propagation in progress - waiting for nameserver changes to propagate globally (24-48 hours)`);
    } else if (rootResolved && !wildcardConfigured) {
      messages.unshift('Root domain works but wildcard DNS is not configured - subdomains will not work');
    } else if (!rootResolved) {
      messages.unshift('Domain does not resolve - check DNS configuration');
    } else {
      messages.unshift('Partial configuration detected - review details below');
    }

    const result: HealthCheckResult = {
      domain: cleanDomain,
      rootResolved,
      rootIp,
      wildcardConfigured,
      wwwResolved,
      wwwIp,
      isHealthy,
      messages,
      expectedIp,
      ipMismatch,
      checkSource: 'Global (Google DNS + Cloudflare DNS)',
      dnsProviders: rootResult.providers,
      propagationStatus,
    };

    console.log('[check-domain-health] Result:', { 
      domain: cleanDomain, 
      rootResolved, 
      rootIp, 
      expectedIp, 
      ipMismatch,
      propagationStatus,
      providers: rootResult.providers 
    });

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[check-domain-health] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Health check failed';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
