import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify user
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      console.error("Auth error:", authError?.message || "No user found");
      return new Response(
        JSON.stringify({ error: "Session expired. Please refresh the page and try again." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { domain_id } = body;

    if (!domain_id) {
      return new Response(
        JSON.stringify({ error: "domain_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Get the domain record
    const { data: domainRecord, error: domainError } = await supabaseAdmin
      .from("company_domains")
      .select("*")
      .eq("id", domain_id)
      .single();

    if (domainError || !domainRecord) {
      return new Response(
        JSON.stringify({ error: "Domain not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify user has access to this company
    const { data: companyUser } = await supabaseAdmin
      .from("company_users")
      .select("role")
      .eq("company_id", domainRecord.company_id)
      .eq("user_id", user.id)
      .eq("is_active", true)
      .single();

    if (!companyUser || !["super_admin", "company_admin"].includes(companyUser.role)) {
      return new Response(
        JSON.stringify({ error: "Forbidden" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!domainRecord.custom_domain || !domainRecord.verification_token) {
      return new Response(
        JSON.stringify({ error: "Invalid domain record" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Verifying domain: ${domainRecord.custom_domain}`);

    // Perform DNS TXT record lookup
    let verified = false;
    try {
      const txtRecords = await Deno.resolveDns(
        `_hrplatform-verify.${domainRecord.custom_domain}`,
        "TXT"
      );
      
      console.log(`TXT records found:`, txtRecords);
      
      // Check if any TXT record matches the verification token (with prefix or legacy format)
      const expectedValue = `hrplatform-verify=${domainRecord.verification_token}`;
      verified = txtRecords.some(record => 
        record.some((txt: string) => 
          txt === expectedValue || txt === domainRecord.verification_token // backward compatibility
        )
      );
    } catch (dnsError) {
      console.error(`DNS lookup failed for ${domainRecord.custom_domain}:`, dnsError);
      
      return new Response(
        JSON.stringify({ 
          verified: false, 
          message: "DNS record not found. Please add the TXT record and wait for propagation (up to 48 hours)." 
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (verified) {
      // Update the domain record
      await supabaseAdmin
        .from("company_domains")
        .update({
          is_verified: true,
          verified_at: new Date().toISOString(),
        })
        .eq("id", domain_id);

      console.log(`Domain verified: ${domainRecord.custom_domain}`);

      return new Response(
        JSON.stringify({ verified: true, message: "Domain verified successfully!" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else {
      return new Response(
        JSON.stringify({ 
          verified: false, 
          message: "Verification token not found in TXT record. Please check the value matches exactly." 
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (error) {
    console.error("Error in verify-domain:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
