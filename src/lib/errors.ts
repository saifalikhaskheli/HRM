/**
 * API Error class for handling Supabase and network errors
 */
export class ApiError extends Error {
  public readonly code: string;
  public readonly status?: number;
  public readonly details?: unknown;

  constructor(message: string, code: string, status?: number, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.details = details;
  }

  static fromSupabaseError(error: { message: string; code?: string; details?: string; hint?: string }): ApiError {
    const code = error.code || 'UNKNOWN';
    const message = getHumanReadableMessage(code, error.message);
    return new ApiError(message, code, undefined, { hint: error.hint, details: error.details });
  }

  static fromNetworkError(error: Error): ApiError {
    return new ApiError(
      'Unable to connect to the server. Please check your internet connection.',
      'NETWORK_ERROR'
    );
  }
}

/**
 * Convert Supabase error codes to human-readable messages
 */
function getHumanReadableMessage(code: string, fallback: string): string {
  const messages: Record<string, string> = {
    // Auth errors
    'invalid_credentials': 'Invalid email or password.',
    'email_not_confirmed': 'Please verify your email address before signing in.',
    'user_not_found': 'No account found with this email.',
    'email_exists': 'An account with this email already exists.',
    'weak_password': 'Password is too weak. Please use at least 8 characters.',
    'over_request_rate_limit': 'Too many requests. Please wait a moment and try again.',
    
    // RLS / Permission errors
    'PGRST301': 'You do not have permission to perform this action.',
    'PGRST204': 'The requested resource was not found.',
    '42501': 'You do not have permission to perform this action.',
    '23505': 'A record with this information already exists.',
    '23503': 'This action cannot be completed because it references data that no longer exists.',
    '23514': 'The provided data does not meet the required constraints.',
    
    // Company/Tenant errors
    'company_frozen': 'Your company account is frozen. Please contact billing.',
    'no_company': 'No company selected. Please select a company.',
    'not_member': 'You are not a member of this company.',
    
    // Module errors
    'module_not_available': 'This feature is not available on your current plan.',
    'employee_limit_reached': 'You have reached the employee limit for your plan.',
    
    // Generic
    'NETWORK_ERROR': 'Unable to connect to the server. Please check your internet connection.',
    'UNKNOWN': 'An unexpected error occurred. Please try again.',
  };

  return messages[code] || fallback || messages['UNKNOWN'];
}

/**
 * Handle and transform errors for user display
 */
export function handleApiError(error: unknown): ApiError {
  if (error instanceof ApiError) {
    return error;
  }

  if (error instanceof Error) {
    // Network errors
    if (error.message.includes('fetch') || error.message.includes('network')) {
      return ApiError.fromNetworkError(error);
    }

    // Supabase errors typically have these properties
    const supabaseError = error as { code?: string; details?: string; hint?: string; message: string };
    if (supabaseError.code) {
      return ApiError.fromSupabaseError(supabaseError);
    }

    return new ApiError(error.message, 'UNKNOWN');
  }

  if (typeof error === 'string') {
    return new ApiError(error, 'UNKNOWN');
  }

  return new ApiError('An unexpected error occurred', 'UNKNOWN');
}

/**
 * Format error for toast display
 */
export function getErrorMessage(error: unknown): string {
  const apiError = handleApiError(error);
  return apiError.message;
}

/**
 * Check if error is a permission denied error
 */
export function isPermissionError(error: unknown): boolean {
  const apiError = handleApiError(error);
  return ['42501', 'PGRST301', 'not_member'].includes(apiError.code);
}

/**
 * Check if error is a not found error
 */
export function isNotFoundError(error: unknown): boolean {
  const apiError = handleApiError(error);
  return apiError.code === 'PGRST204' || apiError.status === 404;
}

/**
 * Check if error is a validation error
 */
export function isValidationError(error: unknown): boolean {
  const apiError = handleApiError(error);
  return ['23505', '23503', '23514'].includes(apiError.code);
}

/**
 * Check if error is a rate limit error
 */
export function isRateLimitError(error: unknown): boolean {
  const apiError = handleApiError(error);
  return apiError.code === 'over_request_rate_limit' || apiError.status === 429;
}
