import { EmailProvider, EmailMessage, EmailSendResult, EmailProviderConfig } from '../types.ts';

export interface BrevoConfig extends EmailProviderConfig {
  apiKey: string;
}

/**
 * Brevo (formerly Sendinblue) Email Provider
 * https://www.brevo.com/
 */
export class BrevoEmailProvider implements EmailProvider {
  readonly name = 'brevo';
  private config: BrevoConfig;

  constructor(config: BrevoConfig) {
    this.config = config;
  }

  async send(message: EmailMessage): Promise<EmailSendResult> {
    if (!this.validateConfig()) {
      return {
        success: false,
        error: 'Brevo API key is not configured',
        provider: this.name,
      };
    }

    try {
      const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'api-key': this.config.apiKey,
        },
        body: JSON.stringify({
          sender: {
            email: this.config.fromEmail,
            name: this.config.fromName,
          },
          to: message.to.map(r => ({
            email: r.email,
            name: r.name,
          })),
          cc: message.cc?.map(r => ({
            email: r.email,
            name: r.name,
          })),
          bcc: message.bcc?.map(r => ({
            email: r.email,
            name: r.name,
          })),
          subject: message.subject,
          htmlContent: message.html,
          textContent: message.text,
          replyTo: message.replyTo ? {
            email: message.replyTo.email,
            name: message.replyTo.name,
          } : undefined,
          attachment: message.attachments?.map(a => ({
            name: a.filename,
            content: a.content,
          })),
          tags: message.tags ? Object.keys(message.tags) : undefined,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        console.error('Brevo API error:', error);
        return {
          success: false,
          error: error.message || `Brevo API error: ${response.status}`,
          provider: this.name,
        };
      }

      const result = await response.json();
      
      return {
        success: true,
        messageId: result.messageId,
        provider: this.name,
      };
    } catch (error) {
      console.error('Brevo send error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        provider: this.name,
      };
    }
  }

  validateConfig(): boolean {
    return Boolean(this.config.apiKey && this.config.fromEmail);
  }
}
