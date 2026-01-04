import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PayslipRequest {
  payroll_entry_id: string;
}

serve(async (req: Request) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get auth header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    // Verify user
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      throw new Error("Unauthorized");
    }

    const { payroll_entry_id }: PayslipRequest = await req.json();
    console.log("Generating payslip for entry:", payroll_entry_id);

    // Fetch payroll entry with employee and company details
    const { data: entry, error: entryError } = await supabase
      .from("payroll_entries")
      .select(`
        *,
        employee:employees(
          id, first_name, last_name, employee_number, email, job_title, 
          hire_date, department_id, salary, salary_currency,
          department:departments!employees_department_id_fkey(name)
        ),
        payroll_run:payroll_runs(
          id, name, period_start, period_end, pay_date, currency, status,
          company:companies(
            id, name, email, phone, logo_url,
            pf_enabled, pf_employee_rate, pf_employer_rate
          )
        )
      `)
      .eq("id", payroll_entry_id)
      .single();

    if (entryError || !entry) {
      console.error("Error fetching entry:", entryError);
      throw new Error("Payroll entry not found");
    }

    // Verify user has access to this company
    const { data: companyAccess } = await supabase
      .from("company_users")
      .select("id")
      .eq("user_id", user.id)
      .eq("company_id", entry.company_id)
      .eq("is_active", true)
      .single();

    if (!companyAccess) {
      throw new Error("Unauthorized: No access to this company");
    }

    const employee = entry.employee;
    const run = entry.payroll_run;
    const company = run?.company;

    // Build payslip HTML
    const payslipHtml = generatePayslipHtml({
      company: {
        name: company?.name || "Company",
        email: company?.email || "",
        phone: company?.phone || "",
        logoUrl: company?.logo_url || "",
      },
      employee: {
        name: `${employee?.first_name || ""} ${employee?.last_name || ""}`.trim(),
        employeeNumber: employee?.employee_number || "",
        email: employee?.email || "",
        jobTitle: employee?.job_title || "",
        department: employee?.department?.name || "",
        hireDate: employee?.hire_date || "",
      },
      payrollRun: {
        name: run?.name || "",
        periodStart: run?.period_start || "",
        periodEnd: run?.period_end || "",
        payDate: run?.pay_date || "",
        currency: run?.currency || entry.currency || "USD",
      },
      earnings: {
        baseSalary: Number(entry.base_salary || 0),
        overtimePay: Number(entry.overtime_pay || 0),
        bonuses: Number(entry.bonuses || 0),
        commissions: Number(entry.commissions || 0),
        allowances: entry.allowances || {},
        grossPay: Number(entry.gross_pay || 0),
      },
      deductions: {
        tax: Number(entry.tax_deductions || 0),
        pf: Number(entry.pf_deduction || 0),
        benefits: Number(entry.benefits_deductions || 0),
        other: entry.other_deductions || {},
        totalDeductions: Number(entry.total_deductions || 0),
      },
      attendance: {
        daysPresent: entry.days_present || 0,
        daysAbsent: entry.days_absent || 0,
        daysLate: entry.days_late || 0,
        halfDays: entry.half_days || 0,
        hoursWorked: entry.hours_worked || 0,
        overtimeHours: entry.overtime_hours || 0,
        totalLateMinutes: entry.total_late_minutes || 0,
      },
      netPay: Number(entry.net_pay || 0),
      notes: entry.notes || "",
    });

    console.log("Payslip HTML generated successfully");

    return new Response(
      JSON.stringify({
        success: true,
        html: payslipHtml,
        filename: `payslip_${employee?.employee_number}_${run?.period_start}_${run?.period_end}.html`,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error("Error generating payslip:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

interface PayslipData {
  company: {
    name: string;
    email: string;
    phone: string;
    logoUrl: string;
  };
  employee: {
    name: string;
    employeeNumber: string;
    email: string;
    jobTitle: string;
    department: string;
    hireDate: string;
  };
  payrollRun: {
    name: string;
    periodStart: string;
    periodEnd: string;
    payDate: string;
    currency: string;
  };
  earnings: {
    baseSalary: number;
    overtimePay: number;
    bonuses: number;
    commissions: number;
    allowances: Record<string, number>;
    grossPay: number;
  };
  deductions: {
    tax: number;
    pf: number;
    benefits: number;
    other: Record<string, number>;
    totalDeductions: number;
  };
  attendance: {
    daysPresent: number;
    daysAbsent: number;
    daysLate: number;
    halfDays: number;
    hoursWorked: number;
    overtimeHours: number;
    totalLateMinutes: number;
  };
  netPay: number;
  notes: string;
}

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function generatePayslipHtml(data: PayslipData): string {
  const { company, employee, payrollRun, earnings, deductions, attendance, netPay, notes } = data;
  const currency = payrollRun.currency;

  const allowanceRows = Object.entries(earnings.allowances || {})
    .filter(([_, value]) => value > 0)
    .map(([name, value]) => `
      <tr>
        <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${name}</td>
        <td style="padding: 8px 0; border-bottom: 1px solid #eee; text-align: right;">${formatCurrency(value as number, currency)}</td>
      </tr>
    `).join("");

  const otherDeductionRows = Object.entries(deductions.other || {})
    .filter(([_, value]) => value > 0)
    .map(([name, value]) => `
      <tr>
        <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${name}</td>
        <td style="padding: 8px 0; border-bottom: 1px solid #eee; text-align: right;">${formatCurrency(value as number, currency)}</td>
      </tr>
    `).join("");

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Payslip - ${employee.name} - ${payrollRun.periodStart} to ${payrollRun.periodEnd}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #f5f5f5; padding: 20px; }
    .payslip { max-width: 800px; margin: 0 auto; background: white; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #1e3a5f 0%, #2d5a87 100%); color: white; padding: 30px; display: flex; justify-content: space-between; align-items: center; }
    .company-name { font-size: 24px; font-weight: bold; }
    .company-contact { font-size: 12px; opacity: 0.9; margin-top: 5px; }
    .payslip-title { font-size: 20px; font-weight: 600; }
    .section { padding: 20px 30px; }
    .section-title { font-size: 14px; font-weight: 600; color: #666; text-transform: uppercase; margin-bottom: 15px; border-bottom: 2px solid #eee; padding-bottom: 8px; }
    .info-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; }
    .info-item { display: flex; flex-direction: column; }
    .info-label { font-size: 12px; color: #888; margin-bottom: 2px; }
    .info-value { font-size: 14px; font-weight: 500; }
    .earnings-deductions { display: grid; grid-template-columns: repeat(2, 1fr); gap: 30px; }
    .table { width: 100%; border-collapse: collapse; }
    .table th { text-align: left; padding: 10px 0; border-bottom: 2px solid #333; font-weight: 600; }
    .table td { padding: 8px 0; border-bottom: 1px solid #eee; }
    .total-row { font-weight: bold; background: #f9f9f9; }
    .total-row td { padding: 12px 0; border-bottom: none; }
    .net-pay { background: linear-gradient(135deg, #1e3a5f 0%, #2d5a87 100%); color: white; padding: 25px 30px; display: flex; justify-content: space-between; align-items: center; }
    .net-pay-label { font-size: 18px; }
    .net-pay-value { font-size: 28px; font-weight: bold; }
    .footer { padding: 20px 30px; background: #f9f9f9; font-size: 12px; color: #888; text-align: center; }
    .attendance-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin-top: 15px; }
    .attendance-item { background: #f5f5f5; padding: 15px; border-radius: 8px; text-align: center; }
    .attendance-value { font-size: 24px; font-weight: bold; color: #1e3a5f; }
    .attendance-label { font-size: 12px; color: #666; margin-top: 5px; }
    @media print {
      body { background: white; padding: 0; }
      .payslip { box-shadow: none; }
    }
  </style>
</head>
<body>
  <div class="payslip">
    <div class="header">
      <div>
        <div class="company-name">${company.name}</div>
        ${company.email || company.phone ? `<div class="company-contact">${[company.email, company.phone].filter(Boolean).join(" | ")}</div>` : ""}
      </div>
      <div class="payslip-title">PAYSLIP</div>
    </div>

    <div class="section">
      <div class="section-title">Employee Information</div>
      <div class="info-grid">
        <div class="info-item">
          <span class="info-label">Employee Name</span>
          <span class="info-value">${employee.name}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Employee ID</span>
          <span class="info-value">${employee.employeeNumber}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Position</span>
          <span class="info-value">${employee.jobTitle || "-"}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Department</span>
          <span class="info-value">${employee.department || "-"}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Joining Date</span>
          <span class="info-value">${formatDate(employee.hireDate)}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Email</span>
          <span class="info-value">${employee.email}</span>
        </div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">Pay Period</div>
      <div class="info-grid">
        <div class="info-item">
          <span class="info-label">Period</span>
          <span class="info-value">${formatDate(payrollRun.periodStart)} - ${formatDate(payrollRun.periodEnd)}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Pay Date</span>
          <span class="info-value">${formatDate(payrollRun.payDate)}</span>
        </div>
      </div>
    </div>

    ${attendance.daysPresent > 0 || attendance.daysAbsent > 0 || attendance.daysLate > 0 ? `
    <div class="section">
      <div class="section-title">Attendance Summary</div>
      <div class="attendance-grid">
        <div class="attendance-item">
          <div class="attendance-value">${attendance.daysPresent}</div>
          <div class="attendance-label">Days Present</div>
        </div>
        <div class="attendance-item">
          <div class="attendance-value">${attendance.daysAbsent}</div>
          <div class="attendance-label">Days Absent</div>
        </div>
        <div class="attendance-item">
          <div class="attendance-value">${attendance.daysLate}</div>
          <div class="attendance-label">Days Late</div>
        </div>
        <div class="attendance-item">
          <div class="attendance-value">${attendance.hoursWorked.toFixed(1)}</div>
          <div class="attendance-label">Hours Worked</div>
        </div>
      </div>
    </div>
    ` : ""}

    <div class="section">
      <div class="earnings-deductions">
        <div>
          <div class="section-title">Earnings</div>
          <table class="table">
            <thead>
              <tr>
                <th>Description</th>
                <th style="text-align: right;">Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee;">Base Salary</td>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee; text-align: right;">${formatCurrency(earnings.baseSalary, currency)}</td>
              </tr>
              ${earnings.overtimePay > 0 ? `
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee;">Overtime Pay</td>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee; text-align: right;">${formatCurrency(earnings.overtimePay, currency)}</td>
              </tr>
              ` : ""}
              ${earnings.bonuses > 0 ? `
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee;">Bonuses</td>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee; text-align: right;">${formatCurrency(earnings.bonuses, currency)}</td>
              </tr>
              ` : ""}
              ${earnings.commissions > 0 ? `
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee;">Commissions</td>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee; text-align: right;">${formatCurrency(earnings.commissions, currency)}</td>
              </tr>
              ` : ""}
              ${allowanceRows}
              <tr class="total-row">
                <td style="padding: 12px 0; font-weight: bold;">Gross Pay</td>
                <td style="padding: 12px 0; text-align: right; font-weight: bold;">${formatCurrency(earnings.grossPay, currency)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div>
          <div class="section-title">Deductions</div>
          <table class="table">
            <thead>
              <tr>
                <th>Description</th>
                <th style="text-align: right;">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${deductions.tax > 0 ? `
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee;">Income Tax</td>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee; text-align: right;">${formatCurrency(deductions.tax, currency)}</td>
              </tr>
              ` : ""}
              ${deductions.pf > 0 ? `
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee;">Provident Fund</td>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee; text-align: right;">${formatCurrency(deductions.pf, currency)}</td>
              </tr>
              ` : ""}
              ${deductions.benefits > 0 ? `
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee;">Benefits</td>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee; text-align: right;">${formatCurrency(deductions.benefits, currency)}</td>
              </tr>
              ` : ""}
              ${otherDeductionRows}
              <tr class="total-row">
                <td style="padding: 12px 0; font-weight: bold;">Total Deductions</td>
                <td style="padding: 12px 0; text-align: right; font-weight: bold;">${formatCurrency(deductions.totalDeductions, currency)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <div class="net-pay">
      <span class="net-pay-label">Net Pay</span>
      <span class="net-pay-value">${formatCurrency(netPay, currency)}</span>
    </div>

    ${notes ? `
    <div class="section">
      <div class="section-title">Notes</div>
      <p style="font-size: 14px; color: #666;">${notes}</p>
    </div>
    ` : ""}

    <div class="footer">
      <p>This is a computer-generated payslip and does not require a signature.</p>
      <p style="margin-top: 5px;">Generated on ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</p>
    </div>
  </div>
</body>
</html>
  `.trim();
}
