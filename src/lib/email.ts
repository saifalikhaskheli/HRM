import { supabase } from '@/integrations/supabase/client';

// Email template types - must match backend
export type EmailTemplateType = 
  | 'user_invitation'
  | 'welcome'
  | 'password_reset'
  | 'leave_request_submitted'
  | 'leave_request_approved'
  | 'leave_request_rejected'
  | 'payroll_processed'
  | 'subscription_expiring'
  | 'company_frozen';

export interface EmailRecipient {
  email: string;
  name?: string;
}

export interface SendTemplateEmailParams<T extends EmailTemplateType> {
  template: T;
  data: Record<string, string>;
  to: EmailRecipient | EmailRecipient[];
  cc?: EmailRecipient[];
  bcc?: EmailRecipient[];
  tags?: Record<string, string>;
}

export interface SendRawEmailParams {
  to: EmailRecipient | EmailRecipient[];
  subject: string;
  html: string;
  text?: string;
  cc?: EmailRecipient[];
  bcc?: EmailRecipient[];
  tags?: Record<string, string>;
}

export interface EmailSendResponse {
  success: boolean;
  messageId?: string;
  provider?: string;
  error?: string;
}

/**
 * Send an email using a predefined template.
 * 
 * @example
 * ```typescript
 * await sendTemplateEmail({
 *   template: 'user_invitation',
 *   data: {
 *     inviterName: 'John Doe',
 *     companyName: 'Acme Inc',
 *     inviteUrl: 'https://app.example.com/invite/abc123',
 *     role: 'Employee',
 *   },
 *   to: { email: 'jane@example.com', name: 'Jane Doe' },
 * });
 * ```
 */
export async function sendTemplateEmail<T extends EmailTemplateType>(
  params: SendTemplateEmailParams<T>
): Promise<EmailSendResponse> {
  try {
    const { data, error } = await supabase.functions.invoke('send-email', {
      body: {
        template: params.template,
        data: params.data,
        to: params.to,
        cc: params.cc,
        bcc: params.bcc,
        tags: params.tags,
      },
    });

    if (error) {
      console.error('Email send error:', error);
      return {
        success: false,
        error: error.message || 'Failed to send email',
      };
    }

    return {
      success: data.success,
      messageId: data.messageId,
      provider: data.provider,
      error: data.error,
    };
  } catch (err) {
    console.error('Email send exception:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

/**
 * Send a raw email without using a template.
 * 
 * @example
 * ```typescript
 * await sendRawEmail({
 *   to: { email: 'user@example.com' },
 *   subject: 'Hello!',
 *   html: '<h1>Welcome</h1><p>Hello World</p>',
 * });
 * ```
 */
export async function sendRawEmail(params: SendRawEmailParams): Promise<EmailSendResponse> {
  try {
    const { data, error } = await supabase.functions.invoke('send-email', {
      body: {
        to: params.to,
        subject: params.subject,
        html: params.html,
        text: params.text,
        cc: params.cc,
        bcc: params.bcc,
        tags: params.tags,
      },
    });

    if (error) {
      console.error('Email send error:', error);
      return {
        success: false,
        error: error.message || 'Failed to send email',
      };
    }

    return {
      success: data.success,
      messageId: data.messageId,
      provider: data.provider,
      error: data.error,
    };
  } catch (err) {
    console.error('Email send exception:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}
