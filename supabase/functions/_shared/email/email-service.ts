import { 
  EmailTemplateType, 
  EmailTemplateData, 
  EmailRecipient, 
  EmailSendResult,
  EmailMessage,
  EmailAttachment,
} from './types.ts';
import { renderTemplate } from './templates.ts';
import { EmailProviderFactory } from './provider-factory.ts';
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";

export interface EmailContext {
  companyId?: string;
  triggeredBy?: string;
  triggeredFrom?: string;
  metadata?: Record<string, unknown>;
}

export interface SendEmailOptions<T extends EmailTemplateType> {
  template: T;
  data: EmailTemplateData[T];
  to: EmailRecipient | EmailRecipient[];
  cc?: EmailRecipient[];
  bcc?: EmailRecipient[];
  replyTo?: EmailRecipient;
  attachments?: EmailAttachment[];
  tags?: Record<string, string>;
  context?: EmailContext;
}

export interface SendRawEmailOptions {
  to: EmailRecipient | EmailRecipient[];
  subject: string;
  html: string;
  text?: string;
  cc?: EmailRecipient[];
  bcc?: EmailRecipient[];
  replyTo?: EmailRecipient;
  attachments?: EmailAttachment[];
  tags?: Record<string, string>;
  context?: EmailContext;
}

interface EmailLogEntry {
  id?: string;
  company_id?: string;
  template_type?: string;
  subject: string;
  recipient_email: string;
  recipient_name?: string;
  cc_emails?: string[];
  bcc_emails?: string[];
  status: 'pending' | 'sent' | 'failed';
  provider?: string;
  message_id?: string;
  error_message?: string;
  error_code?: string;
  triggered_by?: string;
  triggered_from?: string;
  metadata?: Record<string, unknown>;
  sent_at?: string;
}

import { CompanyEmailSettings } from './types.ts';

/**
 * EmailService - Provider-agnostic email orchestrator with audit logging
 * 
 * This service handles all email sending in the application.
 * It uses templates for consistent formatting, delegates
 * actual sending to the configured provider, and logs all
 * email attempts to the database for auditing.
 */
export class EmailService {
  private supabaseAdmin: ReturnType<typeof createClient> | null = null;

  private getAdminClient() {
    if (!this.supabaseAdmin) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL');
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
      
      if (supabaseUrl && supabaseServiceKey) {
        this.supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
      }
    }
    return this.supabaseAdmin;
  }

  /**
   * Fetch company email settings from database
   */
  private async getCompanyEmailSettings(companyId: string): Promise<CompanyEmailSettings | null> {
    const client = this.getAdminClient();
    if (!client) return null;

    try {
      const { data, error } = await client
        .from('company_email_settings')
        .select('*')
        .eq('company_id', companyId)
        .single();

      if (error || !data) {
        return null;
      }

      // Cast through unknown to handle database row type
      return data as unknown as CompanyEmailSettings;
    } catch {
      return null;
    }
  }

  private async createLogEntry(entry: EmailLogEntry): Promise<string | null> {
    const client = this.getAdminClient();
    if (!client) {
      console.warn('No Supabase client available for email logging');
      return null;
    }

    try {
      const { data, error } = await client
        .from('email_logs')
        .insert({
          company_id: entry.company_id,
          template_type: entry.template_type,
          subject: entry.subject,
          recipient_email: entry.recipient_email,
          recipient_name: entry.recipient_name,
          cc_emails: entry.cc_emails,
          bcc_emails: entry.bcc_emails,
          status: entry.status,
          provider: entry.provider,
          triggered_by: entry.triggered_by,
          triggered_from: entry.triggered_from,
          metadata: entry.metadata,
        })
        .select('id')
        .single();

      if (error) {
        console.error('Failed to create email log entry:', error);
        return null;
      }

      return data?.id as string || null;
    } catch (err) {
      console.error('Error creating email log entry:', err);
      return null;
    }
  }

  private async updateLogEntry(
    logId: string,
    updates: Partial<EmailLogEntry>
  ): Promise<void> {
    const client = this.getAdminClient();
    if (!client || !logId) return;

    try {
      const { error } = await client
        .from('email_logs')
        .update({
          status: updates.status,
          provider: updates.provider,
          message_id: updates.message_id,
          error_message: updates.error_message,
          error_code: updates.error_code,
          sent_at: updates.sent_at,
        })
        .eq('id', logId);

      if (error) {
        console.error('Failed to update email log entry:', error);
      }
    } catch (err) {
      console.error('Error updating email log entry:', err);
    }
  }

  /**
   * Send an email using a predefined template.
   */
  async send<T extends EmailTemplateType>(
    options: SendEmailOptions<T>
  ): Promise<EmailSendResult> {
    const { template, data, to, cc, bcc, replyTo, attachments, tags, context } = options;

    // Render the template
    const rendered = renderTemplate(template, data);

    // Normalize recipients
    const recipients = Array.isArray(to) ? to : [to];

    const message: EmailMessage = {
      to: recipients,
      cc,
      bcc,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      replyTo,
      attachments,
      tags: {
        ...tags,
        template: template,
      },
    };

    return this.sendMessage(message, template, context);
  }

  /**
   * Send a raw email without using a template.
   */
  async sendRaw(options: SendRawEmailOptions): Promise<EmailSendResult> {
    const { to, subject, html, text, cc, bcc, replyTo, attachments, tags, context } = options;

    // Normalize recipients
    const recipients = Array.isArray(to) ? to : [to];

    const message: EmailMessage = {
      to: recipients,
      cc,
      bcc,
      subject,
      html,
      text,
      replyTo,
      attachments,
      tags,
    };

    return this.sendMessage(message, undefined, context);
  }

  /**
   * Send multiple emails in parallel.
   */
  async sendBatch<T extends EmailTemplateType>(
    emails: SendEmailOptions<T>[]
  ): Promise<EmailSendResult[]> {
    return Promise.all(emails.map(email => this.send(email)));
  }

  /**
   * Internal method to send a message through the provider with logging.
   */
  private async sendMessage(
    message: EmailMessage,
    templateType?: string,
    context?: EmailContext
  ): Promise<EmailSendResult> {
    // Get provider - use company settings if available, otherwise platform default from database
    let provider;
    if (context?.companyId) {
      const companySettings = await this.getCompanyEmailSettings(context.companyId);
      provider = await EmailProviderFactory.getCompanyProviderAsync(companySettings);
    } else {
      provider = await EmailProviderFactory.getPlatformProviderFromDb();
    }
    
    const primaryRecipient = message.to[0];

    // Create log entry with 'pending' status
    const logId = await this.createLogEntry({
      company_id: context?.companyId,
      template_type: templateType,
      subject: message.subject,
      recipient_email: primaryRecipient.email,
      recipient_name: primaryRecipient.name,
      cc_emails: message.cc?.map(r => r.email),
      bcc_emails: message.bcc?.map(r => r.email),
      status: 'pending',
      provider: provider.name,
      triggered_by: context?.triggeredBy,
      triggered_from: context?.triggeredFrom,
      metadata: context?.metadata,
    });

    try {
      console.log(`Sending email via ${provider.name}:`, {
        to: message.to.map(r => r.email).join(', '),
        subject: message.subject,
        template: templateType,
      });

      const result = await provider.send(message);

      // Update log entry with result
      if (logId) {
        await this.updateLogEntry(logId, {
          status: result.success ? 'sent' : 'failed',
          provider: result.provider,
          message_id: result.messageId,
          error_message: result.error,
          sent_at: result.success ? new Date().toISOString() : undefined,
        });
      }

      if (result.success) {
        console.log(`Email sent successfully via ${provider.name}. Message ID: ${result.messageId}`);
      } else {
        console.error(`Email failed via ${provider.name}:`, result.error);
      }

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`Unexpected error sending email via ${provider.name}:`, errorMessage);
      
      // Update log entry with error
      if (logId) {
        await this.updateLogEntry(logId, {
          status: 'failed',
          provider: provider.name,
          error_message: errorMessage,
        });
      }

      return {
        success: false,
        error: errorMessage,
        provider: provider.name,
      };
    }
  }
}

// Export a singleton instance for convenience
export const emailService = new EmailService();
