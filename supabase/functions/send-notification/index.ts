import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { EmailService } from "../_shared/email/index.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type NotificationType = 
  | "leave_request_submitted"
  | "leave_request_approved"
  | "leave_request_rejected"
  | "payroll_processed";

interface NotificationPayload {
  type: NotificationType;
  record_id: string;
  company_id: string;
  old_status?: string;
  new_status?: string;
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const emailService = new EmailService();

    const payload: NotificationPayload = await req.json();
    console.log("Notification payload:", JSON.stringify(payload));

    const { type, record_id, company_id } = payload;

    // Get company details
    const { data: company } = await supabase
      .from("companies")
      .select("name, email")
      .eq("id", company_id)
      .single();

    if (!company) {
      console.error("Company not found:", company_id);
      return new Response(
        JSON.stringify({ error: "Company not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    switch (type) {
      case "leave_request_submitted": {
        // Get leave request with employee and manager details
        const { data: leaveRequest } = await supabase
          .from("leave_requests")
          .select(`
            id,
            start_date,
            end_date,
            reason,
            employee:employees!leave_requests_employee_id_fkey (
              id,
              first_name,
              last_name,
              email,
              manager:employees!employees_manager_id_fkey (
                id,
                first_name,
                last_name,
                email,
                user_id
              )
            ),
            leave_type:leave_types!leave_requests_leave_type_id_fkey (
              name
            )
          `)
          .eq("id", record_id)
          .single();

        if (!leaveRequest || !leaveRequest.employee) {
          console.error("Leave request or employee not found");
          return new Response(
            JSON.stringify({ error: "Leave request not found" }),
            { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const employee = leaveRequest.employee as any;
        const manager = employee.manager as any;
        const leaveType = leaveRequest.leave_type as any;

        // Send notification to manager if exists
        if (manager?.email) {
          await emailService.send({
            template: "leave_request_submitted",
            data: {
              employeeName: `${employee.first_name} ${employee.last_name}`,
              leaveType: leaveType?.name || "Leave",
              startDate: leaveRequest.start_date,
              endDate: leaveRequest.end_date,
              managerName: manager.first_name || "Manager",
            },
            to: { email: manager.email, name: `${manager.first_name} ${manager.last_name}` },
            tags: { company_id, leave_request_id: record_id },
          });
          console.log(`Leave request notification sent to manager: ${manager.email}`);
        } else {
          console.log("No manager found for employee, skipping notification");
        }
        break;
      }

      case "leave_request_approved": {
        const { data: leaveRequest } = await supabase
          .from("leave_requests")
          .select(`
            id,
            start_date,
            end_date,
            employee:employees!leave_requests_employee_id_fkey (
              id,
              first_name,
              last_name,
              email
            ),
            leave_type:leave_types!leave_requests_leave_type_id_fkey (
              name
            )
          `)
          .eq("id", record_id)
          .single();

        if (!leaveRequest || !leaveRequest.employee) {
          console.error("Leave request or employee not found");
          return new Response(
            JSON.stringify({ error: "Leave request not found" }),
            { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const employee = leaveRequest.employee as any;
        const leaveType = leaveRequest.leave_type as any;

        await emailService.send({
          template: "leave_request_approved",
          data: {
            employeeName: employee.first_name,
            leaveType: leaveType?.name || "Leave",
            startDate: leaveRequest.start_date,
            endDate: leaveRequest.end_date,
          },
          to: { email: employee.email, name: `${employee.first_name} ${employee.last_name}` },
          tags: { company_id, leave_request_id: record_id },
        });
        console.log(`Leave approved notification sent to: ${employee.email}`);
        break;
      }

      case "leave_request_rejected": {
        const { data: leaveRequest } = await supabase
          .from("leave_requests")
          .select(`
            id,
            review_notes,
            employee:employees!leave_requests_employee_id_fkey (
              id,
              first_name,
              last_name,
              email
            ),
            leave_type:leave_types!leave_requests_leave_type_id_fkey (
              name
            )
          `)
          .eq("id", record_id)
          .single();

        if (!leaveRequest || !leaveRequest.employee) {
          console.error("Leave request or employee not found");
          return new Response(
            JSON.stringify({ error: "Leave request not found" }),
            { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const employee = leaveRequest.employee as any;
        const leaveType = leaveRequest.leave_type as any;

        await emailService.send({
          template: "leave_request_rejected",
          data: {
            employeeName: employee.first_name,
            leaveType: leaveType?.name || "Leave",
            reason: leaveRequest.review_notes || "No reason provided",
          },
          to: { email: employee.email, name: `${employee.first_name} ${employee.last_name}` },
          tags: { company_id, leave_request_id: record_id },
        });
        console.log(`Leave rejected notification sent to: ${employee.email}`);
        break;
      }

      case "payroll_processed": {
        const { data: payrollRun } = await supabase
          .from("payroll_runs")
          .select("id, period_start, period_end, name")
          .eq("id", record_id)
          .single();

        if (!payrollRun) {
          console.error("Payroll run not found");
          return new Response(
            JSON.stringify({ error: "Payroll run not found" }),
            { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Get all payroll entries for this run
        const { data: entries } = await supabase
          .from("payroll_entries")
          .select(`
            id,
            net_pay,
            employee:employees!payroll_entries_employee_id_fkey (
              id,
              first_name,
              last_name,
              email,
              salary_currency
            )
          `)
          .eq("payroll_run_id", record_id);

        if (!entries || entries.length === 0) {
          console.log("No payroll entries found for this run");
          return new Response(
            JSON.stringify({ success: true, message: "No entries to notify" }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Send notification to each employee
        const emailPromises = entries.map(async (entry: any) => {
          const employee = entry.employee as any;
          if (!employee?.email) return null;

          const currency = employee.salary_currency || "USD";
          const netPay = new Intl.NumberFormat("en-US", {
            style: "currency",
            currency,
          }).format(entry.net_pay);

          return emailService.send({
            template: "payroll_processed",
            data: {
              employeeName: employee.first_name,
              periodStart: payrollRun.period_start,
              periodEnd: payrollRun.period_end,
              netPay,
            },
            to: { email: employee.email, name: `${employee.first_name} ${employee.last_name}` },
            tags: { company_id, payroll_run_id: record_id, payroll_entry_id: entry.id },
          });
        });

        const results = await Promise.allSettled(emailPromises.filter(Boolean));
        const successful = results.filter(r => r.status === "fulfilled").length;
        console.log(`Payroll notifications sent: ${successful}/${entries.length}`);
        break;
      }

      default:
        console.warn("Unknown notification type:", type);
        return new Response(
          JSON.stringify({ error: "Unknown notification type" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    return new Response(
      JSON.stringify({ success: true, message: "Notification sent" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Notification error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    
    // Log application error
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      if (supabaseUrl && supabaseServiceKey) {
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        await supabase.from("application_logs").insert({
          service: "send-notification",
          level: "error",
          message: `Notification failed: ${errorMessage}`,
          context: { error: errorMessage },
        });
      }
    } catch (logError) {
      console.error("Failed to log error:", logError);
    }

    return new Response(
      JSON.stringify({ error: "Internal Server Error", message: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
