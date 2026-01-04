import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";
import { EmailService } from "../_shared/email/email-service.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CreateEmployeeUserRequest {
  employee_id: string;
  company_id: string;
  role: 'company_admin' | 'hr_manager' | 'manager' | 'employee';
}

// Generate a secure temporary password
function generateTemporaryPassword(): string {
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const numbers = '0123456789';
  const symbols = '!@#$%^&*';
  const all = lowercase + uppercase + numbers + symbols;

  let password = '';
  // Ensure at least one of each type
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += symbols[Math.floor(Math.random() * symbols.length)];

  // Fill the rest with random characters (total 16 chars)
  for (let i = 0; i < 12; i++) {
    password += all[Math.floor(Math.random() * all.length)];
  }

  // Shuffle the password
  return password.split('').sort(() => Math.random() - 0.5).join('');
}

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_REGEX.test(value);
}

function getUserIdFromAuthHeader(authHeader: string): string | null {
  try {
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    const parts = token.split('.');
    if (parts.length < 2) return null;

    const payloadB64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = payloadB64 + '='.repeat((4 - (payloadB64.length % 4)) % 4);
    const payload = JSON.parse(atob(padded));

    return isUuid(payload?.sub) ? payload.sub : null;
  } catch {
    return null;
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get authorization header
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, message: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create supabase clients
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Client for checking permissions (as the requesting user)
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Admin client for creating users
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Get the authenticated user
    const { data: { user: authUser }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !authUser) {
      console.error('Auth error:', authError);
      return new Response(
        JSON.stringify({ success: false, message: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Sometimes we've seen non-UUID identifiers here depending on auth setup.
    // Always derive a UUID for DB writes from the JWT `sub` claim.
    const requesterUserId = isUuid(authUser.id) ? authUser.id : getUserIdFromAuthHeader(authHeader);
    if (!requesterUserId) {
      return new Response(
        JSON.stringify({ success: false, message: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const body: CreateEmployeeUserRequest = await req.json();
    const { employee_id, company_id, role } = body;

    if (!employee_id || !company_id || !role) {
      return new Response(
        JSON.stringify({ success: false, message: 'Missing required fields: employee_id, company_id, role' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Creating user account for employee ${employee_id} in company ${company_id}`);

    // Check if requesting user has admin permissions in this company
    const { data: isAdmin, error: permError } = await supabaseUser.rpc('is_active_company_admin', {
      _user_id: requesterUserId,
      _company_id: company_id,
    });

    if (permError || !isAdmin) {
      console.error('Permission check failed:', permError);
      return new Response(
        JSON.stringify({ success: false, message: 'You do not have permission to create user accounts' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get employee details
    const { data: employee, error: empError } = await supabaseAdmin
      .from('employees')
      .select('id, email, first_name, last_name, employee_number, user_id, company_id')
      .eq('id', employee_id)
      .eq('company_id', company_id)
      .single();

    if (empError || !employee) {
      console.error('Employee not found:', empError);
      return new Response(
        JSON.stringify({ success: false, message: 'Employee not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if employee already has a user account
    if (employee.user_id) {
      return new Response(
        JSON.stringify({ success: false, message: 'Employee already has a user account' }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const employeeEmail = (employee.email ?? '').toString().trim().toLowerCase();
    if (!employeeEmail) {
      return new Response(
        JSON.stringify({ success: false, message: 'Employee does not have an email address set. Please add an email and try again.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get company details
    const { data: company, error: compError } = await supabaseAdmin
      .from('companies')
      .select('id, name, slug, is_active')
      .eq('id', company_id)
      .single();

    if (compError || !company) {
      console.error('Company not found:', compError);
      return new Response(
        JSON.stringify({ success: false, message: 'Company not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!company.is_active) {
      return new Response(
        JSON.stringify({ success: false, message: 'Company is not active' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate temporary password
    const temporaryPassword = generateTemporaryPassword();

    // Determine login type based on role
    const loginType = (role === 'company_admin' || role === 'hr_manager') ? 'email' : 'employee_id';

    // Create auth user
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: employeeEmail,
      password: temporaryPassword,
      email_confirm: true, // Auto-confirm the email
      user_metadata: {
        first_name: employee.first_name,
        last_name: employee.last_name,
        force_password_change: true,
        login_type: loginType,
      },
    });

    if (createError || !newUser.user) {
      console.error('Failed to create auth user:', createError);
      const rawMessage = createError?.message || 'Failed to create user account';
      const message = rawMessage.toLowerCase().includes('already')
        ? 'A user with this email already exists. If they belong to this company, add/reactivate them from Users. Otherwise, use a different email.'
        : rawMessage;

      return new Response(
        JSON.stringify({ success: false, message }),
        { status: rawMessage.toLowerCase().includes('already') ? 409 : 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Created auth user ${newUser.user.id} for employee ${employee_id}`);

    // Update profiles table with force_password_change and login_type
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({
        force_password_change: true,
        login_type: loginType,
        first_name: employee.first_name,
        last_name: employee.last_name,
      })
      .eq('id', newUser.user.id);

    if (profileError) {
      console.error('Failed to update profile:', profileError);
      // Don't fail the whole operation, profile might be created by trigger
    }

    // Update employee with user_id
    const { error: updateEmpError } = await supabaseAdmin
      .from('employees')
      .update({ user_id: newUser.user.id })
      .eq('id', employee_id);

    if (updateEmpError) {
      console.error('Failed to update employee:', updateEmpError);
      // Rollback: delete the created user
      await supabaseAdmin.auth.admin.deleteUser(newUser.user.id);
      return new Response(
        JSON.stringify({ success: false, message: 'Failed to link user to employee' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Add user to company_users table
    const invitedByUserId = requesterUserId;

    const { error: companyUserError } = await supabaseAdmin
      .from('company_users')
      .insert({
        company_id: company_id,
        user_id: newUser.user.id,
        role: role,
        is_primary: true,
        is_active: true,
        invited_by: invitedByUserId,
        invited_at: new Date().toISOString(),
        joined_at: new Date().toISOString(),
      });

    if (companyUserError) {
      console.error('Failed to add company user:', companyUserError);
      // Rollback
      await supabaseAdmin.from('employees').update({ user_id: null }).eq('id', employee_id);
      await supabaseAdmin.auth.admin.deleteUser(newUser.user.id);
      return new Response(
        JSON.stringify({ success: false, message: companyUserError.message || 'Failed to add user to company' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Log audit event
    await supabaseAdmin.from('audit_logs').insert({
      company_id: company_id,
      user_id: requesterUserId,
      action: 'create',
      table_name: 'company_users',
      record_id: newUser.user.id,
      new_values: {
        event: 'employee_user_created',
        employee_id: employee_id,
        role: role,
        login_type: loginType,
      },
    });

    // Send email with credentials
    let emailSent = false;
    let emailError: string | undefined;
    
    try {
      const emailService = new EmailService();
      const appUrl = Deno.env.get('APP_URL') || 'https://preview--hrraise.lovable.app';

      const emailResult = await emailService.send({
        template: 'employee_account_created',
        to: [{ email: employee.email, name: `${employee.first_name} ${employee.last_name}` }],
        data: {
          employeeName: employee.first_name || 'Employee',
          companyName: company.name,
          employeeNumber: employee.employee_number,
          companySlug: company.slug,
          temporaryPassword: temporaryPassword,
          loginUrl: `${appUrl}/auth`,
          loginType: loginType as 'email' | 'employee_id',
        },
        context: {
          companyId: company_id,
          triggeredBy: requesterUserId,
          triggeredFrom: 'create-employee-user',
          metadata: {
            employee_id: employee_id,
            employee_email: employee.email,
            role: role,
          },
        },
      });

      emailSent = emailResult.success;
      if (!emailResult.success) {
        emailError = emailResult.error;
        console.error('Email sending failed:', emailResult.error);
      } else {
        console.log(`Credentials email sent to ${employee.email}`);
      }
    } catch (err) {
      emailError = err instanceof Error ? err.message : 'Unknown email error';
      console.error('Failed to send credentials email:', err);
    }

    // Return success with email status
    // If email failed, include the temporary password so admin can share it manually
    return new Response(
      JSON.stringify({
        success: true,
        message: emailSent 
          ? 'User account created successfully. Login credentials have been sent to the employee\'s email.'
          : 'User account created successfully. Email notification failed - please share credentials manually.',
        user_id: newUser.user.id,
        login_type: loginType,
        email_sent: emailSent,
        email_error: emailError,
        // Only include temporary password if email failed (so admin can share it)
        temporary_password: emailSent ? undefined : temporaryPassword,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in create-employee-user:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
    return new Response(
      JSON.stringify({ success: false, message: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
