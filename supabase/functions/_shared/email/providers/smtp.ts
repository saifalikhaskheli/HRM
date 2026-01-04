import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";
import { EmailProvider, EmailMessage, EmailSendResult, EmailProviderConfig } from '../types.ts';

export interface SmtpConfig extends EmailProviderConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  secure: boolean;
}

/**
 * SMTP Email Provider
 * Sends emails via standard SMTP protocol.
 */
export class SmtpEmailProvider implements EmailProvider {
  readonly name = 'SMTP';
  private config: SmtpConfig;

  constructor(config: SmtpConfig) {
    this.config = config;
  }

  async send(message: EmailMessage): Promise<EmailSendResult> {
    try {
      const client = new SMTPClient({
        connection: {
          hostname: this.config.host,
          port: this.config.port,
          tls: this.config.secure,
          auth: {
            username: this.config.username,
            password: this.config.password,
          },
        },
      });

      const toAddresses = message.to.map(r => r.name ? `${r.name} <${r.email}>` : r.email);
      const ccAddresses = message.cc?.map(r => r.name ? `${r.name} <${r.email}>` : r.email);
      const bccAddresses = message.bcc?.map(r => r.name ? `${r.name} <${r.email}>` : r.email);

      await client.send({
        from: this.config.fromName 
          ? `${this.config.fromName} <${this.config.fromEmail}>` 
          : this.config.fromEmail,
        to: toAddresses,
        cc: ccAddresses,
        bcc: bccAddresses,
        subject: message.subject,
        content: message.text || '',
        html: message.html,
        replyTo: message.replyTo 
          ? (message.replyTo.name 
            ? `${message.replyTo.name} <${message.replyTo.email}>` 
            : message.replyTo.email)
          : undefined,
      });

      await client.close();

      console.log(`[SMTP] Email sent successfully to ${toAddresses.join(', ')}`);

      return {
        success: true,
        messageId: `smtp-${Date.now()}`,
        provider: this.name,
      };
    } catch (error) {
      console.error('[SMTP] Send failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown SMTP error',
        provider: this.name,
      };
    }
  }

  validateConfig(): boolean {
    return !!(
      this.config.host &&
      this.config.port &&
      this.config.username &&
      this.config.password &&
      this.config.fromEmail
    );
  }
}
