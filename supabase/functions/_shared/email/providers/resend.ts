import { EmailProvider, EmailMessage, EmailSendResult, EmailProviderConfig } from '../types.ts';

export interface ResendConfig extends EmailProviderConfig {
  apiKey: string;
}

/**
 * Resend Email Provider
 * Uses the Resend.com API for email delivery.
 */
export class ResendEmailProvider implements EmailProvider {
  readonly name = 'Resend';
  private config: ResendConfig;

  constructor(config: ResendConfig) {
    this.config = config;
  }

  async send(message: EmailMessage): Promise<EmailSendResult> {
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: this.config.fromName 
            ? `${this.config.fromName} <${this.config.fromEmail}>` 
            : this.config.fromEmail,
          to: message.to.map(r => r.email),
          cc: message.cc?.map(r => r.email),
          bcc: message.bcc?.map(r => r.email),
          subject: message.subject,
          html: message.html,
          text: message.text,
          reply_to: message.replyTo?.email,
          tags: message.tags ? Object.entries(message.tags).map(([name, value]) => ({ name, value })) : undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('[Resend] API error:', data);
        return {
          success: false,
          error: data.message || data.error || 'Resend API error',
          provider: this.name,
        };
      }

      console.log(`[Resend] Email sent successfully. ID: ${data.id}`);

      return {
        success: true,
        messageId: data.id,
        provider: this.name,
      };
    } catch (error) {
      console.error('[Resend] Send failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown Resend error',
        provider: this.name,
      };
    }
  }

  validateConfig(): boolean {
    return !!(this.config.apiKey && this.config.fromEmail);
  }
}
