import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';
import { Code, Eye, Loader2, Mail, Pencil, Save, Copy, Check } from 'lucide-react';

interface EmailTemplate {
  id: string;
  template_type: string;
  display_name: string;
  description: string | null;
  is_enabled: boolean;
  sender_email: string | null;
  sender_name: string | null;
  subject_template: string | null;
  html_template: string | null;
  plain_text_template: string | null;
  variables: Record<string, string> | null;
}

const DEFAULT_TEMPLATES = [
  { 
    type: 'user_invitation', 
    name: 'User Invitation', 
    description: 'Sent when inviting a new user to the company',
    defaultSubject: 'You have been invited to join {{company_name}}',
    defaultHtml: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h1 style="color: #333;">Welcome to {{company_name}}</h1>
  <p>Hello {{user_name}},</p>
  <p>You have been invited to join {{company_name}}. Click the button below to accept your invitation and set up your account.</p>
  <a href="{{invite_link}}" style="display: inline-block; background-color: #0066cc; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin: 20px 0;">Accept Invitation</a>
  <p>If you have any questions, please contact your administrator.</p>
  <p>Best regards,<br>{{company_name}} Team</p>
</div>`,
    variables: ['company_name', 'user_name', 'invite_link', 'sender_name']
  },
  { 
    type: 'welcome_email', 
    name: 'Welcome Email', 
    description: 'Welcome message for new employees',
    defaultSubject: 'Welcome to {{company_name}}, {{user_name}}!',
    defaultHtml: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h1 style="color: #333;">Welcome aboard, {{user_name}}!</h1>
  <p>We are thrilled to have you join the {{company_name}} team.</p>
  <p>Your employee ID is: <strong>{{employee_id}}</strong></p>
  <p>Your start date is: <strong>{{start_date}}</strong></p>
  <p>If you have any questions, feel free to reach out to your manager or HR team.</p>
  <p>Best regards,<br>{{company_name}} HR Team</p>
</div>`,
    variables: ['company_name', 'user_name', 'employee_id', 'start_date', 'department']
  },
  { 
    type: 'password_reset', 
    name: 'Password Reset', 
    description: 'Password reset instructions',
    defaultSubject: 'Reset your password for {{company_name}}',
    defaultHtml: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h1 style="color: #333;">Password Reset Request</h1>
  <p>Hello {{user_name}},</p>
  <p>We received a request to reset your password. Click the button below to set a new password:</p>
  <a href="{{reset_link}}" style="display: inline-block; background-color: #0066cc; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin: 20px 0;">Reset Password</a>
  <p>This link will expire in 24 hours.</p>
  <p>If you didn't request this, you can safely ignore this email.</p>
</div>`,
    variables: ['company_name', 'user_name', 'reset_link']
  },
  { 
    type: 'leave_request', 
    name: 'Leave Request', 
    description: 'Notification about leave requests',
    defaultSubject: 'Leave Request from {{employee_name}}',
    defaultHtml: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h1 style="color: #333;">New Leave Request</h1>
  <p>Hello {{approver_name}},</p>
  <p><strong>{{employee_name}}</strong> has submitted a leave request:</p>
  <ul>
    <li><strong>Type:</strong> {{leave_type}}</li>
    <li><strong>From:</strong> {{start_date}}</li>
    <li><strong>To:</strong> {{end_date}}</li>
    <li><strong>Days:</strong> {{total_days}}</li>
    <li><strong>Reason:</strong> {{reason}}</li>
  </ul>
  <a href="{{review_link}}" style="display: inline-block; background-color: #0066cc; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin: 20px 0;">Review Request</a>
</div>`,
    variables: ['employee_name', 'approver_name', 'leave_type', 'start_date', 'end_date', 'total_days', 'reason', 'review_link']
  },
  { 
    type: 'leave_approved', 
    name: 'Leave Approved', 
    description: 'Leave request approval notification',
    defaultSubject: 'Your leave request has been approved',
    defaultHtml: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h1 style="color: #28a745;">Leave Request Approved</h1>
  <p>Hello {{employee_name}},</p>
  <p>Your leave request has been <strong style="color: #28a745;">approved</strong>:</p>
  <ul>
    <li><strong>Type:</strong> {{leave_type}}</li>
    <li><strong>From:</strong> {{start_date}}</li>
    <li><strong>To:</strong> {{end_date}}</li>
    <li><strong>Days:</strong> {{total_days}}</li>
  </ul>
  <p>Approved by: {{approver_name}}</p>
</div>`,
    variables: ['employee_name', 'leave_type', 'start_date', 'end_date', 'total_days', 'approver_name']
  },
  { 
    type: 'leave_rejected', 
    name: 'Leave Rejected', 
    description: 'Leave request rejection notification',
    defaultSubject: 'Your leave request has been rejected',
    defaultHtml: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h1 style="color: #dc3545;">Leave Request Rejected</h1>
  <p>Hello {{employee_name}},</p>
  <p>Your leave request has been <strong style="color: #dc3545;">rejected</strong>:</p>
  <ul>
    <li><strong>Type:</strong> {{leave_type}}</li>
    <li><strong>From:</strong> {{start_date}}</li>
    <li><strong>To:</strong> {{end_date}}</li>
  </ul>
  <p><strong>Reason:</strong> {{rejection_reason}}</p>
  <p>Please contact your manager if you have questions.</p>
</div>`,
    variables: ['employee_name', 'leave_type', 'start_date', 'end_date', 'rejection_reason', 'approver_name']
  },
  { 
    type: 'payslip_available', 
    name: 'Payslip Available', 
    description: 'Notification when payslip is ready',
    defaultSubject: 'Your payslip for {{pay_period}} is ready',
    defaultHtml: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h1 style="color: #333;">Payslip Available</h1>
  <p>Hello {{employee_name}},</p>
  <p>Your payslip for <strong>{{pay_period}}</strong> is now available.</p>
  <a href="{{payslip_link}}" style="display: inline-block; background-color: #0066cc; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin: 20px 0;">View Payslip</a>
  <p>If you have any questions about your pay, please contact HR.</p>
</div>`,
    variables: ['employee_name', 'pay_period', 'payslip_link', 'company_name']
  },
  { 
    type: 'document_expiry', 
    name: 'Document Expiry', 
    description: 'Document expiration warning',
    defaultSubject: 'Document Expiring Soon: {{document_name}}',
    defaultHtml: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h1 style="color: #ffc107;">Document Expiring Soon</h1>
  <p>Hello {{employee_name}},</p>
  <p>The following document is expiring soon and needs to be renewed:</p>
  <ul>
    <li><strong>Document:</strong> {{document_name}}</li>
    <li><strong>Expiry Date:</strong> {{expiry_date}}</li>
    <li><strong>Days Until Expiry:</strong> {{days_remaining}}</li>
  </ul>
  <p>Please upload a renewed version before the expiry date.</p>
</div>`,
    variables: ['employee_name', 'document_name', 'expiry_date', 'days_remaining']
  },
  { 
    type: 'interview_scheduled', 
    name: 'Interview Scheduled', 
    description: 'Interview scheduling notification',
    defaultSubject: 'Interview Scheduled: {{job_title}} at {{company_name}}',
    defaultHtml: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h1 style="color: #333;">Interview Scheduled</h1>
  <p>Hello {{candidate_name}},</p>
  <p>Your interview for the <strong>{{job_title}}</strong> position has been scheduled:</p>
  <ul>
    <li><strong>Date:</strong> {{interview_date}}</li>
    <li><strong>Time:</strong> {{interview_time}}</li>
    <li><strong>Location:</strong> {{location}}</li>
    <li><strong>Interviewer:</strong> {{interviewer_name}}</li>
  </ul>
  <p>Please confirm your attendance by replying to this email.</p>
</div>`,
    variables: ['candidate_name', 'job_title', 'company_name', 'interview_date', 'interview_time', 'location', 'interviewer_name']
  },
  { 
    type: 'offer_letter', 
    name: 'Offer Letter', 
    description: 'Job offer email to candidates',
    defaultSubject: 'Job Offer: {{job_title}} at {{company_name}}',
    defaultHtml: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h1 style="color: #28a745;">Congratulations!</h1>
  <p>Dear {{candidate_name}},</p>
  <p>We are pleased to offer you the position of <strong>{{job_title}}</strong> at {{company_name}}.</p>
  <p>Please review the attached offer letter and let us know your decision within {{response_deadline}}.</p>
  <a href="{{offer_link}}" style="display: inline-block; background-color: #28a745; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin: 20px 0;">View Offer</a>
</div>`,
    variables: ['candidate_name', 'job_title', 'company_name', 'response_deadline', 'offer_link']
  },
  { 
    type: 'security_alert', 
    name: 'Security Alert', 
    description: 'Security-related notifications',
    defaultSubject: 'Security Alert: {{alert_type}}',
    defaultHtml: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h1 style="color: #dc3545;">Security Alert</h1>
  <p>Hello {{user_name}},</p>
  <p>We detected the following security event on your account:</p>
  <ul>
    <li><strong>Event:</strong> {{alert_type}}</li>
    <li><strong>Time:</strong> {{event_time}}</li>
    <li><strong>Location:</strong> {{location}}</li>
    <li><strong>Device:</strong> {{device}}</li>
  </ul>
  <p>If this wasn't you, please secure your account immediately.</p>
</div>`,
    variables: ['user_name', 'alert_type', 'event_time', 'location', 'device']
  },
];

export function EmailTemplatesSection() {
  const { companyId } = useTenant();
  const queryClient = useQueryClient();
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<EmailTemplate | null>(null);
  
  // Edit form state
  const [editSenderEmail, setEditSenderEmail] = useState('');
  const [editSenderName, setEditSenderName] = useState('');
  const [editSubject, setEditSubject] = useState('');
  const [editHtml, setEditHtml] = useState('');
  const [editPlainText, setEditPlainText] = useState('');
  const [editTab, setEditTab] = useState<'html' | 'preview'>('html');
  const [copiedVar, setCopiedVar] = useState<string | null>(null);

  // Fetch existing templates
  const { data: templates, isLoading } = useQuery({
    queryKey: ['company-email-templates', companyId],
    queryFn: async () => {
      if (!companyId) return [];

      const { data, error } = await supabase
        .from('company_email_templates')
        .select('*')
        .eq('company_id', companyId);

      if (error) throw error;
      return data as EmailTemplate[];
    },
    enabled: !!companyId,
  });

  // Merge with defaults
  const mergedTemplates = DEFAULT_TEMPLATES.map((def) => {
    const existing = templates?.find((t) => t.template_type === def.type);
    return existing || {
      id: '',
      template_type: def.type,
      display_name: def.name,
      description: def.description,
      is_enabled: true,
      sender_email: null,
      sender_name: null,
      subject_template: def.defaultSubject,
      html_template: def.defaultHtml,
      plain_text_template: null,
      variables: def.variables.reduce((acc, v) => ({ ...acc, [v]: `{{${v}}}` }), {}),
    };
  });

  // Toggle template enabled/disabled
  const toggleMutation = useMutation({
    mutationFn: async ({ templateType, enabled }: { templateType: string; enabled: boolean }) => {
      if (!companyId) throw new Error('No company');

      const def = DEFAULT_TEMPLATES.find((d) => d.type === templateType);
      
      const { error } = await supabase
        .from('company_email_templates')
        .upsert({
          company_id: companyId,
          template_type: templateType,
          display_name: def?.name || templateType,
          description: def?.description || null,
          is_enabled: enabled,
        }, {
          onConflict: 'company_id,template_type',
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-email-templates', companyId] });
    },
    onError: () => {
      toast.error('Failed to update template');
    },
  });

  // Save template settings
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!companyId || !editingTemplate) throw new Error('No data');

      const def = DEFAULT_TEMPLATES.find((d) => d.type === editingTemplate.template_type);

      const { error } = await supabase
        .from('company_email_templates')
        .upsert({
          company_id: companyId,
          template_type: editingTemplate.template_type,
          display_name: def?.name || editingTemplate.template_type,
          description: def?.description || null,
          is_enabled: editingTemplate.is_enabled,
          sender_email: editSenderEmail || null,
          sender_name: editSenderName || null,
          subject_template: editSubject || null,
          html_template: editHtml || null,
          plain_text_template: editPlainText || null,
        }, {
          onConflict: 'company_id,template_type',
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-email-templates', companyId] });
      toast.success('Template saved successfully');
      setEditingTemplate(null);
    },
    onError: () => {
      toast.error('Failed to save template');
    },
  });

  const openEdit = (template: EmailTemplate) => {
    const def = DEFAULT_TEMPLATES.find(d => d.type === template.template_type);
    setEditingTemplate(template);
    setEditSenderEmail(template.sender_email || '');
    setEditSenderName(template.sender_name || '');
    setEditSubject(template.subject_template || def?.defaultSubject || '');
    setEditHtml(template.html_template || def?.defaultHtml || '');
    setEditPlainText(template.plain_text_template || '');
    setEditTab('html');
  };

  const copyVariable = (variable: string) => {
    navigator.clipboard.writeText(`{{${variable}}}`);
    setCopiedVar(variable);
    setTimeout(() => setCopiedVar(null), 2000);
  };

  const getPreviewHtml = () => {
    let html = editHtml;
    // Replace variables with sample data for preview
    html = html.replace(/\{\{company_name\}\}/g, 'Acme Corporation');
    html = html.replace(/\{\{user_name\}\}/g, 'John Doe');
    html = html.replace(/\{\{employee_name\}\}/g, 'John Doe');
    html = html.replace(/\{\{candidate_name\}\}/g, 'Jane Smith');
    html = html.replace(/\{\{job_title\}\}/g, 'Software Engineer');
    html = html.replace(/\{\{start_date\}\}/g, 'January 15, 2026');
    html = html.replace(/\{\{end_date\}\}/g, 'January 20, 2026');
    html = html.replace(/\{\{leave_type\}\}/g, 'Annual Leave');
    html = html.replace(/\{\{total_days\}\}/g, '5');
    html = html.replace(/\{\{approver_name\}\}/g, 'Manager Smith');
    html = html.replace(/\{\{invite_link\}\}/g, '#');
    html = html.replace(/\{\{reset_link\}\}/g, '#');
    html = html.replace(/\{\{review_link\}\}/g, '#');
    html = html.replace(/\{\{payslip_link\}\}/g, '#');
    html = html.replace(/\{\{offer_link\}\}/g, '#');
    html = html.replace(/\{\{employee_id\}\}/g, 'EMP-001');
    html = html.replace(/\{\{department\}\}/g, 'Engineering');
    html = html.replace(/\{\{pay_period\}\}/g, 'December 2025');
    html = html.replace(/\{\{document_name\}\}/g, 'Passport');
    html = html.replace(/\{\{expiry_date\}\}/g, 'February 1, 2026');
    html = html.replace(/\{\{days_remaining\}\}/g, '30');
    html = html.replace(/\{\{interview_date\}\}/g, 'January 10, 2026');
    html = html.replace(/\{\{interview_time\}\}/g, '10:00 AM');
    html = html.replace(/\{\{location\}\}/g, 'Office - Meeting Room A');
    html = html.replace(/\{\{interviewer_name\}\}/g, 'HR Manager');
    html = html.replace(/\{\{response_deadline\}\}/g, '7 days');
    html = html.replace(/\{\{rejection_reason\}\}/g, 'Team capacity constraints');
    html = html.replace(/\{\{reason\}\}/g, 'Family vacation');
    html = html.replace(/\{\{sender_name\}\}/g, 'HR Team');
    html = html.replace(/\{\{alert_type\}\}/g, 'New Login');
    html = html.replace(/\{\{event_time\}\}/g, 'January 2, 2026 at 3:45 PM');
    html = html.replace(/\{\{device\}\}/g, 'Chrome on Windows');
    return html;
  };

  const getCurrentVariables = () => {
    const def = DEFAULT_TEMPLATES.find(d => d.type === editingTemplate?.template_type);
    return def?.variables || [];
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Email Templates</h3>
        <p className="text-sm text-muted-foreground">
          Configure which emails are sent and customize their content
        </p>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Template</TableHead>
                <TableHead>Sender</TableHead>
                <TableHead className="text-center">Enabled</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mergedTemplates.map((template) => (
                <TableRow key={template.template_type}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{template.display_name}</p>
                      <p className="text-xs text-muted-foreground">{template.description}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    {template.sender_email ? (
                      <div className="text-sm">
                        <p>{template.sender_name || 'No name'}</p>
                        <p className="text-muted-foreground">{template.sender_email}</p>
                      </div>
                    ) : (
                      <Badge variant="secondary">Default</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    <Switch
                      checked={template.is_enabled}
                      onCheckedChange={(checked) =>
                        toggleMutation.mutate({ templateType: template.template_type, enabled: checked })
                      }
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setPreviewTemplate(template)}
                        title="Preview"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEdit(template)}
                        title="Edit"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={!!editingTemplate} onOpenChange={() => setEditingTemplate(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit {editingTemplate?.display_name}</DialogTitle>
            <DialogDescription>
              Customize the email template content and sender information
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Sender Settings */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="sender-name">Sender Name</Label>
                <Input
                  id="sender-name"
                  value={editSenderName}
                  onChange={(e) => setEditSenderName(e.target.value)}
                  placeholder="e.g., HR Department"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sender-email">Sender Email</Label>
                <Input
                  id="sender-email"
                  type="email"
                  value={editSenderEmail}
                  onChange={(e) => setEditSenderEmail(e.target.value)}
                  placeholder="e.g., hr@company.com"
                />
              </div>
            </div>

            {/* Subject Line */}
            <div className="space-y-2">
              <Label htmlFor="subject">Subject Line</Label>
              <Input
                id="subject"
                value={editSubject}
                onChange={(e) => setEditSubject(e.target.value)}
                placeholder="Email subject with {{variables}}"
              />
              <p className="text-xs text-muted-foreground">
                Use variables like {'{{company_name}}'} to personalize the subject
              </p>
            </div>

            {/* Available Variables */}
            <div className="space-y-2">
              <Label>Available Variables</Label>
              <div className="flex flex-wrap gap-2">
                {getCurrentVariables().map((variable) => (
                  <Button
                    key={variable}
                    variant="outline"
                    size="sm"
                    onClick={() => copyVariable(variable)}
                    className="text-xs h-7"
                  >
                    {copiedVar === variable ? (
                      <Check className="h-3 w-3 mr-1" />
                    ) : (
                      <Copy className="h-3 w-3 mr-1" />
                    )}
                    {`{{${variable}}}`}
                  </Button>
                ))}
              </div>
            </div>

            {/* HTML Editor with Preview */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Email Body</Label>
                <Tabs value={editTab} onValueChange={(v) => setEditTab(v as 'html' | 'preview')}>
                  <TabsList className="h-8">
                    <TabsTrigger value="html" className="text-xs h-7 px-3">
                      <Code className="h-3 w-3 mr-1" />
                      HTML
                    </TabsTrigger>
                    <TabsTrigger value="preview" className="text-xs h-7 px-3">
                      <Eye className="h-3 w-3 mr-1" />
                      Preview
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
              
              {editTab === 'html' ? (
                <Textarea
                  value={editHtml}
                  onChange={(e) => setEditHtml(e.target.value)}
                  placeholder="Enter HTML content..."
                  className="font-mono text-sm min-h-[300px]"
                />
              ) : (
                <div className="border rounded-lg p-4 bg-muted/30 min-h-[300px]">
                  <div 
                    className="bg-background rounded p-4"
                    dangerouslySetInnerHTML={{ __html: getPreviewHtml() }}
                  />
                </div>
              )}
            </div>

            {/* Plain Text Version (Optional) */}
            <div className="space-y-2">
              <Label htmlFor="plain-text">Plain Text Version (Optional)</Label>
              <Textarea
                id="plain-text"
                value={editPlainText}
                onChange={(e) => setEditPlainText(e.target.value)}
                placeholder="Plain text version for email clients that don't support HTML..."
                className="min-h-[100px]"
              />
              <p className="text-xs text-muted-foreground">
                Leave empty to auto-generate from HTML
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingTemplate(null)}>
              Cancel
            </Button>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              <Save className="h-4 w-4 mr-2" />
              Save Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={!!previewTemplate} onOpenChange={() => setPreviewTemplate(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Preview: {previewTemplate?.display_name}</DialogTitle>
            <DialogDescription>
              This is how the email will look with sample data
            </DialogDescription>
          </DialogHeader>

          <div className="border rounded-lg p-6 bg-muted/30">
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm">
                <Mail className="h-4 w-4" />
                <span className="font-medium">From:</span>
                <span>
                  {previewTemplate?.sender_name || 'Company Name'} &lt;
                  {previewTemplate?.sender_email || 'noreply@company.com'}&gt;
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="font-medium">Subject:</span>
                <span>
                  {previewTemplate?.subject_template?.replace(/\{\{company_name\}\}/g, 'Acme Corporation')
                    .replace(/\{\{user_name\}\}/g, 'John Doe')
                    .replace(/\{\{employee_name\}\}/g, 'John Doe')
                    .replace(/\{\{job_title\}\}/g, 'Software Engineer')
                    .replace(/\{\{pay_period\}\}/g, 'December 2025')
                    .replace(/\{\{document_name\}\}/g, 'Passport')
                    .replace(/\{\{alert_type\}\}/g, 'New Login')
                    || `[${previewTemplate?.display_name}]`}
                </span>
              </div>
              <div className="border-t pt-4">
                {previewTemplate?.html_template ? (
                  <div 
                    className="bg-background rounded p-4"
                    dangerouslySetInnerHTML={{ 
                      __html: previewTemplate.html_template
                        .replace(/\{\{company_name\}\}/g, 'Acme Corporation')
                        .replace(/\{\{user_name\}\}/g, 'John Doe')
                        .replace(/\{\{employee_name\}\}/g, 'John Doe')
                        .replace(/\{\{candidate_name\}\}/g, 'Jane Smith')
                        .replace(/\{\{job_title\}\}/g, 'Software Engineer')
                        .replace(/\{\{start_date\}\}/g, 'January 15, 2026')
                        .replace(/\{\{end_date\}\}/g, 'January 20, 2026')
                        .replace(/\{\{leave_type\}\}/g, 'Annual Leave')
                        .replace(/\{\{total_days\}\}/g, '5')
                        .replace(/\{\{approver_name\}\}/g, 'Manager Smith')
                        .replace(/\{\{invite_link\}\}/g, '#')
                        .replace(/\{\{reset_link\}\}/g, '#')
                        .replace(/\{\{employee_id\}\}/g, 'EMP-001')
                        .replace(/\{\{pay_period\}\}/g, 'December 2025')
                        .replace(/\{\{document_name\}\}/g, 'Passport')
                        .replace(/\{\{expiry_date\}\}/g, 'February 1, 2026')
                        .replace(/\{\{days_remaining\}\}/g, '30')
                    }}
                  />
                ) : (
                  <div className="bg-background rounded p-4 text-center text-muted-foreground">
                    <p>No custom template configured</p>
                    <p className="text-xs mt-2">
                      Click Edit to customize this template
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setPreviewTemplate(null);
              if (previewTemplate) openEdit(previewTemplate);
            }}>
              <Pencil className="h-4 w-4 mr-2" />
              Edit Template
            </Button>
            <Button onClick={() => setPreviewTemplate(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}