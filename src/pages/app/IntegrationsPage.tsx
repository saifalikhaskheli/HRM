import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Plug, Clock, CheckCircle,
  CreditCard, MessageSquare, Mail, Calendar, Database,
  FileText, Users, Zap, Info
} from 'lucide-react';
import { ModuleGuard } from '@/components/ModuleGuard';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface Integration {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: any;
  status: 'connected' | 'coming_soon' | 'enterprise';
}

const integrations: Integration[] = [
  {
    id: 'slack',
    name: 'Slack',
    description: 'Send notifications and updates to Slack channels',
    category: 'Communication',
    icon: MessageSquare,
    status: 'coming_soon',
  },
  {
    id: 'microsoft_teams',
    name: 'Microsoft Teams',
    description: 'Integrate with Teams for notifications',
    category: 'Communication',
    icon: MessageSquare,
    status: 'coming_soon',
  },
  {
    id: 'google_calendar',
    name: 'Google Calendar',
    description: 'Sync leave and events with Google Calendar',
    category: 'Calendar',
    icon: Calendar,
    status: 'coming_soon',
  },
  {
    id: 'outlook_calendar',
    name: 'Outlook Calendar',
    description: 'Sync with Microsoft Outlook calendars',
    category: 'Calendar',
    icon: Calendar,
    status: 'coming_soon',
  },
  {
    id: 'stripe',
    name: 'Stripe',
    description: 'Process payroll payments via Stripe',
    category: 'Payments',
    icon: CreditCard,
    status: 'coming_soon',
  },
  {
    id: 'quickbooks',
    name: 'QuickBooks',
    description: 'Export payroll data to QuickBooks',
    category: 'Accounting',
    icon: FileText,
    status: 'coming_soon',
  },
  {
    id: 'xero',
    name: 'Xero',
    description: 'Sync with Xero accounting software',
    category: 'Accounting',
    icon: FileText,
    status: 'coming_soon',
  },
  {
    id: 'zapier',
    name: 'Zapier',
    description: 'Connect with 5000+ apps via Zapier',
    category: 'Automation',
    icon: Zap,
    status: 'coming_soon',
  },
  {
    id: 'webhooks',
    name: 'Webhooks',
    description: 'Send custom webhooks for events',
    category: 'Developer',
    icon: Database,
    status: 'coming_soon',
  },
  {
    id: 'api',
    name: 'REST API',
    description: 'Full API access for custom integrations',
    category: 'Developer',
    icon: Database,
    status: 'enterprise',
  },
  {
    id: 'okta',
    name: 'Okta SSO',
    description: 'Single sign-on with Okta',
    category: 'Authentication',
    icon: Users,
    status: 'enterprise',
  },
  {
    id: 'azure_ad',
    name: 'Azure AD',
    description: 'Microsoft Azure Active Directory SSO',
    category: 'Authentication',
    icon: Users,
    status: 'enterprise',
  },
  {
    id: 'sendgrid',
    name: 'SendGrid',
    description: 'Custom email delivery via SendGrid',
    category: 'Communication',
    icon: Mail,
    status: 'coming_soon',
  },
];

const statusConfig = {
  connected: { label: 'Connected', color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200', icon: CheckCircle },
  coming_soon: { label: 'Coming Soon', color: 'bg-muted text-muted-foreground', icon: Clock },
  enterprise: { label: 'Enterprise', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200', icon: Zap },
};

function IntegrationCard({ integration }: { integration: Integration }) {
  const config = statusConfig[integration.status];
  const Icon = integration.icon;

  return (
    <Card className="opacity-75">
      <CardContent className="pt-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-muted rounded-lg">
              <Icon className="h-6 w-6 text-muted-foreground" />
            </div>
            <div>
              <h3 className="font-semibold">{integration.name}</h3>
              <p className="text-sm text-muted-foreground">{integration.category}</p>
            </div>
          </div>
          <Tooltip>
            <TooltipTrigger>
              <Badge className={config.color}>
                {config.label}
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              {integration.status === 'coming_soon' && 'This integration is planned for a future release'}
              {integration.status === 'enterprise' && 'Available on Enterprise plan'}
            </TooltipContent>
          </Tooltip>
        </div>
        <p className="text-sm text-muted-foreground">{integration.description}</p>
      </CardContent>
    </Card>
  );
}

export default function IntegrationsPage() {
  const categories = [...new Set(integrations.map(i => i.category))];
  const connectedCount = integrations.filter(i => i.status === 'connected').length;

  return (
    <ModuleGuard moduleId="integrations">
      <div className="p-4 md:p-6 space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Integrations</h1>
            <p className="text-muted-foreground">Connect with your favorite tools and services</p>
          </div>
        </div>

        {/* Info Banner */}
        <Card className="bg-muted/50 border-dashed">
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <Info className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">Integrations Coming Soon</p>
                <p className="text-sm text-muted-foreground">
                  We're working on bringing these integrations to you. Check back soon for updates,
                  or contact support if you have specific integration needs.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Connected</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{connectedCount}</div>
              <p className="text-xs text-muted-foreground">Active integrations</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Coming Soon</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {integrations.filter(i => i.status === 'coming_soon').length}
              </div>
              <p className="text-xs text-muted-foreground">In development</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Enterprise</CardTitle>
              <Zap className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {integrations.filter(i => i.status === 'enterprise').length}
              </div>
              <p className="text-xs text-muted-foreground">Upgrade required</p>
            </CardContent>
          </Card>
        </div>

        {/* Integration Categories */}
        {categories.map((category) => (
          <div key={category} className="space-y-4">
            <h2 className="text-lg font-semibold">{category}</h2>
            <div className="grid gap-4 md:grid-cols-3">
              {integrations
                .filter(i => i.category === category)
                .map((integration) => (
                  <IntegrationCard key={integration.id} integration={integration} />
                ))}
            </div>
          </div>
        ))}
      </div>
    </ModuleGuard>
  );
}
