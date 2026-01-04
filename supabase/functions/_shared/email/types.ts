// Email Provider Interface - All providers must implement this
export interface EmailRecipient {
  email: string;
  name?: string;
}

export interface EmailAttachment {
  filename: string;
  content: string; // Base64 encoded
  contentType: string;
}

export interface EmailMessage {
  to: EmailRecipient[];
  cc?: EmailRecipient[];
  bcc?: EmailRecipient[];
  subject: string;
  html: string;
  text?: string;
  attachments?: EmailAttachment[];
  replyTo?: EmailRecipient;
  tags?: Record<string, string>;
}

export interface EmailSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
  provider: string;
}

export interface EmailProviderConfig {
  fromEmail: string;
  fromName: string;
}

// All email providers must implement this interface
export interface EmailProvider {
  readonly name: string;
  send(message: EmailMessage): Promise<EmailSendResult>;
  validateConfig(): boolean;
}

// Supported email providers
export type EmailProviderType = 'mailersend' | 'sendgrid' | 'ses' | 'console' | 'smtp' | 'resend' | 'brevo';

// Company email settings from database
export interface CompanyEmailSettings {
  id: string;
  company_id: string;
  use_platform_default: boolean;
  provider: EmailProviderType | null;
  from_email: string | null;
  from_name: string | null;
  smtp_host: string | null;
  smtp_port: number | null;
  smtp_username: string | null;
  smtp_password: string | null;
  smtp_secure: boolean | null;
  api_key: string | null;
  aws_region: string | null;
  aws_access_key_id: string | null;
  aws_secret_access_key: string | null;
  is_verified: boolean;
  verified_at: string | null;
  last_test_at: string | null;
  last_test_result: Record<string, unknown> | null;
}

// Email template types
export type EmailTemplateType = 
  | 'user_invitation'
  | 'welcome'
  | 'password_reset'
  | 'leave_request_submitted'
  | 'leave_request_approved'
  | 'leave_request_rejected'
  | 'payroll_processed'
  | 'subscription_expiring'
  | 'company_frozen'
  | 'suspicious_login'
  | 'trial_started'
  | 'trial_expired'
  | 'trial_expiring_7_days'
  | 'trial_expiring_3_days'
  | 'trial_expiring_1_day'
  | 'trial_extension_approved'
  | 'trial_extension_rejected'
  | 'employee_account_created'
  | 'user_reactivated'
  | 'company_onboarding'
  | 'company_creation_link';

export interface EmailTemplateData {
  user_invitation: {
    inviterName: string;
    companyName: string;
    inviteUrl: string;
    role: string;
  };
  welcome: {
    userName: string;
    companyName: string;
    loginUrl: string;
  };
  password_reset: {
    userName: string;
    resetUrl: string;
  };
  leave_request_submitted: {
    employeeName: string;
    leaveType: string;
    startDate: string;
    endDate: string;
    managerName: string;
  };
  leave_request_approved: {
    employeeName: string;
    leaveType: string;
    startDate: string;
    endDate: string;
  };
  leave_request_rejected: {
    employeeName: string;
    leaveType: string;
    reason: string;
  };
  payroll_processed: {
    employeeName: string;
    periodStart: string;
    periodEnd: string;
    netPay: string;
  };
  subscription_expiring: {
    companyName: string;
    expirationDate: string;
    renewUrl: string;
  };
  company_frozen: {
    companyName: string;
    reason: string;
    supportEmail: string;
  };
  suspicious_login: {
    userName: string;
    loginTime: string;
    browser: string;
    location: string;
    ipAddress: string;
    reason: string;
    secureAccountUrl: string;
  };
  trial_started: {
    companyName: string;
    userName: string;
    trialDays: number;
    trialEndDate: string;
    dashboardUrl: string;
    planName: string;
  };
  trial_expired: {
    companyName: string;
    userName: string;
    upgradeUrl: string;
    featuresLost: string[];
  };
  trial_expiring_7_days: {
    companyName: string;
    daysRemaining: number;
    upgradeUrl: string;
    extensionUrl: string;
    canRequestExtension: boolean;
    userName: string;
  };
  trial_expiring_3_days: {
    companyName: string;
    daysRemaining: number;
    upgradeUrl: string;
    extensionUrl: string;
    canRequestExtension: boolean;
    userName: string;
  };
  trial_expiring_1_day: {
    companyName: string;
    daysRemaining: number;
    upgradeUrl: string;
    extensionUrl: string;
    canRequestExtension: boolean;
    userName: string;
  };
  trial_extension_approved: {
    companyName: string;
    extensionDays: number;
    newTrialEndDate: string;
    userName: string;
  };
  trial_extension_rejected: {
    companyName: string;
    reason: string;
    upgradeUrl: string;
    userName: string;
  };
  employee_account_created: {
    employeeName: string;
    companyName: string;
    employeeNumber: string;
    companySlug: string;
    temporaryPassword: string;
    loginUrl: string;
    loginType: 'email' | 'employee_id';
  };
  user_reactivated: {
    userName: string;
    companyName: string;
    companyCode: string;
    userId: string;
    userEmail: string;
    temporaryPassword: string;
    loginUrl: string;
    loginType: 'email' | 'employee_id';
  };
  company_onboarding: {
    adminName: string;
    companyName: string;
    companyUrl: string;
    adminEmail: string;
    temporaryPassword: string;
    planName: string;
    trialDays: number;
    loginUrl: string;
  };
  company_creation_link: {
    recipientEmail: string;
    signupUrl: string;
    expiresAt: string;
    planName: string;
    trialDays: number;
    senderName: string;
  };
}
