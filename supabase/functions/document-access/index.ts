import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encode as encodeBase64 } from "https://deno.land/std@0.190.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AccessRequest {
  documentId?: string;
  document_id?: string;
  accessType?: "view" | "download";
  access_type?: "view" | "download";
  responseMode?: "signedUrl" | "base64";
  response_mode?: "signedUrl" | "base64";
}

Deno.serve(async (req) => {
  console.log("[document-access] Request received:", req.method);

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.error("[document-access] No authorization header");
      return new Response(
        JSON.stringify({ error: "No authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

    // Get user from token
    const supabaseClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      console.error("[document-access] Auth error:", userError);
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body: AccessRequest = await req.json();
    
    // Support both camelCase and snake_case field names
    const documentId = body.documentId || body.document_id;
    const accessType = body.accessType || body.access_type;
    
    console.log("[document-access] Request for document:", documentId, "type:", accessType);

    if (!documentId || !accessType) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!["view", "download"].includes(accessType)) {
      return new Response(
        JSON.stringify({ error: "Invalid access type" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get document info
    const { data: document, error: docError } = await supabaseAdmin
      .from("employee_documents")
      .select(`
        id, 
        company_id, 
        employee_id, 
        file_url, 
        file_name,
        mime_type,
        title,
        deleted_at,
        verification_status
      `)
      .eq("id", documentId)
      .single();

    if (docError || !document) {
      console.error("[document-access] Document not found:", docError);
      return new Response(
        JSON.stringify({ error: "Document not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if document is soft deleted
    if (document.deleted_at) {
      console.error("[document-access] Document is deleted");
      return new Response(
        JSON.stringify({ error: "Document has been deleted" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const companyId = document.company_id;
    const ipAddress = req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || "unknown";
    const userAgent = req.headers.get("user-agent") || "unknown";

    // Check if user has access to this company
    const { data: companyUser, error: cuError } = await supabaseAdmin
      .from("company_users")
      .select("role, is_active")
      .eq("company_id", companyId)
      .eq("user_id", user.id)
      .eq("is_active", true)
      .single();

    if (cuError || !companyUser) {
      // Log denied access
      await supabaseAdmin.from("document_access_logs").insert({
        document_id: documentId,
        company_id: companyId,
        accessed_by: user.id,
        access_type: accessType,
        ip_address_masked: maskIpAddress(ipAddress),
        user_agent: truncateUserAgent(userAgent),
        access_granted: false,
        denial_reason: "User not in company",
      });

      console.error("[document-access] User not in company");
      return new Response(
        JSON.stringify({ error: "Access denied" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check document module access
    const { data: moduleAccess } = await supabaseAdmin.rpc("can_use_documents", {
      _user_id: user.id,
      _company_id: companyId,
    });

    if (!moduleAccess) {
      await supabaseAdmin.from("document_access_logs").insert({
        document_id: documentId,
        company_id: companyId,
        accessed_by: user.id,
        access_type: accessType,
        ip_address_masked: maskIpAddress(ipAddress),
        user_agent: truncateUserAgent(userAgent),
        access_granted: false,
        denial_reason: "Module not in plan",
      });

      console.error("[document-access] Documents module not accessible");
      return new Response(
        JSON.stringify({ error: "Documents module not available in your plan" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if user can access this specific document
    const { data: canAccess } = await supabaseAdmin.rpc("can_access_document", {
      _user_id: user.id,
      _document_id: documentId,
      _action: "read",
    });

    if (!canAccess) {
      await supabaseAdmin.from("document_access_logs").insert({
        document_id: documentId,
        company_id: companyId,
        accessed_by: user.id,
        access_type: accessType,
        ip_address_masked: maskIpAddress(ipAddress),
        user_agent: truncateUserAgent(userAgent),
        access_granted: false,
        denial_reason: "No read permission",
      });

      console.error("[document-access] No permission to access document");
      return new Response(
        JSON.stringify({ error: "You do not have permission to access this document" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const responseMode = body.responseMode || body.response_mode || "signedUrl";

    // Log successful access
    await supabaseAdmin.from("document_access_logs").insert({
      document_id: documentId,
      company_id: companyId,
      accessed_by: user.id,
      access_type: accessType,
      ip_address_masked: maskIpAddress(ipAddress),
      user_agent: truncateUserAgent(userAgent),
      access_granted: true,
    });

    // Update document access stats using RPC function
    await supabaseAdmin.rpc("log_document_access", {
      _document_id: documentId,
      _access_type: accessType,
      _ip_address: ipAddress,
      _user_agent: userAgent,
    });

    // Use only valid enum values for security_event_type
    if (accessType === "download") {
      await supabaseAdmin.rpc("log_security_event", {
        _company_id: companyId,
        _user_id: user.id,
        _event_type: "data_export",
        _description: `Document download: ${document.title}`,
        _severity: "low",
        _ip_address: ipAddress,
        _user_agent: userAgent,
        _metadata: {
          document_id: documentId,
          access_type: accessType,
          document_title: document.title,
        },
      });
    }

    console.log("[document-access] Access granted for document:", documentId);

    // If the browser blocks direct Storage URLs, return base64 instead
    if (responseMode === "base64") {
      const { data: fileBlob, error: downloadError } = await supabaseAdmin.storage
        .from("employee-documents")
        .download(document.file_url);

      if (downloadError || !fileBlob) {
        console.error("[document-access] Failed to download file from storage:", downloadError);
        return new Response(
          JSON.stringify({ error: "Failed to download document" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const mimeType = document.mime_type || "application/octet-stream";
      const arrayBuffer = await fileBlob.arrayBuffer();
      const fileBase64 = encodeBase64(arrayBuffer);

      return new Response(
        JSON.stringify({
          success: true,
          fileBase64,
          file_base64: fileBase64,
          mimeType,
          mime_type: mimeType,
          fileName: document.file_name,
          file_name: document.file_name,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Default: return a signed URL
    const expiresIn = accessType === "download" ? 60 : 300; // 1 min for download, 5 min for view

    const { data: signedUrlData, error: signError } = await supabaseAdmin.storage
      .from("employee-documents")
      .createSignedUrl(document.file_url, expiresIn);

    if (signError) {
      console.error("[document-access] Failed to create signed URL:", signError);
      return new Response(
        JSON.stringify({ error: "Failed to generate access URL" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Return response with both camelCase (for frontend) and snake_case (for backwards compat)
    return new Response(
      JSON.stringify({
        success: true,
        signedUrl: signedUrlData.signedUrl,
        signed_url: signedUrlData.signedUrl,
        fileName: document.file_name,
        file_name: document.file_name,
        expiresIn,
        expires_in: expiresIn,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[document-access] Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function maskIpAddress(ip: string): string {
  if (!ip || ip === "unknown") return ip;
  
  // IPv4
  if (ip.includes(".")) {
    const parts = ip.split(".");
    if (parts.length === 4) {
      return `${parts[0]}.${parts[1]}.xxx.xxx`;
    }
  }
  
  // IPv6 - just show first segment
  if (ip.includes(":")) {
    const firstSegment = ip.split(":")[0];
    return `${firstSegment}:xxxx:xxxx:xxxx`;
  }
  
  return ip;
}

function truncateUserAgent(ua: string): string {
  if (!ua || ua === "unknown") return ua;
  return ua.length > 100 ? ua.substring(0, 100) + "..." : ua;
}