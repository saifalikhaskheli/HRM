import { supabase } from '@/integrations/supabase/client';

export interface CreateCompanyParams {
  name: string;
  slug?: string;
  industry?: string;
  size_range?: string;
}

export interface InviteUserParams {
  company_id: string;
  email: string;
  role: 'company_admin' | 'hr_manager' | 'manager' | 'employee';
  first_name?: string;
  last_name?: string;
}

export interface AssignPlanParams {
  company_id: string;
  plan_id: string;
  billing_interval?: 'monthly' | 'yearly';
  stripe_customer_id?: string;
  stripe_subscription_id?: string;
}

export interface FreezeCompanyParams {
  company_id: string;
  action: 'freeze' | 'unfreeze';
  reason?: string;
}

export interface CreateSuperAdminParams {
  company_id: string;
  email: string;
  password: string;
  first_name?: string;
  last_name?: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

async function callEdgeFunction<T>(
  functionName: string,
  body: object
): Promise<ApiResponse<T>> {
  try {
    const { data, error } = await supabase.functions.invoke(functionName, {
      body,
    });

    if (error) {
      console.error(`Error calling ${functionName}:`, error);
      return {
        success: false,
        error: error.message || 'Unknown error',
      };
    }

    if (data.error) {
      return {
        success: false,
        error: data.message || data.error,
      };
    }

    return {
      success: true,
      data,
      message: data.message,
    };
  } catch (err) {
    console.error(`Exception calling ${functionName}:`, err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

export async function createCompany(params: CreateCompanyParams): Promise<ApiResponse<{ company: { id: string; name: string; slug: string } }>> {
  return callEdgeFunction('create-company', params);
}

export async function inviteUser(params: InviteUserParams): Promise<ApiResponse<{ user_added?: boolean; invitation_id?: string }>> {
  return callEdgeFunction('invite-user', params);
}

export async function assignPlan(params: AssignPlanParams): Promise<ApiResponse<{ subscription: { plan_id: string; plan_name: string; status: string } }>> {
  return callEdgeFunction('assign-plan', params);
}

export async function freezeCompany(params: FreezeCompanyParams): Promise<ApiResponse<{ company: { id: string; name: string; is_active: boolean } }>> {
  return callEdgeFunction('freeze-company', params);
}

export async function createSuperAdmin(params: CreateSuperAdminParams): Promise<ApiResponse<{ user_id: string; is_new_user: boolean }>> {
  return callEdgeFunction('create-super-admin', params);
}
