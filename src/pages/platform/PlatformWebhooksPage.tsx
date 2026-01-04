import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { 
  Webhook, 
  Plus, 
  Trash2, 
  Edit, 
  Copy, 
  Eye, 
  EyeOff, 
  CheckCircle2, 
  XCircle, 
  Loader2,
  History,
  RefreshCw
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

const WEBHOOK_EVENTS = [
  { id: 'user.signup', label: 'User Signup', description: 'When a new user signs up' },
  { id: 'user.invited', label: 'User Invited', description: 'When a user is invited to a company' },
  { id: 'company.created', label: 'Company Created', description: 'When a new company is created' },
  { id: 'company.frozen', label: 'Company Frozen', description: 'When a company is frozen' },
  { id: 'company.unfrozen', label: 'Company Unfrozen', description: 'When a company is unfrozen' },
  { id: 'subscription.created', label: 'Subscription Created', description: 'When a subscription is created' },
  { id: 'subscription.updated', label: 'Subscription Updated', description: 'When a subscription changes' },
  { id: 'subscription.canceled', label: 'Subscription Canceled', description: 'When a subscription is canceled' },
  { id: 'leave.submitted', label: 'Leave Submitted', description: 'When a leave request is submitted' },
  { id: 'leave.approved', label: 'Leave Approved', description: 'When a leave request is approved' },
  { id: 'leave.rejected', label: 'Leave Rejected', description: 'When a leave request is rejected' },
  { id: 'payroll.completed', label: 'Payroll Completed', description: 'When payroll processing completes' },
];

interface WebhookData {
  id: string;
  name: string;
  url: string;
  secret: string;
  events: string[];
  is_active: boolean;
  headers: Record<string, string>;
  retry_count: number;
  timeout_seconds: number;
  last_triggered_at: string | null;
  last_status: number | null;
  failure_count: number;
  created_at: string;
}

interface WebhookLog {
  id: string;
  webhook_id: string;
  event_type: string;
  payload: Record<string, unknown>;
  response_status: number | null;
  duration_ms: number | null;
  success: boolean;
  error_message: string | null;
  created_at: string;
}

export default function PlatformWebhooksPage() {
  const queryClient = useQueryClient();
  const [showDialog, setShowDialog] = useState(false);
  const [editingWebhook, setEditingWebhook] = useState<WebhookData | null>(null);
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [showLogsDialog, setShowLogsDialog] = useState(false);
  const [selectedWebhookId, setSelectedWebhookId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    url: '',
    events: [] as string[],
    is_active: true,
    retry_count: 3,
    timeout_seconds: 30,
  });

  const { data: webhooks, isLoading } = useQuery({
    queryKey: ['webhooks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('webhooks')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as WebhookData[];
    },
  });

  const { data: logs, isLoading: logsLoading } = useQuery({
    queryKey: ['webhook-logs', selectedWebhookId],
    queryFn: async () => {
      if (!selectedWebhookId) return [];
      const { data, error } = await supabase
        .from('webhook_logs')
        .select('*')
        .eq('webhook_id', selectedWebhookId)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as WebhookLog[];
    },
    enabled: !!selectedWebhookId,
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { error } = await supabase.from('webhooks').insert({
        name: data.name,
        url: data.url,
        events: data.events,
        is_active: data.is_active,
        retry_count: data.retry_count,
        timeout_seconds: data.timeout_seconds,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Webhook created');
      queryClient.invalidateQueries({ queryKey: ['webhooks'] });
      resetForm();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<WebhookData> }) => {
      const { error } = await supabase.from('webhooks').update(data).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Webhook updated');
      queryClient.invalidateQueries({ queryKey: ['webhooks'] });
      resetForm();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('webhooks').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Webhook deleted');
      queryClient.invalidateQueries({ queryKey: ['webhooks'] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const testMutation = useMutation({
    mutationFn: async (webhookId: string) => {
      const webhook = webhooks?.find(w => w.id === webhookId);
      if (!webhook) throw new Error('Webhook not found');

      const { data, error } = await supabase.functions.invoke('send-webhook', {
        body: {
          event_type: 'test.ping',
          data: {
            message: 'This is a test webhook from your HR platform',
            webhook_id: webhookId,
            webhook_name: webhook.name,
          },
        },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Test webhook sent');
      queryClient.invalidateQueries({ queryKey: ['webhooks'] });
      queryClient.invalidateQueries({ queryKey: ['webhook-logs'] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const resetForm = () => {
    setShowDialog(false);
    setEditingWebhook(null);
    setFormData({
      name: '',
      url: '',
      events: [],
      is_active: true,
      retry_count: 3,
      timeout_seconds: 30,
    });
  };

  const handleEdit = (webhook: WebhookData) => {
    setEditingWebhook(webhook);
    setFormData({
      name: webhook.name,
      url: webhook.url,
      events: webhook.events || [],
      is_active: webhook.is_active,
      retry_count: webhook.retry_count,
      timeout_seconds: webhook.timeout_seconds,
    });
    setShowDialog(true);
  };

  const handleSubmit = () => {
    if (!formData.name || !formData.url || formData.events.length === 0) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (editingWebhook) {
      updateMutation.mutate({ id: editingWebhook.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const toggleEvent = (eventId: string) => {
    setFormData(prev => ({
      ...prev,
      events: prev.events.includes(eventId)
        ? prev.events.filter(e => e !== eventId)
        : [...prev.events, eventId],
    }));
  };

  const copySecret = (secret: string) => {
    navigator.clipboard.writeText(secret);
    toast.success('Secret copied to clipboard');
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Webhooks</h2>
          <p className="text-muted-foreground">Configure webhooks for external integrations</p>
        </div>
        <Button onClick={() => setShowDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Webhook
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Webhook className="h-5 w-5" />
            Configured Webhooks
          </CardTitle>
          <CardDescription>
            Webhooks send HTTP POST requests when events occur in your platform
          </CardDescription>
        </CardHeader>
        <CardContent>
          {webhooks?.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No webhooks configured. Add one to get started.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>URL</TableHead>
                  <TableHead>Events</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Triggered</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {webhooks?.map((webhook) => (
                  <TableRow key={webhook.id}>
                    <TableCell className="font-medium">{webhook.name}</TableCell>
                    <TableCell className="max-w-[200px] truncate text-muted-foreground">
                      {webhook.url}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {webhook.events?.slice(0, 2).map((event) => (
                          <Badge key={event} variant="secondary" className="text-xs">
                            {event}
                          </Badge>
                        ))}
                        {(webhook.events?.length || 0) > 2 && (
                          <Badge variant="outline" className="text-xs">
                            +{webhook.events.length - 2}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {webhook.is_active ? (
                          <Badge variant="default" className="bg-green-500">Active</Badge>
                        ) : (
                          <Badge variant="secondary">Inactive</Badge>
                        )}
                        {webhook.failure_count > 0 && (
                          <Badge variant="destructive">{webhook.failure_count} failures</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {webhook.last_triggered_at ? (
                        <div className="flex items-center gap-1">
                          {webhook.last_status && webhook.last_status >= 200 && webhook.last_status < 300 ? (
                            <CheckCircle2 className="h-3 w-3 text-green-500" />
                          ) : webhook.last_status ? (
                            <XCircle className="h-3 w-3 text-destructive" />
                          ) : null}
                          {formatDistanceToNow(new Date(webhook.last_triggered_at), { addSuffix: true })}
                        </div>
                      ) : (
                        'Never'
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setSelectedWebhookId(webhook.id);
                            setShowLogsDialog(true);
                          }}
                          title="View logs"
                        >
                          <History className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => testMutation.mutate(webhook.id)}
                          disabled={testMutation.isPending}
                          title="Send test"
                        >
                          {testMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <RefreshCw className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setShowSecrets(prev => ({ ...prev, [webhook.id]: !prev[webhook.id] }))}
                          title="Toggle secret"
                        >
                          {showSecrets[webhook.id] ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => copySecret(webhook.secret)}
                          title="Copy secret"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(webhook)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteMutation.mutate(webhook.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      {showSecrets[webhook.id] && (
                        <div className="mt-2 text-left">
                          <code className="text-xs bg-muted px-2 py-1 rounded break-all">
                            {webhook.secret}
                          </code>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={(open) => !open && resetForm()}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingWebhook ? 'Edit Webhook' : 'Create Webhook'}</DialogTitle>
            <DialogDescription>
              Configure a webhook to receive event notifications
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="My Webhook"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="url">Endpoint URL *</Label>
              <Input
                id="url"
                type="url"
                value={formData.url}
                onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                placeholder="https://api.example.com/webhook"
              />
            </div>

            <div className="space-y-2">
              <Label>Events *</Label>
              <p className="text-sm text-muted-foreground">Select events to trigger this webhook</p>
              <div className="grid gap-2 max-h-48 overflow-y-auto border rounded-md p-3">
                {WEBHOOK_EVENTS.map((event) => (
                  <div key={event.id} className="flex items-start space-x-2">
                    <Checkbox
                      id={event.id}
                      checked={formData.events.includes(event.id)}
                      onCheckedChange={() => toggleEvent(event.id)}
                    />
                    <div className="grid gap-0.5 leading-none">
                      <label htmlFor={event.id} className="text-sm font-medium cursor-pointer">
                        {event.label}
                      </label>
                      <p className="text-xs text-muted-foreground">{event.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="timeout">Timeout (seconds)</Label>
                <Input
                  id="timeout"
                  type="number"
                  min={5}
                  max={60}
                  value={formData.timeout_seconds}
                  onChange={(e) => setFormData({ ...formData, timeout_seconds: parseInt(e.target.value) || 30 })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="retries">Retry Count</Label>
                <Input
                  id="retries"
                  type="number"
                  min={0}
                  max={5}
                  value={formData.retry_count}
                  onChange={(e) => setFormData({ ...formData, retry_count: parseInt(e.target.value) || 3 })}
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="active">Active</Label>
                <p className="text-sm text-muted-foreground">Enable or disable this webhook</p>
              </div>
              <Switch
                id="active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={resetForm}>Cancel</Button>
            <Button 
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {(createMutation.isPending || updateMutation.isPending) && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              {editingWebhook ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Logs Dialog */}
      <Dialog open={showLogsDialog} onOpenChange={setShowLogsDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Webhook Logs</DialogTitle>
            <DialogDescription>Recent delivery attempts for this webhook</DialogDescription>
          </DialogHeader>

          {logsLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : logs?.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No logs yet
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Event</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs?.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>
                      <Badge variant="outline">{log.event_type}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {log.success ? (
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                        ) : (
                          <XCircle className="h-4 w-4 text-destructive" />
                        )}
                        {log.response_status || 'Failed'}
                        {log.error_message && (
                          <span className="text-xs text-destructive truncate max-w-[150px]">
                            {log.error_message}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {log.duration_ms ? `${log.duration_ms}ms` : '-'}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
