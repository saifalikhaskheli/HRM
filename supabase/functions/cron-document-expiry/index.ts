import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ExpiringDocument {
  document_id: string;
  company_id: string;
  employee_id: string;
  employee_user_id: string | null;
  employee_email: string;
  employee_name: string;
  document_title: string;
  document_type_name: string;
  expiry_date: string;
  days_until_expiry: number;
  manager_user_id: string | null;
  manager_email: string | null;
}

const NOTIFICATION_THRESHOLDS = [30, 14, 7, 3, 1];

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log("Starting document expiry cron...");

    const results = {
      documentsExpired: 0,
      notificationsSent: 0,
      errors: 0,
    };

    // 1. Auto-expire documents that are past expiry date
    console.log("Processing expired documents...");
    const { data: expiredCount, error: expireError } = await supabase
      .rpc('process_expired_documents');

    if (expireError) {
      console.error("Error processing expired documents:", expireError);
      results.errors++;
    } else {
      results.documentsExpired = expiredCount || 0;
      console.log(`Auto-expired ${results.documentsExpired} documents`);
    }

    // 2. Send notifications for expiring documents
    console.log("Checking for expiring documents...");
    const { data: expiringDocs, error: fetchError } = await supabase
      .rpc('get_expiring_documents', { _days_threshold: 30 });

    if (fetchError) {
      console.error("Error fetching expiring documents:", fetchError);
      results.errors++;
    } else {
      console.log(`Found ${expiringDocs?.length || 0} expiring documents`);

      for (const doc of (expiringDocs || []) as ExpiringDocument[]) {
        // Only notify on specific thresholds
        if (!NOTIFICATION_THRESHOLDS.includes(doc.days_until_expiry)) {
          continue;
        }

        const today = new Date().toISOString().split('T')[0];
        const notificationType = `expiring_${doc.days_until_expiry}_days`;

        // Check if we already notified today
        const { data: existingNotif } = await supabase
          .from('document_expiry_notifications')
          .select('id')
          .eq('document_id', doc.document_id)
          .eq('notification_type', notificationType)
          .gte('sent_at', today)
          .limit(1);

        if (existingNotif?.length) {
          continue;
        }

        const urgency = doc.days_until_expiry <= 3 ? '⚠️ ' : 
                       doc.days_until_expiry <= 7 ? '⏰ ' : '📋 ';
        
        const title = doc.days_until_expiry === 1
          ? `${urgency}Document expires tomorrow: ${doc.document_title}`
          : `${urgency}Document expiring in ${doc.days_until_expiry} days: ${doc.document_title}`;

        const message = `${doc.document_type_name} for ${doc.employee_name} expires on ${new Date(doc.expiry_date).toLocaleDateString()}. Please renew or upload an updated document.`;

        // Notify employee if they have user access
        if (doc.employee_user_id) {
          try {
            await supabase.functions.invoke('send-notification', {
              body: {
                userId: doc.employee_user_id,
                type: 'document_expiring',
                title,
                message,
                link: '/app/documents',
              }
            });

            await supabase.from('document_expiry_notifications').insert({
              document_id: doc.document_id,
              company_id: doc.company_id,
              employee_id: doc.employee_id,
              notification_type: notificationType,
              days_until_expiry: doc.days_until_expiry,
              sent_to: doc.employee_user_id,
            });

            results.notificationsSent++;
            console.log(`Notified employee ${doc.employee_email} about ${doc.document_title}`);
          } catch (err) {
            console.error(`Failed to notify employee:`, err);
            results.errors++;
          }
        }

        // Also notify manager for urgent documents (7 days or less)
        if (doc.manager_user_id && doc.days_until_expiry <= 7) {
          try {
            await supabase.functions.invoke('send-notification', {
              body: {
                userId: doc.manager_user_id,
                type: 'document_expiring',
                title: `Team member document expiring: ${doc.employee_name}`,
                message: `${doc.document_type_name} for ${doc.employee_name} expires in ${doc.days_until_expiry} day${doc.days_until_expiry === 1 ? '' : 's'}.`,
                link: '/app/documents',
              }
            });

            await supabase.from('document_expiry_notifications').insert({
              document_id: doc.document_id,
              company_id: doc.company_id,
              employee_id: doc.employee_id,
              notification_type: `manager_${notificationType}`,
              days_until_expiry: doc.days_until_expiry,
              sent_to: doc.manager_user_id,
            });

            results.notificationsSent++;
            console.log(`Notified manager about ${doc.employee_name}'s ${doc.document_title}`);
          } catch (err) {
            console.error(`Failed to notify manager:`, err);
            results.errors++;
          }
        }

        // Notify HR for critical documents (3 days or less)
        if (doc.days_until_expiry <= 3) {
          const { data: hrUsers } = await supabase
            .from('company_users')
            .select('user_id')
            .eq('company_id', doc.company_id)
            .eq('is_active', true)
            .in('role', ['company_admin', 'hr_manager']);

          for (const hr of hrUsers || []) {
            // Skip if already notified as manager
            if (hr.user_id === doc.manager_user_id) continue;

            try {
              await supabase.functions.invoke('send-notification', {
                body: {
                  userId: hr.user_id,
                  type: 'document_expiring_hr',
                  title: `⚠️ Urgent: Employee document expiring`,
                  message: `${doc.document_type_name} for ${doc.employee_name} expires in ${doc.days_until_expiry} day${doc.days_until_expiry === 1 ? '' : 's'}. Please ensure compliance.`,
                  link: '/app/documents',
                }
              });

              results.notificationsSent++;
            } catch (err) {
              console.error(`Failed to notify HR:`, err);
              results.errors++;
            }
          }
        }
      }
    }

    // 3. Update document verification status for expired docs
    const { data: expiredDocs } = await supabase.rpc('get_expired_documents');
    
    if (expiredDocs?.length) {
      console.log(`Found ${expiredDocs.length} expired documents to mark`);
      
      // Update status if not already done
      for (const doc of expiredDocs as { document_id: string; company_id: string }[]) {
        await supabase
          .from('employee_documents')
          .update({ 
            verification_status: 'expired',
            updated_at: new Date().toISOString()
          })
          .eq('id', doc.document_id)
          .neq('verification_status', 'expired');
      }
    }

    console.log(`Document expiry cron completed:`, results);

    return new Response(
      JSON.stringify({ success: true, ...results }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in cron-document-expiry:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
