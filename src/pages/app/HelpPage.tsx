import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { HelpCircle, Info } from 'lucide-react';

export default function HelpPage() {
  const faqs = [
    {
      question: 'How do I add a new employee?',
      answer: 'Navigate to the Employees section and click "Add Employee". Fill in the required information and save.',
    },
    {
      question: 'How do I submit a leave request?',
      answer: 'Go to Leave Management, click "Request Leave", select your dates and leave type, then submit for approval.',
    },
    {
      question: 'How do I change my subscription plan?',
      answer: 'Visit Settings > Billing to view available plans and upgrade or downgrade your subscription.',
    },
    {
      question: 'Can I export my data?',
      answer: 'Yes, most modules support data export. Look for the "Export" button in sections like Employees, Payroll, and Audit Logs.',
    },
    {
      question: 'How do I invite team members?',
      answer: 'Go to Settings > Users & Roles, click "Create User Accounts", enter their email and select their role.',
    },
    {
      question: 'How do I manage user permissions?',
      answer: 'User permissions are based on roles. Admins can change user roles in Settings > Users & Roles, and configure detailed permissions in Settings > Permissions.',
    },
    {
      question: 'How do payroll runs work?',
      answer: 'Create a new payroll run for a period, add employees with their salary details, then process and complete the run to generate payslips.',
    },
    {
      question: 'How do I track time and attendance?',
      answer: 'Use the Time Tracking module to clock in/out, or the Shift Management page to configure shifts and view attendance.',
    },
  ];

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <HelpCircle className="h-6 w-6" />
          Help & Support
        </h1>
        <p className="text-muted-foreground">Get help with using the HR Portal</p>
      </div>

      {/* Info Banner */}
      <Card className="bg-muted/50 border-dashed">
        <CardContent className="py-4">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">Need Assistance?</p>
              <p className="text-sm text-muted-foreground">
                Check the frequently asked questions below for quick answers. For additional support, 
                contact your company administrator or reach out to support through your account settings.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* FAQs */}
      <Card>
        <CardHeader>
          <CardTitle>Frequently Asked Questions</CardTitle>
          <CardDescription>Quick answers to common questions</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {faqs.map((faq, index) => (
            <div key={index} className="border-b last:border-0 pb-4 last:pb-0">
              <h4 className="font-medium mb-1">{faq.question}</h4>
              <p className="text-sm text-muted-foreground">{faq.answer}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
