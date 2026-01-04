import { EmailProvider, EmailMessage, EmailSendResult, EmailProviderConfig } from '../types.ts';

/**
 * SendGrid Email Provider (Skeleton)
 * https://sendgrid.com/
 * 
 * To implement:
 * 1. Add SENDGRID_API_KEY to environment variables
 * 2. Implement the send method using SendGrid API
 */
export class SendGridEmailProvider implements EmailProvider {
  readonly name = 'sendgrid';
  private apiKey: string;
  private config: EmailProviderConfig;
  private baseUrl = 'https://api.sendgrid.com/v3';

  constructor(config: EmailProviderConfig) {
    this.apiKey = Deno.env.get('SENDGRID_API_KEY') || '';
    this.config = config;
  }

  validateConfig(): boolean {
    if (!this.apiKey) {
      console.error('SendGrid: SENDGRID_API_KEY is not set');
      return false;
    }
    if (!this.config.fromEmail) {
      console.error('SendGrid: EMAIL_FROM_ADDRESS is not set');
      return false;
    }
    return true;
  }

  async send(message: EmailMessage): Promise<EmailSendResult> {
    if (!this.validateConfig()) {
      return {
        success: false,
        error: 'SendGrid configuration is invalid',
        provider: this.name,
      };
    }

    try {
      const payload = {
        personalizations: [
          {
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
          },
        ],
        from: {
          email: this.config.fromEmail,
          name: this.config.fromName,
        },
        reply_to: message.replyTo ? {
          email: message.replyTo.email,
          name: message.replyTo.name,
        } : undefined,
        subject: message.subject,
        content: [
          {
            type: 'text/plain',
            value: message.text || '',
          },
          {
            type: 'text/html',
            value: message.html,
          },
        ],
        attachments: message.attachments?.map(a => ({
          content: a.content,
          filename: a.filename,
          type: a.contentType,
          disposition: 'attachment',
        })),
      };

      // Remove undefined values
      const cleanPayload = JSON.parse(JSON.stringify(payload));

      const response = await fetch(`${this.baseUrl}/mail/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(cleanPayload),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        console.error('SendGrid API error:', response.status, errorBody);
        return {
          success: false,
          error: `SendGrid API error: ${response.status} - ${errorBody}`,
          provider: this.name,
        };
      }

      const messageId = response.headers.get('x-message-id') || `sendgrid-${Date.now()}`;

      console.log(`SendGrid: Email sent successfully. Message ID: ${messageId}`);

      return {
        success: true,
        messageId,
        provider: this.name,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('SendGrid send error:', errorMessage);
      return {
        success: false,
        error: errorMessage,
        provider: this.name,
      };
    }
  }
}
