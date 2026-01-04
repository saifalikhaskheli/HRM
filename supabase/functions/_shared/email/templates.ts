import { EmailTemplateType, EmailTemplateData } from './types.ts';

interface RenderedTemplate {
  subject: string;
  html: string;
  text: string;
}

// Base email styles
const baseStyles = `
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
  .container { max-width: 600px; margin: 0 auto; padding: 20px; }
  .header { background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
  .header h1 { color: white; margin: 0; font-size: 24px; }
  .content { background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; }
  .footer { background: #f9fafb; padding: 20px; text-align: center; font-size: 12px; color: #6b7280; border-radius: 0 0 8px 8px; border: 1px solid #e5e7eb; border-top: none; }
  .button { display: inline-block; background: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500; margin: 20px 0; }
  .button:hover { background: #4f46e5; }
  .highlight { background: #f0f9ff; border-left: 4px solid #6366f1; padding: 15px; margin: 20px 0; }
`;

function wrapTemplate(content: string, title: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>${baseStyles}</style>
</head>
<body>
  <div class="container">
    ${content}
  </div>
</body>
</html>`;
}

const templates: Record<EmailTemplateType, (data: any) => RenderedTemplate> = {
  user_invitation: (data: EmailTemplateData['user_invitation']) => ({
    subject: `You've been invited to join ${data.companyName}`,
    html: wrapTemplate(`
      <div class="header">
        <h1>You're Invited!</h1>
      </div>
      <div class="content">
        <p>Hi there,</p>
        <p><strong>${data.inviterName}</strong> has invited you to join <strong>${data.companyName}</strong> as a <strong>${data.role}</strong>.</p>
        <p>Click the button below to accept your invitation and set up your account:</p>
        <p style="text-align: center;">
          <a href="${data.inviteUrl}" class="button">Accept Invitation</a>
        </p>
        <p style="color: #6b7280; font-size: 14px;">If you didn't expect this invitation, you can safely ignore this email.</p>
      </div>
      <div class="footer">
        <p>This invitation was sent via our HR Management System</p>
      </div>
    `, `Invitation to ${data.companyName}`),
    text: `You've been invited to join ${data.companyName}!\n\n${data.inviterName} has invited you to join as a ${data.role}.\n\nAccept your invitation: ${data.inviteUrl}\n\nIf you didn't expect this invitation, you can safely ignore this email.`
  }),

  welcome: (data: EmailTemplateData['welcome']) => ({
    subject: `Welcome to ${data.companyName}!`,
    html: wrapTemplate(`
      <div class="header">
        <h1>Welcome Aboard!</h1>
      </div>
      <div class="content">
        <p>Hi ${data.userName},</p>
        <p>Welcome to <strong>${data.companyName}</strong>! Your account has been successfully created.</p>
        <p>You can now access your dashboard and start exploring all the features available to you.</p>
        <p style="text-align: center;">
          <a href="${data.loginUrl}" class="button">Go to Dashboard</a>
        </p>
        <p>If you have any questions, don't hesitate to reach out to your HR team.</p>
      </div>
      <div class="footer">
        <p>© ${new Date().getFullYear()} ${data.companyName}. All rights reserved.</p>
      </div>
    `, `Welcome to ${data.companyName}`),
    text: `Welcome to ${data.companyName}, ${data.userName}!\n\nYour account has been successfully created.\n\nGo to your dashboard: ${data.loginUrl}`
  }),

  password_reset: (data: EmailTemplateData['password_reset']) => ({
    subject: 'Reset Your Password',
    html: wrapTemplate(`
      <div class="header">
        <h1>Password Reset</h1>
      </div>
      <div class="content">
        <p>Hi ${data.userName},</p>
        <p>We received a request to reset your password. Click the button below to create a new password:</p>
        <p style="text-align: center;">
          <a href="${data.resetUrl}" class="button">Reset Password</a>
        </p>
        <p style="color: #6b7280; font-size: 14px;">This link will expire in 1 hour. If you didn't request a password reset, please ignore this email.</p>
      </div>
      <div class="footer">
        <p>For security, this request was received from your account.</p>
      </div>
    `, 'Password Reset'),
    text: `Hi ${data.userName},\n\nWe received a request to reset your password.\n\nReset your password: ${data.resetUrl}\n\nThis link will expire in 1 hour. If you didn't request this, please ignore this email.`
  }),

  leave_request_submitted: (data: EmailTemplateData['leave_request_submitted']) => ({
    subject: `Leave Request from ${data.employeeName}`,
    html: wrapTemplate(`
      <div class="header">
        <h1>New Leave Request</h1>
      </div>
      <div class="content">
        <p>Hi ${data.managerName},</p>
        <p><strong>${data.employeeName}</strong> has submitted a leave request for your review:</p>
        <div class="highlight">
          <p><strong>Leave Type:</strong> ${data.leaveType}</p>
          <p><strong>Start Date:</strong> ${data.startDate}</p>
          <p><strong>End Date:</strong> ${data.endDate}</p>
        </div>
        <p>Please log in to the system to approve or reject this request.</p>
      </div>
      <div class="footer">
        <p>This is an automated notification from the HR System.</p>
      </div>
    `, 'New Leave Request'),
    text: `Hi ${data.managerName},\n\n${data.employeeName} has submitted a leave request:\n\nLeave Type: ${data.leaveType}\nStart Date: ${data.startDate}\nEnd Date: ${data.endDate}\n\nPlease log in to review this request.`
  }),

  leave_request_approved: (data: EmailTemplateData['leave_request_approved']) => ({
    subject: 'Your Leave Request Has Been Approved',
    html: wrapTemplate(`
      <div class="header">
        <h1>Leave Approved ✓</h1>
      </div>
      <div class="content">
        <p>Hi ${data.employeeName},</p>
        <p>Great news! Your leave request has been <strong style="color: #10b981;">approved</strong>.</p>
        <div class="highlight">
          <p><strong>Leave Type:</strong> ${data.leaveType}</p>
          <p><strong>Start Date:</strong> ${data.startDate}</p>
          <p><strong>End Date:</strong> ${data.endDate}</p>
        </div>
        <p>Enjoy your time off!</p>
      </div>
      <div class="footer">
        <p>This is an automated notification from the HR System.</p>
      </div>
    `, 'Leave Request Approved'),
    text: `Hi ${data.employeeName},\n\nYour leave request has been approved!\n\nLeave Type: ${data.leaveType}\nStart Date: ${data.startDate}\nEnd Date: ${data.endDate}\n\nEnjoy your time off!`
  }),

  leave_request_rejected: (data: EmailTemplateData['leave_request_rejected']) => ({
    subject: 'Your Leave Request Status',
    html: wrapTemplate(`
      <div class="header">
        <h1>Leave Request Update</h1>
      </div>
      <div class="content">
        <p>Hi ${data.employeeName},</p>
        <p>Unfortunately, your ${data.leaveType} leave request could not be approved at this time.</p>
        <div class="highlight">
          <p><strong>Reason:</strong> ${data.reason}</p>
        </div>
        <p>Please speak with your manager if you have any questions.</p>
      </div>
      <div class="footer">
        <p>This is an automated notification from the HR System.</p>
      </div>
    `, 'Leave Request Update'),
    text: `Hi ${data.employeeName},\n\nYour ${data.leaveType} leave request could not be approved.\n\nReason: ${data.reason}\n\nPlease speak with your manager if you have any questions.`
  }),

  payroll_processed: (data: EmailTemplateData['payroll_processed']) => ({
    subject: 'Your Payslip is Ready',
    html: wrapTemplate(`
      <div class="header">
        <h1>Payslip Available</h1>
      </div>
      <div class="content">
        <p>Hi ${data.employeeName},</p>
        <p>Your payslip for the period <strong>${data.periodStart}</strong> to <strong>${data.periodEnd}</strong> is now available.</p>
        <div class="highlight">
          <p><strong>Net Pay:</strong> ${data.netPay}</p>
        </div>
        <p>Log in to your dashboard to view the full details.</p>
      </div>
      <div class="footer">
        <p>This is a confidential payroll notification.</p>
      </div>
    `, 'Payslip Available'),
    text: `Hi ${data.employeeName},\n\nYour payslip for ${data.periodStart} to ${data.periodEnd} is ready.\n\nNet Pay: ${data.netPay}\n\nLog in to view full details.`
  }),

  subscription_expiring: (data: EmailTemplateData['subscription_expiring']) => ({
    subject: `Action Required: ${data.companyName} Subscription Expiring Soon`,
    html: wrapTemplate(`
      <div class="header">
        <h1>Subscription Reminder</h1>
      </div>
      <div class="content">
        <p>Hello,</p>
        <p>This is a reminder that the subscription for <strong>${data.companyName}</strong> will expire on <strong>${data.expirationDate}</strong>.</p>
        <p>To avoid any service interruption, please renew your subscription before the expiration date.</p>
        <p style="text-align: center;">
          <a href="${data.renewUrl}" class="button">Renew Now</a>
        </p>
      </div>
      <div class="footer">
        <p>If you have any questions, please contact our support team.</p>
      </div>
    `, 'Subscription Expiring'),
    text: `Reminder: The subscription for ${data.companyName} will expire on ${data.expirationDate}.\n\nRenew now: ${data.renewUrl}`
  }),

  company_frozen: (data: EmailTemplateData['company_frozen']) => ({
    subject: `Important: ${data.companyName} Account Suspended`,
    html: wrapTemplate(`
      <div class="header" style="background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%);">
        <h1>Account Suspended</h1>
      </div>
      <div class="content">
        <p>Hello,</p>
        <p>We regret to inform you that the account for <strong>${data.companyName}</strong> has been suspended.</p>
        <div class="highlight" style="border-left-color: #dc2626;">
          <p><strong>Reason:</strong> ${data.reason}</p>
        </div>
        <p>If you believe this is an error or would like to resolve this issue, please contact our support team.</p>
        <p><strong>Support Email:</strong> <a href="mailto:${data.supportEmail}">${data.supportEmail}</a></p>
      </div>
      <div class="footer">
        <p>This is an automated notification.</p>
      </div>
    `, 'Account Suspended'),
    text: `Important: The account for ${data.companyName} has been suspended.\n\nReason: ${data.reason}\n\nContact support: ${data.supportEmail}`
  }),

  suspicious_login: (data: EmailTemplateData['suspicious_login']) => ({
    subject: '⚠️ Suspicious Login Detected on Your Account',
    html: wrapTemplate(`
      <div class="header" style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);">
        <h1>⚠️ Security Alert</h1>
      </div>
      <div class="content">
        <p>Hi ${data.userName},</p>
        <p>We detected a login to your account that looks unusual. If this was you, you can ignore this email.</p>
        <div class="highlight" style="border-left-color: #f59e0b;">
          <p><strong>When:</strong> ${data.loginTime}</p>
          <p><strong>Browser:</strong> ${data.browser}</p>
          <p><strong>Location:</strong> ${data.location}</p>
          <p><strong>IP Address:</strong> ${data.ipAddress}</p>
          <p><strong>Reason for alert:</strong> ${data.reason}</p>
        </div>
        <p><strong>If this wasn't you:</strong> Someone may have access to your account. We recommend you:</p>
        <ol>
          <li>Change your password immediately</li>
          <li>Enable two-factor authentication</li>
          <li>Review recent account activity</li>
        </ol>
        <p style="text-align: center;">
          <a href="${data.secureAccountUrl}" class="button" style="background: #dc2626;">Secure My Account</a>
        </p>
      </div>
      <div class="footer">
        <p>This is an automated security notification. Do not reply to this email.</p>
      </div>
    `, 'Security Alert - Suspicious Login'),
    text: `Security Alert\n\nHi ${data.userName},\n\nWe detected a suspicious login to your account:\n\nWhen: ${data.loginTime}\nBrowser: ${data.browser}\nLocation: ${data.location}\nIP Address: ${data.ipAddress}\nReason: ${data.reason}\n\nIf this wasn't you, please secure your account immediately: ${data.secureAccountUrl}`
  }),

  trial_started: (data: EmailTemplateData['trial_started']) => ({
    subject: `🚀 Your ${data.companyName} trial has started!`,
    html: wrapTemplate(`
      <div class="header" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%);">
        <h1>🚀 Welcome to Your Trial!</h1>
      </div>
      <div class="content">
        <p>Hi ${data.userName},</p>
        <p>Your <strong>${data.trialDays}-day trial</strong> of <strong>${data.companyName}</strong> on the <strong>${data.planName}</strong> plan has started.</p>
        <div class="highlight" style="border-left-color: #10b981;">
          <p><strong>Trial ends:</strong> ${data.trialEndDate}</p>
          <p><strong>Full access to:</strong> All features included in your plan</p>
        </div>
        <p>Get started by exploring your dashboard and setting up your team:</p>
        <p style="text-align: center;">
          <a href="${data.dashboardUrl}" class="button" style="background: #10b981;">Go to Dashboard</a>
        </p>
        <p>We're here to help! If you have any questions, don't hesitate to reach out.</p>
      </div>
      <div class="footer">
        <p>Enjoy exploring all the features during your trial!</p>
      </div>
    `, 'Trial Started'),
    text: `Welcome to your ${data.trialDays}-day trial of ${data.companyName}!\n\nHi ${data.userName},\n\nYour trial has started on the ${data.planName} plan.\n\nTrial ends: ${data.trialEndDate}\n\nGo to your dashboard: ${data.dashboardUrl}`
  }),

  trial_expired: (data: EmailTemplateData['trial_expired']) => ({
    subject: `⚠️ Your ${data.companyName} trial has ended`,
    html: wrapTemplate(`
      <div class="header" style="background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%);">
        <h1>⚠️ Trial Ended</h1>
      </div>
      <div class="content">
        <p>Hi ${data.userName},</p>
        <p>Your trial for <strong>${data.companyName}</strong> has ended. Your account is now in <strong>read-only mode</strong>.</p>
        <div class="highlight" style="border-left-color: #dc2626;">
          <p><strong>What this means:</strong></p>
          <ul>
            <li>You can still view all your data</li>
            <li>You cannot create, edit, or delete records</li>
            <li>Features like payroll processing are disabled</li>
          </ul>
        </div>
        <p><strong>Your data is safe!</strong> Upgrade now to restore full access and continue where you left off.</p>
        <p style="text-align: center;">
          <a href="${data.upgradeUrl}" class="button" style="background: #dc2626;">Upgrade Now</a>
        </p>
      </div>
      <div class="footer">
        <p>Questions? Contact our support team for help.</p>
      </div>
    `, 'Trial Ended'),
    text: `Your ${data.companyName} trial has ended.\n\nHi ${data.userName},\n\nYour account is now in read-only mode. Your data is safe - upgrade to restore full access.\n\nUpgrade now: ${data.upgradeUrl}`
  }),

  trial_expiring_7_days: (data: EmailTemplateData['trial_expiring_7_days']) => ({
    subject: `📅 7 days left in your ${data.companyName} trial`,
    html: wrapTemplate(`
      <div class="header">
        <h1>📅 7 Days Left</h1>
      </div>
      <div class="content">
        <p>Hi ${data.userName},</p>
        <p>You have <strong>7 days</strong> left to explore all the features of your <strong>${data.companyName}</strong> trial.</p>
        <p>Ready to commit? Upgrade today and keep all your data!</p>
        <p style="text-align: center;">
          <a href="${data.upgradeUrl}" class="button">Upgrade Now</a>
        </p>
        ${data.canRequestExtension ? `<p>Need more time? <a href="${data.extensionUrl}">Request an extension</a>.</p>` : ''}
      </div>
      <div class="footer">
        <p>Questions? Contact our support team.</p>
      </div>
    `, 'Trial Reminder'),
    text: `Hi ${data.userName},\n\nYou have 7 days left in your ${data.companyName} trial.\n\nUpgrade now: ${data.upgradeUrl}\n\n${data.canRequestExtension ? `Need more time? Request an extension: ${data.extensionUrl}` : ''}`
  }),

  trial_expiring_3_days: (data: EmailTemplateData['trial_expiring_3_days']) => ({
    subject: `⏰ Only 3 days left in your ${data.companyName} trial`,
    html: wrapTemplate(`
      <div class="header" style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);">
        <h1>⏰ 3 Days Left</h1>
      </div>
      <div class="content">
        <p>Hi ${data.userName},</p>
        <p>Your trial of <strong>${data.companyName}</strong> is ending soon. Upgrade now to ensure uninterrupted access to all features.</p>
        <p style="text-align: center;">
          <a href="${data.upgradeUrl}" class="button" style="background: #f59e0b;">Upgrade Now</a>
        </p>
        ${data.canRequestExtension ? `<p>Need more time? <a href="${data.extensionUrl}">Request an extension</a>.</p>` : ''}
      </div>
      <div class="footer">
        <p>Questions? Contact our support team.</p>
      </div>
    `, 'Trial Ending Soon'),
    text: `Hi ${data.userName},\n\nOnly 3 days left in your ${data.companyName} trial.\n\nUpgrade now: ${data.upgradeUrl}\n\n${data.canRequestExtension ? `Need more time? Request an extension: ${data.extensionUrl}` : ''}`
  }),

  trial_expiring_1_day: (data: EmailTemplateData['trial_expiring_1_day']) => ({
    subject: `⚠️ Last Day: Your ${data.companyName} trial ends today!`,
    html: wrapTemplate(`
      <div class="header" style="background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%);">
        <h1>⚠️ Last Day!</h1>
      </div>
      <div class="content">
        <p>Hi ${data.userName},</p>
        <p><strong>Your trial ends today!</strong> Upgrade now to continue using <strong>${data.companyName}</strong> without interruption.</p>
        <p style="text-align: center;">
          <a href="${data.upgradeUrl}" class="button" style="background: #dc2626;">Upgrade Now</a>
        </p>
        ${data.canRequestExtension ? `<p>Need more time? <a href="${data.extensionUrl}">Request an extension</a>.</p>` : ''}
      </div>
      <div class="footer">
        <p>Questions? Contact our support team.</p>
      </div>
    `, 'Trial Ends Today'),
    text: `Hi ${data.userName},\n\nYour ${data.companyName} trial ends today!\n\nUpgrade now: ${data.upgradeUrl}\n\n${data.canRequestExtension ? `Need more time? Request an extension: ${data.extensionUrl}` : ''}`
  }),

  trial_extension_approved: (data: EmailTemplateData['trial_extension_approved']) => ({
    subject: `✅ Trial Extension Approved for ${data.companyName}`,
    html: wrapTemplate(`
      <div class="header" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%);">
        <h1>✅ Extension Approved!</h1>
      </div>
      <div class="content">
        <p>Hi ${data.userName},</p>
        <p>Great news! Your trial extension request for <strong>${data.companyName}</strong> has been approved.</p>
        <div class="highlight" style="border-left-color: #10b981;">
          <p><strong>Extension:</strong> ${data.extensionDays} additional days</p>
          <p><strong>New trial end date:</strong> ${data.newTrialEndDate}</p>
        </div>
        <p>Enjoy exploring the platform!</p>
      </div>
      <div class="footer">
        <p>Questions? Contact our support team.</p>
      </div>
    `, 'Trial Extension Approved'),
    text: `Hi ${data.userName},\n\nYour trial extension for ${data.companyName} has been approved!\n\nExtension: ${data.extensionDays} additional days\nNew trial end date: ${data.newTrialEndDate}\n\nEnjoy exploring the platform!`
  }),

  trial_extension_rejected: (data: EmailTemplateData['trial_extension_rejected']) => ({
    subject: `Trial Extension Request for ${data.companyName}`,
    html: wrapTemplate(`
      <div class="header">
        <h1>Extension Request Update</h1>
      </div>
      <div class="content">
        <p>Hi ${data.userName},</p>
        <p>Unfortunately, your trial extension request for <strong>${data.companyName}</strong> could not be approved at this time.</p>
        ${data.reason ? `<div class="highlight"><p><strong>Reason:</strong> ${data.reason}</p></div>` : ''}
        <p>You can still upgrade to continue using all features:</p>
        <p style="text-align: center;">
          <a href="${data.upgradeUrl}" class="button">View Plans</a>
        </p>
      </div>
      <div class="footer">
        <p>Questions? Contact our support team.</p>
      </div>
    `, 'Trial Extension Update'),
    text: `Hi ${data.userName},\n\nYour trial extension request for ${data.companyName} could not be approved.\n\n${data.reason ? `Reason: ${data.reason}\n\n` : ''}View plans: ${data.upgradeUrl}`
  }),

  employee_account_created: (data: EmailTemplateData['employee_account_created']) => ({
    subject: `Your ${data.companyName} Login Credentials`,
    html: wrapTemplate(`
      <div class="header">
        <h1>Welcome to ${data.companyName}!</h1>
      </div>
      <div class="content">
        <p>Hi ${data.employeeName},</p>
        <p>Your user account has been created for <strong>${data.companyName}</strong>.</p>
        <div class="highlight">
          ${data.loginType === 'employee_id' ? `
            <p><strong>Employee ID:</strong> ${data.employeeNumber}</p>
            <p><strong>Company:</strong> ${data.companySlug}</p>
          ` : `
            <p><strong>Email:</strong> (your work email)</p>
          `}
          <p><strong>Temporary Password:</strong> <code style="background: #e5e7eb; padding: 2px 6px; border-radius: 4px;">${data.temporaryPassword}</code></p>
        </div>
        <p><strong>Important:</strong> You will be required to change your password on first login.</p>
        <p style="text-align: center;">
          <a href="${data.loginUrl}" class="button">Login Now</a>
        </p>
        <p style="color: #dc2626; font-size: 14px;"><strong>Security Notice:</strong> Do not share your password with anyone. This email contains sensitive login credentials.</p>
      </div>
      <div class="footer">
        <p>This is an automated message from ${data.companyName}.</p>
      </div>
    `, `Login Credentials - ${data.companyName}`),
    text: `Welcome to ${data.companyName}!\n\nHi ${data.employeeName},\n\nYour user account has been created.\n\n${data.loginType === 'employee_id' ? `Employee ID: ${data.employeeNumber}\nCompany: ${data.companySlug}` : 'Use your work email to login'}\nTemporary Password: ${data.temporaryPassword}\n\nIMPORTANT: You will be required to change your password on first login.\n\nLogin at: ${data.loginUrl}\n\nSecurity Notice: Do not share your password with anyone.`
  }),

  user_reactivated: (data: EmailTemplateData['user_reactivated']) => ({
    subject: `Your ${data.companyName} Account Has Been Reactivated`,
    html: wrapTemplate(`
      <div class="header" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%);">
        <h1>Account Reactivated!</h1>
      </div>
      <div class="content">
        <p>Hi ${data.userName},</p>
        <p>Great news! Your account at <strong>${data.companyName}</strong> has been reactivated.</p>
        <p>For security purposes, your password has been reset. Please use the credentials below to log in:</p>
        <div class="highlight" style="border-left-color: #10b981;">
          <p><strong>Company Code:</strong> <code style="background: #e5e7eb; padding: 2px 6px; border-radius: 4px;">${data.companyCode}</code></p>
          <p><strong>User ID:</strong> <code style="background: #e5e7eb; padding: 2px 6px; border-radius: 4px;">${data.userId}</code></p>
          <p><strong>Email:</strong> ${data.userEmail}</p>
          <p><strong>Temporary Password:</strong> <code style="background: #e5e7eb; padding: 2px 6px; border-radius: 4px;">${data.temporaryPassword}</code></p>
        </div>
        <p><strong>Important:</strong> You will be required to change your password on first login.</p>
        <p style="text-align: center;">
          <a href="${data.loginUrl}" class="button" style="background: #10b981;">Login Now</a>
        </p>
        <p style="color: #dc2626; font-size: 14px;"><strong>Security Notice:</strong> Do not share your password with anyone. If you did not expect this email, please contact your administrator immediately.</p>
      </div>
      <div class="footer">
        <p>This is an automated message from ${data.companyName}.</p>
      </div>
    `, `Account Reactivated - ${data.companyName}`),
    text: `Account Reactivated!\n\nHi ${data.userName},\n\nYour account at ${data.companyName} has been reactivated.\n\nCompany Code: ${data.companyCode}\nUser ID: ${data.userId}\nEmail: ${data.userEmail}\nTemporary Password: ${data.temporaryPassword}\n\nIMPORTANT: You will be required to change your password on first login.\n\nLogin at: ${data.loginUrl}\n\nSecurity Notice: Do not share your password with anyone.`
  }),

  company_onboarding: (data: EmailTemplateData['company_onboarding']) => ({
    subject: `Your ${data.companyName} Account is Ready`,
    html: wrapTemplate(`
      <div class="header" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%);">
        <h1>Welcome to ${data.companyName}!</h1>
      </div>
      <div class="content">
        <p>Hi ${data.adminName},</p>
        <p>Your company <strong>${data.companyName}</strong> has been created and is ready to use.</p>
        <div class="highlight" style="border-left-color: #10b981;">
          <p><strong>Company URL:</strong> <a href="${data.companyUrl}">${data.companyUrl}</a></p>
          <p><strong>Email:</strong> ${data.adminEmail}</p>
          <p><strong>Temporary Password:</strong> <code style="background: #e5e7eb; padding: 2px 6px; border-radius: 4px;">${data.temporaryPassword}</code></p>
          <p><strong>Plan:</strong> ${data.planName}</p>
          ${data.trialDays > 0 ? `<p><strong>Trial Period:</strong> ${data.trialDays} days</p>` : ''}
        </div>
        <p><strong>Important:</strong> You will be required to change your password on first login.</p>
        <p style="text-align: center;">
          <a href="${data.loginUrl}" class="button" style="background: #10b981;">Login Now</a>
        </p>
        <p style="color: #dc2626; font-size: 14px;"><strong>Security Notice:</strong> Do not share your password with anyone.</p>
      </div>
      <div class="footer">
        <p>Welcome aboard! If you need help, contact our support team.</p>
      </div>
    `, `Your ${data.companyName} Account`),
    text: `Welcome to ${data.companyName}!\n\nHi ${data.adminName},\n\nYour company has been created.\n\nCompany URL: ${data.companyUrl}\nEmail: ${data.adminEmail}\nTemporary Password: ${data.temporaryPassword}\nPlan: ${data.planName}${data.trialDays > 0 ? `\nTrial Period: ${data.trialDays} days` : ''}\n\nIMPORTANT: You will be required to change your password on first login.\n\nLogin at: ${data.loginUrl}`
  }),

  company_creation_link: (data: EmailTemplateData['company_creation_link']) => ({
    subject: `You're Invited to Set Up Your Company Account`,
    html: wrapTemplate(`
      <div class="header">
        <h1>Set Up Your Company</h1>
      </div>
      <div class="content">
        <p>Hi there,</p>
        <p>You've been invited by <strong>${data.senderName}</strong> to set up your company account.</p>
        <div class="highlight">
          <p><strong>Plan:</strong> ${data.planName}</p>
          ${data.trialDays > 0 ? `<p><strong>Trial Period:</strong> ${data.trialDays} days</p>` : ''}
          <p><strong>Link expires:</strong> ${data.expiresAt}</p>
        </div>
        <p>Click the button below to get started:</p>
        <p style="text-align: center;">
          <a href="${data.signupUrl}" class="button">Set Up Your Company</a>
        </p>
        <p style="color: #6b7280; font-size: 14px;">This link can only be used once and will expire on ${data.expiresAt}.</p>
      </div>
      <div class="footer">
        <p>If you have questions, please contact the person who sent you this invitation.</p>
      </div>
    `, 'Company Setup Invitation'),
    text: `You're Invited to Set Up Your Company Account\n\nHi there,\n\nYou've been invited by ${data.senderName} to set up your company account.\n\nPlan: ${data.planName}${data.trialDays > 0 ? `\nTrial Period: ${data.trialDays} days` : ''}\n\nSet up your company: ${data.signupUrl}\n\nThis link expires: ${data.expiresAt}`
  }),
};

export function renderTemplate<T extends EmailTemplateType>(
  templateType: T,
  data: EmailTemplateData[T]
): RenderedTemplate {
  const renderer = templates[templateType];
  if (!renderer) {
    throw new Error(`Unknown email template: ${templateType}`);
  }
  return renderer(data);
}
