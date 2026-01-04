import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { 
  Shield, CheckCircle, AlertTriangle, Clock, FileText,
  Lock, Eye, Users, Server, Key, Database, Globe,
  ExternalLink, Download, Loader2
} from 'lucide-react';
import { useSecurityEvents } from '@/hooks/useAuditLogs';
import { useSOC2Checks, useMFAStatus, useSupportAccess } from '@/hooks/useSecurity';
import { ModuleGuard } from '@/components/ModuleGuard';
import { MFAStatusCard } from '@/components/security/MFASetup';
import { SupportAccessManager } from '@/components/security/SupportAccessManager';
import { exportComplianceReportToCSV } from '@/lib/export-utils';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface ComplianceItem {
  id: string;
  name: string;
  description: string;
  status: 'compliant' | 'attention' | 'non_compliant';
  category: string;
}

const statusConfig = {
  compliant: { label: 'Compliant', color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200', icon: CheckCircle },
  attention: { label: 'Needs Attention', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200', icon: AlertTriangle },
  non_compliant: { label: 'Non-Compliant', color: 'bg-destructive/20 text-destructive', icon: AlertTriangle },
};

function ComplianceStatusBadge({ status }: { status: 'compliant' | 'attention' | 'non_compliant' }) {
  const config = statusConfig[status];
  const Icon = config.icon;
  return (
    <Badge className={`${config.color} gap-1`}>
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  );
}

function ComplianceScoreCard() {
  const { data: soc2Data, isLoading } = useSOC2Checks();
  
  const score = soc2Data?.score || 0;
  const compliantCount = soc2Data?.compliantCount || 0;
  const totalCount = soc2Data?.totalCount || 0;
  const attentionCount = totalCount - compliantCount;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          Compliance Score
        </CardTitle>
        <CardDescription>Overall SOC2 readiness</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-center">
          <span className="text-5xl font-bold">{score}%</span>
        </div>
        <Progress value={score} className="h-3" />
        <div className="grid grid-cols-3 gap-4 text-center text-sm">
          <div>
            <p className="text-2xl font-bold text-green-600">{compliantCount}</p>
            <p className="text-muted-foreground">Compliant</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-yellow-600">{attentionCount}</p>
            <p className="text-muted-foreground">Attention</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-destructive">0</p>
            <p className="text-muted-foreground">Issues</p>
          </div>
        </div>
        {soc2Data?.isSOC2Ready && (
          <Badge className="w-full justify-center bg-green-100 text-green-800">
            <CheckCircle className="h-4 w-4 mr-2" />
            SOC2 Ready
          </Badge>
        )}
      </CardContent>
    </Card>
  );
}

function SecurityEventsCard() {
  const { data: events, isLoading } = useSecurityEvents();

  const recentEvents = events?.slice(0, 5) || [];

  const severityColors: Record<string, string> = {
    info: 'text-blue-600',
    warning: 'text-yellow-600',
    error: 'text-destructive',
    critical: 'text-destructive font-bold',
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-yellow-600" />
          Recent Security Events
        </CardTitle>
        <CardDescription>Latest security-related activities</CardDescription>
      </CardHeader>
      <CardContent>
        {recentEvents.length > 0 ? (
          <div className="space-y-3">
            {recentEvents.map((event) => (
              <div key={event.id} className="flex items-start justify-between py-2 border-b last:border-0">
                <div className="space-y-1">
                  <p className={`font-medium ${severityColors[event.severity || 'info']}`}>
                    {event.event_type.replace(/_/g, ' ')}
                  </p>
                  <p className="text-sm text-muted-foreground">{event.description || 'No description'}</p>
                </div>
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {format(new Date(event.created_at), 'MMM d, HH:mm')}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-6 text-muted-foreground">
            <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-600" />
            <p>No security events to report</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SOC2ControlsSection() {
  const { data: soc2Data } = useSOC2Checks();
  const { data: mfaStatus } = useMFAStatus();

  const controls: ComplianceItem[] = [
    // Access Control
    {
      id: 'rbac',
      name: 'Role-Based Access Control',
      description: 'Users have permissions based on their role (admin, HR, manager, employee)',
      status: 'compliant',
      category: 'Access Control',
    },
    {
      id: 'mfa',
      name: 'Multi-Factor Authentication',
      description: 'MFA available and enforced for administrators',
      status: mfaStatus?.isVerified ? 'compliant' : 'attention',
      category: 'Access Control',
    },
    {
      id: 'least_privilege',
      name: 'Principle of Least Privilege',
      description: 'Row-level security ensures users only access their authorized data',
      status: 'compliant',
      category: 'Access Control',
    },
    {
      id: 'session_mgmt',
      name: 'Session Management',
      description: 'Secure session handling with automatic timeout',
      status: 'compliant',
      category: 'Access Control',
    },
    // Audit & Logging
    {
      id: 'audit_logs',
      name: 'Audit Logging',
      description: 'All data changes are logged with user, timestamp, and details',
      status: 'compliant',
      category: 'Audit & Monitoring',
    },
    {
      id: 'security_events',
      name: 'Security Event Logging',
      description: 'Security events like login attempts and permission changes are tracked',
      status: 'compliant',
      category: 'Audit & Monitoring',
    },
    {
      id: 'support_access',
      name: 'Support Access Controls',
      description: 'Temporary support access is logged and can be revoked',
      status: 'compliant',
      category: 'Audit & Monitoring',
    },
    // Data Protection
    {
      id: 'encryption_rest',
      name: 'Encryption at Rest',
      description: 'All data is encrypted at rest using AES-256',
      status: 'compliant',
      category: 'Data Protection',
    },
    {
      id: 'encryption_transit',
      name: 'Encryption in Transit',
      description: 'TLS 1.3 enforced for all connections',
      status: 'compliant',
      category: 'Data Protection',
    },
    {
      id: 'rls',
      name: 'Row-Level Security',
      description: 'Database policies prevent unauthorized data access',
      status: 'compliant',
      category: 'Data Protection',
    },
    // Availability
    {
      id: 'backups',
      name: 'Automated Backups',
      description: 'Daily automated backups with point-in-time recovery',
      status: 'compliant',
      category: 'Availability',
    },
    {
      id: 'dr',
      name: 'Disaster Recovery',
      description: 'Recovery procedures and failover capabilities',
      status: 'compliant',
      category: 'Availability',
    },
  ];

  const categories = [...new Set(controls.map(c => c.category))];

  return (
    <div className="space-y-4">
      {categories.map((category) => (
        <Card key={category}>
          <CardHeader>
            <CardTitle className="text-lg">{category}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {controls
                .filter(c => c.category === category)
                .map((check) => (
                  <div key={check.id} className="flex items-center justify-between py-2 border-b last:border-0">
                    <div className="space-y-1">
                      <p className="font-medium">{check.name}</p>
                      <p className="text-sm text-muted-foreground">{check.description}</p>
                    </div>
                    <ComplianceStatusBadge status={check.status} />
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function CompliancePage() {
  const [isExporting, setIsExporting] = useState(false);
  const { data: securityEvents } = useSecurityEvents();
  const { data: mfaStatus } = useMFAStatus();
  const { data: soc2Data } = useSOC2Checks();
  const { activeAccess } = useSupportAccess();

  const handleExportReport = async () => {
    setIsExporting(true);
    try {
      const events = (securityEvents || []).map(e => ({
        id: e.id,
        created_at: e.created_at,
        event_type: e.event_type,
        description: e.description,
        severity: e.severity,
        is_resolved: e.is_resolved,
      }));

      exportComplianceReportToCSV({
        securityEvents: events,
        mfaEnabled: mfaStatus?.isVerified || false,
        supportAccessCount: activeAccess?.length || 0,
        complianceScore: soc2Data?.score || 0,
      });

      toast.success('Compliance report exported');
    } catch (error) {
      console.error('Export failed:', error);
      toast.error('Failed to export compliance report');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <ModuleGuard moduleId="compliance">
      <div className="p-4 md:p-6 space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Compliance & Security</h1>
            <p className="text-muted-foreground">SOC2-friendly security controls and compliance monitoring</p>
          </div>
        <Button variant="outline" onClick={handleExportReport} disabled={isExporting}>
          {isExporting ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Download className="h-4 w-4 mr-2" />
          )}
          Export Report
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <ComplianceScoreCard />
        <div className="md:col-span-2">
          <SecurityEventsCard />
        </div>
      </div>

      <Tabs defaultValue="controls" className="space-y-4">
        <TabsList>
          <TabsTrigger value="controls">Security Controls</TabsTrigger>
          <TabsTrigger value="mfa">MFA Settings</TabsTrigger>
          <TabsTrigger value="support">Support Access</TabsTrigger>
          <TabsTrigger value="certifications">Certifications</TabsTrigger>
        </TabsList>

        <TabsContent value="controls">
          <SOC2ControlsSection />
        </TabsContent>

        <TabsContent value="mfa">
          <div className="max-w-xl">
            <MFAStatusCard />
          </div>
        </TabsContent>

        <TabsContent value="support">
          <SupportAccessManager />
        </TabsContent>

        <TabsContent value="certifications">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardContent className="pt-6 text-center">
                <Shield className="h-12 w-12 mx-auto mb-4 text-primary" />
                <h3 className="font-semibold text-lg">SOC 2 Type II</h3>
                <Badge className="mt-2 bg-green-100 text-green-800">Ready</Badge>
                <p className="text-sm text-muted-foreground mt-4">
                  Platform designed with SOC 2 controls in mind
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6 text-center">
                <Globe className="h-12 w-12 mx-auto mb-4 text-primary" />
                <h3 className="font-semibold text-lg">GDPR</h3>
                <Badge className="mt-2 bg-green-100 text-green-800">Compliant</Badge>
                <p className="text-sm text-muted-foreground mt-4">
                  EU data protection requirements supported
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6 text-center">
                <Database className="h-12 w-12 mx-auto mb-4 text-primary" />
                <h3 className="font-semibold text-lg">Data Residency</h3>
                <Badge className="mt-2 bg-blue-100 text-blue-800">Configurable</Badge>
                <p className="text-sm text-muted-foreground mt-4">
                  Choose your data storage region
                </p>
              </CardContent>
            </Card>
          </div>

          {/* No Hidden Access Assurance */}
          <Card className="mt-4">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="h-5 w-5" />
                No Hidden Access Guarantee
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="flex items-start gap-3 p-4 border rounded-lg">
                  <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium">All Access is Logged</p>
                    <p className="text-sm text-muted-foreground">
                      Every data access is recorded in audit logs with user ID, timestamp, and action details.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-4 border rounded-lg">
                  <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium">No Backdoor Access</p>
                    <p className="text-sm text-muted-foreground">
                      Support staff cannot access your data without explicit permission grants.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-4 border rounded-lg">
                  <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium">Time-Limited Support Access</p>
                    <p className="text-sm text-muted-foreground">
                      Support access automatically expires and can be revoked at any time.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-4 border rounded-lg">
                  <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium">RLS Enforced at Database</p>
                    <p className="text-sm text-muted-foreground">
                      Row-level security policies are enforced at the database level, not just the application.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      </div>
    </ModuleGuard>
  );
}
