import { EmailProvider, EmailMessage, EmailSendResult, EmailProviderConfig } from '../types.ts';

/**
 * MailerSend Email Provider
 * https://www.mailersend.com/
 */
export class MailerSendEmailProvider implements EmailProvider {
  readonly name = 'mailersend';
  private apiKey: string;
  private config: EmailProviderConfig;
  private baseUrl = 'https://api.mailersend.com/v1';

  constructor(config: EmailProviderConfig) {
    this.apiKey = Deno.env.get('MAILERSEND_API_KEY') || '';
    this.config = config;
  }

  validateConfig(): boolean {
    if (!this.apiKey) {
      console.error('MailerSend: MAILERSEND_API_KEY is not set');
      return false;
    }
    if (!this.config.fromEmail) {
      console.error('MailerSend: EMAIL_FROM_ADDRESS is not set');
      return false;
    }
    return true;
  }

  async send(message: EmailMessage): Promise<EmailSendResult> {
    if (!this.validateConfig()) {
      return {
        success: false,
        error: 'MailerSend configuration is invalid',
        provider: this.name,
      };
    }

    try {
      const payload = {
        from: {
          email: this.config.fromEmail,
          name: this.config.fromName,
        },
        to: message.to.map(r => ({
          email: r.email,
          name: r.name || undefined,
        })),
        cc: message.cc?.map(r => ({
          email: r.email,
          name: r.name || undefined,
        })),
        bcc: message.bcc?.map(r => ({
          email: r.email,
          name: r.name || undefined,
        })),
        reply_to: message.replyTo ? {
          email: message.replyTo.email,
          name: message.replyTo.name || undefined,
        } : undefined,
        subject: message.subject,
        html: message.html,
        text: message.text,
        attachments: message.attachments?.map(a => ({
          filename: a.filename,
          content: a.content,
          type: a.contentType,
        })),
        tags: message.tags ? Object.entries(message.tags).map(([key, value]) => `${key}:${value}`) : undefined,
      };

      // Remove undefined values
      const cleanPayload = JSON.parse(JSON.stringify(payload));

      const response = await fetch(`${this.baseUrl}/email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(cleanPayload),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        console.error('MailerSend API error:', response.status, errorBody);
        return {
          success: false,
          error: `MailerSend API error: ${response.status} - ${errorBody}`,
          provider: this.name,
        };
      }

      const messageId = response.headers.get('x-message-id') || `mailersend-${Date.now()}`;

      console.log(`MailerSend: Email sent successfully. Message ID: ${messageId}`);

      return {
        success: true,
        messageId,
        provider: this.name,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('MailerSend send error:', errorMessage);
      return {
        success: false,
        error: errorMessage,
        provider: this.name,
      };
    }
  }
}
