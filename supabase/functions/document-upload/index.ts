import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Support both camelCase (frontend) and snake_case field names
interface UploadRequest {
  // snake_case (original)
  employee_id?: string;
  document_type_id?: string;
  file_name?: string;
  file_size?: number;
  mime_type?: string;
  issue_date?: string;
  expiry_date?: string;
  parent_document_id?: string;
  company_id?: string;
  // camelCase (frontend sends these)
  employeeId?: string;
  documentTypeId?: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  issueDate?: string;
  expiryDate?: string;
  parentDocumentId?: string;
  companyId?: string;
  // Common fields
  title?: string;
  description?: string;
}

const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

Deno.serve(async (req) => {
  console.log("[document-upload] Request received:", req.method);

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.error("[document-upload] No authorization header");
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
      console.error("[document-upload] Auth error:", userError);
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body: UploadRequest = await req.json();
    
    // Normalize fields - support both camelCase and snake_case
    const employeeId = body.employeeId || body.employee_id;
    const documentTypeId = body.documentTypeId || body.document_type_id;
    const fileName = body.fileName || body.file_name;
    const fileSize = body.fileSize || body.file_size;
    const mimeType = body.mimeType || body.mime_type;
    const issueDate = body.issueDate || body.issue_date;
    const expiryDate = body.expiryDate || body.expiry_date;
    const parentDocumentId = body.parentDocumentId || body.parent_document_id;
    const title = body.title;
    const description = body.description;

    console.log("[document-upload] Normalized request:", { employeeId, documentTypeId, title, fileName });

    // Validate required fields
    if (!employeeId || !documentTypeId || !title || !fileName || !fileSize || !mimeType) {
      console.error("[document-upload] Missing required fields:", { employeeId, documentTypeId, title, fileName, fileSize, mimeType });
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate MIME type
    if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
      console.error("[document-upload] Invalid MIME type:", mimeType);
      return new Response(
        JSON.stringify({ error: "Invalid file type. Allowed: PDF, JPEG, PNG, WEBP, DOC, DOCX" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate file size
    if (fileSize > MAX_FILE_SIZE) {
      console.error("[document-upload] File too large:", fileSize);
      return new Response(
        JSON.stringify({ error: "File size exceeds 50MB limit" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get employee's company
    const { data: employee, error: empError } = await supabaseAdmin
      .from("employees")
      .select("id, company_id, user_id")
      .eq("id", employeeId)
      .single();

    if (empError || !employee) {
      console.error("[document-upload] Employee not found:", empError);
      return new Response(
        JSON.stringify({ error: "Employee not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const companyId = employee.company_id;

    // Check if user has access to this company
    const { data: companyUser, error: cuError } = await supabaseAdmin
      .from("company_users")
      .select("role, is_active")
      .eq("company_id", companyId)
      .eq("user_id", user.id)
      .eq("is_active", true)
      .single();

    if (cuError || !companyUser) {
      console.error("[document-upload] User not in company:", cuError);
      return new Response(
        JSON.stringify({ error: "Not authorized for this company" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check document module access
    const { data: moduleAccess } = await supabaseAdmin.rpc("can_use_documents", {
      _user_id: user.id,
      _company_id: companyId,
    });

    if (!moduleAccess) {
      console.error("[document-upload] Documents module not accessible");
      return new Response(
        JSON.stringify({ error: "Documents module not available in your plan" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check write permissions (trial/frozen state)
    const { data: canWrite } = await supabaseAdmin.rpc("guard_write_operation", {
      _company_id: companyId,
    });

    if (!canWrite) {
      console.error("[document-upload] Write operations blocked");
      return new Response(
        JSON.stringify({ error: "Write operations are currently blocked. Please check your subscription status." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if user is uploading for themselves or has create permission
    const isOwnUpload = employee.user_id === user.id;
    
    if (!isOwnUpload) {
      const { data: hasPermission } = await supabaseAdmin.rpc("has_permission", {
        _user_id: user.id,
        _company_id: companyId,
        _module: "documents",
        _action: "create",
      });

      if (!hasPermission) {
        console.error("[document-upload] No create permission");
        return new Response(
          JSON.stringify({ error: "You do not have permission to upload documents for this employee" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Check document limits
    const { data: limits } = await supabaseAdmin.rpc("check_document_limits", {
      _company_id: companyId,
      _employee_id: employeeId,
    });

    if (limits && !limits.can_upload) {
      console.error("[document-upload] Document limits exceeded:", limits);
      return new Response(
        JSON.stringify({ 
          error: "Document upload limit reached. Please upgrade your plan or remove existing documents.",
          limits 
        }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate document type exists and is active
    const { data: docType, error: dtError } = await supabaseAdmin
      .from("document_types")
      .select("id, name, has_expiry, is_required")
      .eq("id", documentTypeId)
      .eq("company_id", companyId)
      .eq("is_active", true)
      .single();

    if (dtError || !docType) {
      console.error("[document-upload] Invalid document type:", dtError);
      return new Response(
        JSON.stringify({ error: "Invalid document type" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // If document type has expiry, require expiry date
    if (docType.has_expiry && !expiryDate) {
      return new Response(
        JSON.stringify({ error: "Expiry date is required for this document type" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Handle versioning - if replacing a document
    let versionNumber = 1;
    if (parentDocumentId) {
      // Mark old version as not latest
      const { data: parentDoc } = await supabaseAdmin
        .from("employee_documents")
        .select("version_number")
        .eq("id", parentDocumentId)
        .single();

      if (parentDoc) {
        versionNumber = (parentDoc.version_number || 1) + 1;
        
        await supabaseAdmin
          .from("employee_documents")
          .update({ is_latest_version: false })
          .eq("id", parentDocumentId);
      }
    }

    // Generate unique file path: company_id/employee_id/document_id/filename
    const documentId = crypto.randomUUID();
    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, "_");
    const storagePath = `${companyId}/${employeeId}/${documentId}/${sanitizedFileName}`;

    // Generate signed upload URL
    const { data: signedUrl, error: signError } = await supabaseAdmin.storage
      .from("employee-documents")
      .createSignedUploadUrl(storagePath);

    if (signError) {
      console.error("[document-upload] Failed to create signed URL:", signError);
      return new Response(
        JSON.stringify({ error: "Failed to initialize upload" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create document record (pending upload completion)
    const { data: document, error: insertError } = await supabaseAdmin
      .from("employee_documents")
      .insert({
        id: documentId,
        company_id: companyId,
        employee_id: employeeId,
        document_type_id: documentTypeId,
        title: title,
        description: description || null,
        file_name: fileName,
        file_url: storagePath,
        file_size: fileSize,
        mime_type: mimeType,
        issue_date: issueDate || null,
        expiry_date: expiryDate || null,
        verification_status: "pending",
        is_verified: false,
        version_number: versionNumber,
        parent_document_id: parentDocumentId || null,
        is_latest_version: true,
      })
      .select()
      .single();

    if (insertError) {
      console.error("[document-upload] Failed to create document record:", insertError);
      return new Response(
        JSON.stringify({ error: "Failed to create document record" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Log the upload action
    await supabaseAdmin.from("audit_logs").insert({
      company_id: companyId,
      user_id: user.id,
      table_name: "employee_documents",
      action: "create",
      record_id: documentId,
      new_values: {
        title: title,
        employee_id: employeeId,
        document_type: docType.name,
        file_size: fileSize,
      },
      metadata: {
        action_type: "document_upload_initiated",
        version_number: versionNumber,
        parent_document_id: parentDocumentId,
      },
    });

    console.log("[document-upload] Success - document created:", documentId);

    // Return both camelCase and snake_case for compatibility
    return new Response(
      JSON.stringify({
        success: true,
        // camelCase (frontend expects)
        documentId: documentId,
        uploadUrl: signedUrl.signedUrl,
        uploadToken: signedUrl.token,
        storagePath: storagePath,
        expiresIn: 300,
        // snake_case (backward compatibility)
        document_id: documentId,
        upload_url: signedUrl.signedUrl,
        upload_token: signedUrl.token,
        storage_path: storagePath,
        expires_in: 300,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[document-upload] Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
