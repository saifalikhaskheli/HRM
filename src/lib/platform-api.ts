import { supabase } from '@/integrations/supabase/client';

export interface CreatePlatformAdminParams {
  email: string;
  password: string;
  first_name?: string;
  last_name?: string;
  role?: 'owner' | 'admin' | 'support';
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

export async function createPlatformAdmin(
  params: CreatePlatformAdminParams
): Promise<ApiResponse<{ user_id: string; role: string; is_new_user: boolean }>> {
  return callEdgeFunction('create-platform-admin', params);
}

export async function checkPlatformAdminExists(): Promise<ApiResponse<{ has_admins: boolean }>> {
  return callEdgeFunction('check-platform-admin', {});
}
