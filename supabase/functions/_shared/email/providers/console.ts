import { EmailProvider, EmailMessage, EmailSendResult, EmailProviderConfig } from '../types.ts';

/**
 * Console Email Provider
 * Logs emails to console instead of sending them.
 * Useful for development and testing.
 */
export class ConsoleEmailProvider implements EmailProvider {
  readonly name = 'console';
  private config: EmailProviderConfig;

  constructor(config: EmailProviderConfig) {
    this.config = config;
  }

  validateConfig(): boolean {
    return !!this.config.fromEmail && !!this.config.fromName;
  }

  async send(message: EmailMessage): Promise<EmailSendResult> {
    const timestamp = new Date().toISOString();
    const messageId = `console-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    console.log('\n' + '='.repeat(60));
    console.log('📧 EMAIL (Console Provider - Not Sent)');
    console.log('='.repeat(60));
    console.log(`Timestamp: ${timestamp}`);
    console.log(`Message ID: ${messageId}`);
    console.log('-'.repeat(60));
    console.log(`From: ${this.config.fromName} <${this.config.fromEmail}>`);
    console.log(`To: ${message.to.map(r => r.name ? `${r.name} <${r.email}>` : r.email).join(', ')}`);
    if (message.cc?.length) {
      console.log(`CC: ${message.cc.map(r => r.name ? `${r.name} <${r.email}>` : r.email).join(', ')}`);
    }
    if (message.bcc?.length) {
      console.log(`BCC: ${message.bcc.map(r => r.name ? `${r.name} <${r.email}>` : r.email).join(', ')}`);
    }
    if (message.replyTo) {
      console.log(`Reply-To: ${message.replyTo.name ? `${message.replyTo.name} <${message.replyTo.email}>` : message.replyTo.email}`);
    }
    console.log(`Subject: ${message.subject}`);
    console.log('-'.repeat(60));
    console.log('Body (Text):');
    console.log(message.text || '(No text version)');
    console.log('-'.repeat(60));
    if (message.attachments?.length) {
      console.log(`Attachments: ${message.attachments.map(a => a.filename).join(', ')}`);
    }
    if (message.tags) {
      console.log(`Tags: ${JSON.stringify(message.tags)}`);
    }
    console.log('='.repeat(60) + '\n');

    return {
      success: true,
      messageId,
      provider: this.name,
    };
  }
}
