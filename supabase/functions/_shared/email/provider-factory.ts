import { EmailProvider, EmailProviderType, EmailProviderConfig, CompanyEmailSettings } from './types.ts';
import { ConsoleEmailProvider } from './providers/console.ts';
import { MailerSendEmailProvider } from './providers/mailersend.ts';
import { SendGridEmailProvider } from './providers/sendgrid.ts';
import { AwsSesEmailProvider } from './providers/aws-ses.ts';
import { SmtpEmailProvider, SmtpConfig } from './providers/smtp.ts';
import { ResendEmailProvider, ResendConfig } from './providers/resend.ts';
import { BrevoEmailProvider, BrevoConfig } from './providers/brevo.ts';
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";

interface PlatformEmailSettings {
  provider: EmailProviderType;
  from_name: string;
  from_address: string;
}

/**
 * Email Provider Factory
 * Creates the appropriate email provider based on configuration.
 * Supports both platform-level (database) and company-level (database) settings.
 */
export class EmailProviderFactory {
  private static platformInstance: EmailProvider | null = null;
  private static platformProviderType: EmailProviderType | null = null;
  private static dbPlatformInstance: EmailProvider | null = null;
  private static dbPlatformProviderType: EmailProviderType | null = null;

  /**
   * Get the platform-level email provider from the database (platform_settings table).
   * This is the preferred method as it respects settings configured in the Platform UI.
   */
  static async getPlatformProviderFromDb(): Promise<EmailProvider> {
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL');
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
      
      if (!supabaseUrl || !supabaseServiceKey) {
        console.warn('Supabase credentials not available, falling back to env vars');
        return this.getPlatformProvider();
      }

      const client = createClient(supabaseUrl, supabaseServiceKey);
      
      // Fetch platform email settings from database
      const { data, error } = await client
        .from('platform_settings')
        .select('value')
        .eq('key', 'email')
        .single();

      if (error || !data) {
        console.warn('No platform email settings in database, falling back to env vars');
        return this.getPlatformProvider();
      }

      const settings = data.value as PlatformEmailSettings;
      const providerType = (settings.provider?.toLowerCase() || 'console') as EmailProviderType;

      // Check if we have a cached instance with the same provider type
      if (this.dbPlatformInstance && this.dbPlatformProviderType === providerType) {
        return this.dbPlatformInstance;
      }

      const config: EmailProviderConfig = {
        fromEmail: settings.from_address || Deno.env.get('EMAIL_FROM_ADDRESS') || 'noreply@example.com',
        fromName: settings.from_name || Deno.env.get('EMAIL_FROM_NAME') || 'HR System',
      };

      this.dbPlatformProviderType = providerType;
      this.dbPlatformInstance = this.createProvider(providerType, config);

      console.log(`Platform email provider from database: ${this.dbPlatformInstance.name}`);

      if (!this.dbPlatformInstance.validateConfig()) {
        console.warn(`Email provider ${this.dbPlatformInstance.name} configuration is incomplete.`);
      }

      return this.dbPlatformInstance;
    } catch (err) {
      console.error('Error fetching platform email settings from database:', err);
      return this.getPlatformProvider();
    }
  }

  /**
   * Get the platform-level email provider (from environment variables).
   * This is the fallback method if database fetch fails.
   */
  static getPlatformProvider(): EmailProvider {
    const currentProviderType = this.getPlatformProviderType();

    // Return cached instance if provider type hasn't changed
    if (this.platformInstance && this.platformProviderType === currentProviderType) {
      return this.platformInstance;
    }

    const config = this.getPlatformConfig();
    this.platformProviderType = currentProviderType;
    this.platformInstance = this.createProvider(currentProviderType, config);

    console.log(`Platform email provider initialized (env vars): ${this.platformInstance.name}`);

    if (!this.platformInstance.validateConfig()) {
      console.warn(`Email provider ${this.platformInstance.name} configuration is incomplete.`);
    }

    return this.platformInstance;
  }

  /**
   * Create a provider from company-specific settings (async version).
   * Falls back to platform provider from database if company uses default.
   */
  static async getCompanyProviderAsync(settings: CompanyEmailSettings | null): Promise<EmailProvider> {
    // If no settings or using platform default, return platform provider from database
    if (!settings || settings.use_platform_default) {
      console.log('Using platform default email provider (from database)');
      return this.getPlatformProviderFromDb();
    }

    // Create company-specific provider
    if (!settings.provider) {
      console.warn('Company has custom settings but no provider specified, using platform default');
      return this.getPlatformProviderFromDb();
    }

    const config: EmailProviderConfig = {
      fromEmail: settings.from_email || Deno.env.get('EMAIL_FROM_ADDRESS') || 'noreply@example.com',
      fromName: settings.from_name || Deno.env.get('EMAIL_FROM_NAME') || 'HR System',
    };

    const provider = this.createProviderFromCompanySettings(settings, config);
    
    console.log(`Company email provider created: ${provider.name}`);
    
    if (!provider.validateConfig()) {
      console.warn(`Company provider ${provider.name} configuration is incomplete, falling back to platform`);
      return this.getPlatformProviderFromDb();
    }

    return provider;
  }

  /**
   * Create a provider from company-specific settings (sync version - legacy).
   * Falls back to platform provider if company uses default.
   * @deprecated Use getCompanyProviderAsync instead
   */
  static getCompanyProvider(settings: CompanyEmailSettings | null): EmailProvider {
    // If no settings or using platform default, return platform provider
    if (!settings || settings.use_platform_default) {
      console.log('Using platform default email provider');
      return this.getPlatformProvider();
    }

    // Create company-specific provider
    if (!settings.provider) {
      console.warn('Company has custom settings but no provider specified, using platform default');
      return this.getPlatformProvider();
    }

    const config: EmailProviderConfig = {
      fromEmail: settings.from_email || Deno.env.get('EMAIL_FROM_ADDRESS') || 'noreply@example.com',
      fromName: settings.from_name || Deno.env.get('EMAIL_FROM_NAME') || 'HR System',
    };

    const provider = this.createProviderFromCompanySettings(settings, config);
    
    console.log(`Company email provider created: ${provider.name}`);
    
    if (!provider.validateConfig()) {
      console.warn(`Company provider ${provider.name} configuration is incomplete, falling back to platform`);
      return this.getPlatformProvider();
    }

    return provider;
  }

  /**
   * Create a provider instance from company settings
   */
  private static createProviderFromCompanySettings(
    settings: CompanyEmailSettings, 
    config: EmailProviderConfig
  ): EmailProvider {
    switch (settings.provider) {
      case 'smtp':
        const smtpConfig: SmtpConfig = {
          ...config,
          host: settings.smtp_host || '',
          port: settings.smtp_port || 587,
          username: settings.smtp_username || '',
          password: settings.smtp_password || '',
          secure: settings.smtp_secure ?? true,
        };
        return new SmtpEmailProvider(smtpConfig);

      case 'resend':
        const resendConfig: ResendConfig = {
          ...config,
          apiKey: settings.api_key || '',
        };
        return new ResendEmailProvider(resendConfig);

      case 'mailersend':
        // MailerSend reads API key from env, but we can set it for company config
        Deno.env.set('MAILERSEND_API_KEY', settings.api_key || '');
        return new MailerSendEmailProvider(config);

      case 'sendgrid':
        // SendGrid reads API key from env, but we can set it for company config
        Deno.env.set('SENDGRID_API_KEY', settings.api_key || '');
        return new SendGridEmailProvider(config);

      case 'brevo':
        const brevoConfig: BrevoConfig = {
          ...config,
          apiKey: settings.api_key || '',
        };
        return new BrevoEmailProvider(brevoConfig);

      case 'ses':
        // AWS SES reads keys from env, set them for company config
        Deno.env.set('AWS_SES_ACCESS_KEY', settings.aws_access_key_id || '');
        Deno.env.set('AWS_SES_SECRET_KEY', settings.aws_secret_access_key || '');
        Deno.env.set('AWS_SES_REGION', settings.aws_region || 'us-east-1');
        return new AwsSesEmailProvider(config);

      case 'console':
      default:
        return new ConsoleEmailProvider(config);
    }
  }

  /**
   * Create a provider instance based on type and config (for platform level)
   */
  private static createProvider(type: EmailProviderType, config: EmailProviderConfig): EmailProvider {
    switch (type) {
      case 'mailersend':
        return new MailerSendEmailProvider(config);
      case 'sendgrid':
        return new SendGridEmailProvider(config);
      case 'ses':
        return new AwsSesEmailProvider(config);
      case 'smtp':
        return new SmtpEmailProvider({
          ...config,
          host: Deno.env.get('SMTP_HOST') || '',
          port: parseInt(Deno.env.get('SMTP_PORT') || '587'),
          username: Deno.env.get('SMTP_USERNAME') || '',
          password: Deno.env.get('SMTP_PASSWORD') || '',
          secure: Deno.env.get('SMTP_SECURE') !== 'false',
        });
      case 'resend':
        return new ResendEmailProvider({
          ...config,
          apiKey: Deno.env.get('RESEND_API_KEY') || '',
        });
      case 'brevo':
        return new BrevoEmailProvider({
          ...config,
          apiKey: Deno.env.get('BREVO_API_KEY') || '',
        });
      case 'console':
      default:
        return new ConsoleEmailProvider(config);
    }
  }

  /**
   * Get the provider type from environment.
   */
  private static getPlatformProviderType(): EmailProviderType {
    const provider = Deno.env.get('EMAIL_PROVIDER')?.toLowerCase() as EmailProviderType;
    
    if (!provider) {
      console.warn('EMAIL_PROVIDER not set. Defaulting to console provider.');
      return 'console';
    }

    const validProviders: EmailProviderType[] = ['mailersend', 'sendgrid', 'ses', 'console', 'smtp', 'resend', 'brevo'];
    if (!validProviders.includes(provider)) {
      throw new Error(`Invalid EMAIL_PROVIDER: ${provider}. Valid options: ${validProviders.join(', ')}`);
    }

    return provider;
  }

  /**
   * Get shared email configuration from environment.
   */
  private static getPlatformConfig(): EmailProviderConfig {
    return {
      fromEmail: Deno.env.get('EMAIL_FROM_ADDRESS') || 'noreply@example.com',
      fromName: Deno.env.get('EMAIL_FROM_NAME') || 'HR System',
    };
  }

  /**
   * Reset the cached provider instances.
   */
  static reset(): void {
    this.platformInstance = null;
    this.platformProviderType = null;
    this.dbPlatformInstance = null;
    this.dbPlatformProviderType = null;
  }
}
