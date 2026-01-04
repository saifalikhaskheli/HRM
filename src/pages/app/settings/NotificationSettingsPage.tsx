import { useState, useEffect } from 'react';
import { Bell, Mail, AlertTriangle, Shield, Save, Loader2, Users, Calendar, DollarSign, FileText, Briefcase, BarChart3 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { useCompanySetting, useUpdateCompanySetting } from '@/hooks/useCompanySettings';
import { useUserRole } from '@/hooks/useUserRole';
import { toast } from 'sonner';

interface NotificationPreferences {
  // Security (cannot be fully disabled)
  security_alerts_enabled: boolean;
  security_email_enabled: boolean;
  
  // Leave & Time Off
  leave_request_status_enabled: boolean;
  leave_request_status_email: boolean;
  leave_balance_warning_enabled: boolean;
  leave_pending_approval_enabled: boolean;
  leave_pending_approval_email: boolean;
  
  // Payroll
  payslip_available_enabled: boolean;
  payslip_available_email: boolean;
  payroll_run_complete_enabled: boolean;
  
  // Documents
  document_expiry_enabled: boolean;
  document_expiry_email: boolean;
  document_expiry_days: number[];
  document_uploaded_enabled: boolean;
  
  // Recruitment
  application_received_enabled: boolean;
  application_received_email: boolean;
  interview_scheduled_enabled: boolean;
  interview_scheduled_email: boolean;
  
  // Performance
  review_scheduled_enabled: boolean;
  review_scheduled_email: boolean;
  goal_deadline_enabled: boolean;
  
  // Team (Manager+)
  team_attendance_alert_enabled: boolean;
  team_birthday_enabled: boolean;
  
  // System
  onboarding_emails_enabled: boolean;
  company_announcements_enabled: boolean;
}

const DEFAULT_PREFERENCES: NotificationPreferences = {
  security_alerts_enabled: true,
  security_email_enabled: true,
  
  leave_request_status_enabled: true,
  leave_request_status_email: true,
  leave_balance_warning_enabled: true,
  leave_pending_approval_enabled: true,
  leave_pending_approval_email: true,
  
  payslip_available_enabled: true,
  payslip_available_email: true,
  payroll_run_complete_enabled: true,
  
  document_expiry_enabled: true,
  document_expiry_email: true,
  document_expiry_days: [7, 30, 60],
  document_uploaded_enabled: true,
  
  application_received_enabled: true,
  application_received_email: true,
  interview_scheduled_enabled: true,
  interview_scheduled_email: true,
  
  review_scheduled_enabled: true,
  review_scheduled_email: true,
  goal_deadline_enabled: true,
  
  team_attendance_alert_enabled: true,
  team_birthday_enabled: true,
  
  onboarding_emails_enabled: true,
  company_announcements_enabled: true,
};

interface NotificationItemProps {
  id: string;
  label: string;
  description: string;
  enabled: boolean;
  emailEnabled?: boolean;
  onToggle: () => void;
  onEmailToggle?: () => void;
  showEmail?: boolean;
  disabled?: boolean;
}

function NotificationItem({ 
  id, label, description, enabled, emailEnabled, 
  onToggle, onEmailToggle, showEmail = true, disabled = false 
}: NotificationItemProps) {
  return (
    <div className="flex items-center justify-between py-3">
      <div className="space-y-0.5 flex-1">
        <Label htmlFor={id} className={disabled ? 'text-muted-foreground' : ''}>{label}</Label>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="flex items-center gap-4">
        {showEmail && onEmailToggle && (
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <Switch
              id={`${id}-email`}
              checked={emailEnabled ?? false}
              onCheckedChange={onEmailToggle}
              disabled={!enabled || disabled}
            />
          </div>
        )}
        <Switch
          id={id}
          checked={enabled}
          onCheckedChange={onToggle}
          disabled={disabled}
        />
      </div>
    </div>
  );
}

export default function NotificationSettingsPage() {
  const { data: savedPreferences, isLoading } = useCompanySetting('notification_preferences');
  const updateSetting = useUpdateCompanySetting();
  const { role, isManager, isHROrAbove, isCompanyAdmin } = useUserRole();
  
  const [preferences, setPreferences] = useState<NotificationPreferences>(DEFAULT_PREFERENCES);
  const [customDays, setCustomDays] = useState('');
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (savedPreferences?.value) {
      const saved = savedPreferences.value as unknown as NotificationPreferences;
      setPreferences({
        ...DEFAULT_PREFERENCES,
        ...saved,
      });
    }
  }, [savedPreferences]);

  const handleToggle = (key: keyof NotificationPreferences) => {
    setPreferences(prev => ({
      ...prev,
      [key]: !prev[key],
    }));
    setHasChanges(true);
  };

  const handleAddExpiryDay = () => {
    const day = parseInt(customDays);
    if (day > 0 && day <= 365 && !preferences.document_expiry_days.includes(day)) {
      setPreferences(prev => ({
        ...prev,
        document_expiry_days: [...prev.document_expiry_days, day].sort((a, b) => a - b),
      }));
      setCustomDays('');
      setHasChanges(true);
    }
  };

  const handleRemoveExpiryDay = (day: number) => {
    setPreferences(prev => ({
      ...prev,
      document_expiry_days: prev.document_expiry_days.filter(d => d !== day),
    }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    try {
      await updateSetting.mutateAsync({
        key: 'notification_preferences',
        value: preferences as unknown as Record<string, unknown>,
        description: 'Company notification preferences',
      });
      setHasChanges(false);
      toast.success('Notification preferences saved');
    } catch (error) {
      // Error handled by hook
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Notification Preferences</h2>
        <p className="text-sm text-muted-foreground">
          Configure how and when your company receives notifications. Toggle the mail icon to enable email notifications.
        </p>
      </div>

      {/* Security Alerts - Always shown */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Shield className="h-4 w-4" />
            Security Alerts
            <Badge variant="secondary" className="ml-2">Critical</Badge>
          </CardTitle>
          <CardDescription>
            Important security notifications that help protect your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <NotificationItem
            id="security-alerts"
            label="Security Alerts"
            description="Suspicious login attempts, password changes, MFA updates, and session events"
            enabled={preferences.security_alerts_enabled}
            emailEnabled={preferences.security_email_enabled}
            onToggle={() => handleToggle('security_alerts_enabled')}
            onEmailToggle={() => handleToggle('security_email_enabled')}
          />
        </CardContent>
      </Card>

      {/* Leave & Time Off */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Calendar className="h-4 w-4" />
            Leave & Time Off
          </CardTitle>
          <CardDescription>
            Notifications about leave requests and balances
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-1">
          <NotificationItem
            id="leave-status"
            label="Leave Request Status"
            description="Get notified when your leave requests are approved or rejected"
            enabled={preferences.leave_request_status_enabled}
            emailEnabled={preferences.leave_request_status_email}
            onToggle={() => handleToggle('leave_request_status_enabled')}
            onEmailToggle={() => handleToggle('leave_request_status_email')}
          />
          <Separator />
          <NotificationItem
            id="leave-balance"
            label="Low Leave Balance Warning"
            description="Alert when your leave balance falls below threshold"
            enabled={preferences.leave_balance_warning_enabled}
            onToggle={() => handleToggle('leave_balance_warning_enabled')}
            showEmail={false}
          />
          {(isManager || isHROrAbove) && (
            <>
              <Separator />
              <NotificationItem
                id="leave-pending"
                label="Pending Leave Approvals"
                description="Notify when team members submit leave requests for approval"
                enabled={preferences.leave_pending_approval_enabled}
                emailEnabled={preferences.leave_pending_approval_email}
                onToggle={() => handleToggle('leave_pending_approval_enabled')}
                onEmailToggle={() => handleToggle('leave_pending_approval_email')}
              />
            </>
          )}
        </CardContent>
      </Card>

      {/* Payroll & Compensation */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <DollarSign className="h-4 w-4" />
            Payroll & Compensation
          </CardTitle>
          <CardDescription>
            Notifications about payslips and payroll processing
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-1">
          <NotificationItem
            id="payslip-available"
            label="Payslip Available"
            description="Get notified when a new payslip is ready for viewing"
            enabled={preferences.payslip_available_enabled}
            emailEnabled={preferences.payslip_available_email}
            onToggle={() => handleToggle('payslip_available_enabled')}
            onEmailToggle={() => handleToggle('payslip_available_email')}
          />
          {isHROrAbove && (
            <>
              <Separator />
              <NotificationItem
                id="payroll-complete"
                label="Payroll Run Complete"
                description="Notify when payroll processing is completed"
                enabled={preferences.payroll_run_complete_enabled}
                onToggle={() => handleToggle('payroll_run_complete_enabled')}
                showEmail={false}
              />
            </>
          )}
        </CardContent>
      </Card>

      {/* Documents */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-4 w-4" />
            Documents
          </CardTitle>
          <CardDescription>
            Notifications about document uploads and expiration
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <NotificationItem
            id="doc-expiry"
            label="Document Expiry Alerts"
            description="Get notified before your documents expire"
            enabled={preferences.document_expiry_enabled}
            emailEnabled={preferences.document_expiry_email}
            onToggle={() => handleToggle('document_expiry_enabled')}
            onEmailToggle={() => handleToggle('document_expiry_email')}
          />

          {preferences.document_expiry_enabled && (
            <div className="space-y-3 pl-4 border-l-2 border-muted">
              <Label className="text-sm">Notify before expiry (days)</Label>
              <div className="flex flex-wrap gap-2">
                {preferences.document_expiry_days.map(day => (
                  <Button
                    key={day}
                    variant="secondary"
                    size="sm"
                    onClick={() => handleRemoveExpiryDay(day)}
                    className="gap-1"
                  >
                    {day} days
                    <span className="ml-1 text-xs opacity-70">×</span>
                  </Button>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  type="number"
                  placeholder="Add days..."
                  value={customDays}
                  onChange={(e) => setCustomDays(e.target.value)}
                  className="w-32"
                  min={1}
                  max={365}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAddExpiryDay}
                  disabled={!customDays || parseInt(customDays) <= 0}
                >
                  Add
                </Button>
              </div>
            </div>
          )}

          <Separator />
          <NotificationItem
            id="doc-uploaded"
            label="Document Uploaded"
            description="Get notified when new documents are uploaded to your profile"
            enabled={preferences.document_uploaded_enabled}
            onToggle={() => handleToggle('document_uploaded_enabled')}
            showEmail={false}
          />
        </CardContent>
      </Card>

      {/* Recruitment - HR Only */}
      {isHROrAbove && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Briefcase className="h-4 w-4" />
              Recruitment
            </CardTitle>
            <CardDescription>
              Notifications about job applications and interviews
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-1">
            <NotificationItem
              id="application-received"
              label="Application Received"
              description="Get notified when a candidate applies for a job posting"
              enabled={preferences.application_received_enabled}
              emailEnabled={preferences.application_received_email}
              onToggle={() => handleToggle('application_received_enabled')}
              onEmailToggle={() => handleToggle('application_received_email')}
            />
            <Separator />
            <NotificationItem
              id="interview-scheduled"
              label="Interview Scheduled"
              description="Get notified when interviews are scheduled"
              enabled={preferences.interview_scheduled_enabled}
              emailEnabled={preferences.interview_scheduled_email}
              onToggle={() => handleToggle('interview_scheduled_enabled')}
              onEmailToggle={() => handleToggle('interview_scheduled_email')}
            />
          </CardContent>
        </Card>
      )}

      {/* Performance */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BarChart3 className="h-4 w-4" />
            Performance
          </CardTitle>
          <CardDescription>
            Notifications about reviews and goals
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-1">
          <NotificationItem
            id="review-scheduled"
            label="Review Scheduled"
            description="Get notified when performance reviews are scheduled"
            enabled={preferences.review_scheduled_enabled}
            emailEnabled={preferences.review_scheduled_email}
            onToggle={() => handleToggle('review_scheduled_enabled')}
            onEmailToggle={() => handleToggle('review_scheduled_email')}
          />
          <Separator />
          <NotificationItem
            id="goal-deadline"
            label="Goal Deadline Approaching"
            description="Get reminded when goal deadlines are near"
            enabled={preferences.goal_deadline_enabled}
            onToggle={() => handleToggle('goal_deadline_enabled')}
            showEmail={false}
          />
        </CardContent>
      </Card>

      {/* Team Management - Manager+ */}
      {(isManager || isHROrAbove) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4" />
              Team Management
            </CardTitle>
            <CardDescription>
              Notifications about your team members
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-1">
            <NotificationItem
              id="team-attendance"
              label="Team Attendance Alerts"
              description="Get notified about team member attendance issues"
              enabled={preferences.team_attendance_alert_enabled}
              onToggle={() => handleToggle('team_attendance_alert_enabled')}
              showEmail={false}
            />
            <Separator />
            <NotificationItem
              id="team-birthday"
              label="Team Member Birthdays"
              description="Get reminded about upcoming team member birthdays"
              enabled={preferences.team_birthday_enabled}
              onToggle={() => handleToggle('team_birthday_enabled')}
              showEmail={false}
            />
          </CardContent>
        </Card>
      )}

      {/* System Notifications */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Bell className="h-4 w-4" />
            System Notifications
          </CardTitle>
          <CardDescription>
            General system and company-wide notifications
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-1">
          <NotificationItem
            id="onboarding-emails"
            label="Onboarding Emails"
            description="Welcome emails and onboarding guidance for new employees"
            enabled={preferences.onboarding_emails_enabled}
            onToggle={() => handleToggle('onboarding_emails_enabled')}
            showEmail={false}
          />
          <Separator />
          <NotificationItem
            id="announcements"
            label="Company Announcements"
            description="Important company-wide announcements and updates"
            enabled={preferences.company_announcements_enabled}
            onToggle={() => handleToggle('company_announcements_enabled')}
            showEmail={false}
          />
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button
          onClick={handleSave}
          disabled={!hasChanges || updateSetting.isPending}
        >
          {updateSetting.isPending ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Save Preferences
            </>
          )}
        </Button>
      </div>
    </div>
  );
}