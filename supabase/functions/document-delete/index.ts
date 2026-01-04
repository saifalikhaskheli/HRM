import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Support both camelCase (frontend) and snake_case field names
interface DeleteRequest {
  document_id?: string;
  documentId?: string;
  hard_delete?: boolean; // Only for cleanup jobs, not normal users
}

Deno.serve(async (req) => {
  console.log("[document-delete] Request received:", req.method);

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.error("[document-delete] No authorization header");
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
      console.error("[document-delete] Auth error:", userError);
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body: DeleteRequest = await req.json();
    
    // Support both camelCase and snake_case
    const documentId = body.documentId || body.document_id;
    
    console.log("[document-delete] Request for document:", documentId);

    if (!documentId) {
      return new Response(
        JSON.stringify({ error: "Missing document_id" }),
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
        title,
        deleted_at
      `)
      .eq("id", documentId)
      .single();

    if (docError || !document) {
      console.error("[document-delete] Document not found:", docError);
      return new Response(
        JSON.stringify({ error: "Document not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if already deleted
    if (document.deleted_at) {
      console.error("[document-delete] Document already deleted");
      return new Response(
        JSON.stringify({ error: "Document is already deleted" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const companyId = document.company_id;

    // Check if user has delete permission
    const { data: hasPermission } = await supabaseAdmin.rpc("has_permission", {
      _user_id: user.id,
      _company_id: companyId,
      _module: "documents",
      _action: "delete",
    });

    if (!hasPermission) {
      console.error("[document-delete] No delete permission");
      return new Response(
        JSON.stringify({ error: "You do not have permission to delete documents" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check write permissions (trial/frozen state)
    const { data: canWrite } = await supabaseAdmin.rpc("guard_write_operation", {
      _company_id: companyId,
    });

    if (!canWrite) {
      console.error("[document-delete] Write operations blocked");
      return new Response(
        JSON.stringify({ error: "Write operations are currently blocked. Please check your subscription status." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get employee ID of the deleter
    const { data: deleterEmployee } = await supabaseAdmin
      .from("employees")
      .select("id")
      .eq("user_id", user.id)
      .eq("company_id", companyId)
      .single();

    // Soft delete the document
    const { error: updateError } = await supabaseAdmin
      .from("employee_documents")
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by: deleterEmployee?.id || null,
      })
      .eq("id", documentId);

    if (updateError) {
      console.error("[document-delete] Failed to soft delete:", updateError);
      return new Response(
        JSON.stringify({ error: "Failed to delete document" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Delete file from storage
    const { error: storageError } = await supabaseAdmin.storage
      .from("employee-documents")
      .remove([document.file_url]);

    if (storageError) {
      console.warn("[document-delete] Failed to delete file from storage:", storageError);
      // Don't fail the request, file cleanup can happen later
    }

    // Log the delete action
    await supabaseAdmin.from("audit_logs").insert({
      company_id: companyId,
      user_id: user.id,
      table_name: "employee_documents",
      action: "delete",
      record_id: documentId,
      old_values: {
        title: document.title,
        file_name: document.file_name,
        employee_id: document.employee_id,
      },
      metadata: {
        action_type: "document_soft_delete",
        file_deleted: !storageError,
      },
    });

    // Log security event
    await supabaseAdmin.rpc("log_security_event", {
      _company_id: companyId,
      _user_id: user.id,
      _event_type: "data_modification",
      _description: `Document deleted: ${document.title}`,
      _severity: "medium",
      _metadata: {
        document_id: documentId,
        document_title: document.title,
        action: "delete",
      },
    });

    console.log("[document-delete] Document soft deleted:", documentId);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Document deleted successfully",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[document-delete] Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
