import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { format, formatDistanceToNow, isPast, addHours } from 'date-fns';
import { 
  Link, 
  Copy, 
  MoreHorizontal, 
  Clock, 
  Mail, 
  Trash2, 
  RefreshCw,
  ExternalLink,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface CompanyLink {
  id: string;
  token: string;
  email: string | null;
  plan_id: string | null;
  enable_trial: boolean | null;
  trial_days: number | null;
  expires_at: string;
  uses: number | null;
  max_uses: number | null;
  used_at: string | null;
  used_by_company_id: string | null;
  notes: string | null;
  created_at: string;
  plan?: { name: string } | null;
  used_company?: { name: string; slug: string } | null;
}

interface CompanyLinksManagerProps {
  onCreateNew: () => void;
}

export function CompanyLinksManager({ onCreateNew }: CompanyLinksManagerProps) {
  const queryClient = useQueryClient();
  const [extendDialogOpen, setExtendDialogOpen] = useState(false);
  const [selectedLink, setSelectedLink] = useState<CompanyLink | null>(null);
  const [extendHours, setExtendHours] = useState(72);

  const { data: links, isLoading } = useQuery({
    queryKey: ['company-creation-links'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('company_creation_links')
        .select(`
          id,
          token,
          email,
          plan_id,
          enable_trial,
          trial_days,
          expires_at,
          uses,
          max_uses,
          used_at,
          used_by_company_id,
          notes,
          created_at
        `)
        .order('created_at', { ascending: false })
        .limit(50);
      
      if (error) throw error;

      // Fetch plan names
      const planIds = [...new Set(data.filter(l => l.plan_id).map(l => l.plan_id))];
      const { data: plans } = await supabase
        .from('plans')
        .select('id, name')
        .in('id', planIds.length > 0 ? planIds : ['none']);

      // Fetch company names for used links
      const companyIds = [...new Set(data.filter(l => l.used_by_company_id).map(l => l.used_by_company_id))];
      const { data: companies } = await supabase
        .from('companies')
        .select('id, name, slug')
        .in('id', companyIds.length > 0 ? companyIds : ['none']);

      return data.map(link => ({
        ...link,
        plan: plans?.find(p => p.id === link.plan_id),
        used_company: companies?.find(c => c.id === link.used_by_company_id),
      })) as CompanyLink[];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (linkId: string) => {
      const { error } = await supabase
        .from('company_creation_links')
        .delete()
        .eq('id', linkId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Link revoked');
      queryClient.invalidateQueries({ queryKey: ['company-creation-links'] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const extendMutation = useMutation({
    mutationFn: async ({ linkId, hours }: { linkId: string; hours: number }) => {
      const link = links?.find(l => l.id === linkId);
      if (!link) throw new Error('Link not found');

      const baseDate = isPast(new Date(link.expires_at)) ? new Date() : new Date(link.expires_at);
      const newExpiry = addHours(baseDate, hours);

      const { error } = await supabase
        .from('company_creation_links')
        .update({ expires_at: newExpiry.toISOString() })
        .eq('id', linkId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Link extended');
      setExtendDialogOpen(false);
      setSelectedLink(null);
      queryClient.invalidateQueries({ queryKey: ['company-creation-links'] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const resendEmailMutation = useMutation({
    mutationFn: async (link: CompanyLink) => {
      if (!link.email) throw new Error('No email address on this link');

      // Get current user for sender info
      const { data: { user } } = await supabase.auth.getUser();
      
      // Fetch plan name
      let planName = 'Standard';
      if (link.plan_id) {
        const { data: plan } = await supabase
          .from('plans')
          .select('name')
          .eq('id', link.plan_id)
          .single();
        if (plan) planName = plan.name;
      }

      // Get base domain
      const baseDomain = window.location.hostname.includes('localhost') 
        ? 'localhost:8080' 
        : window.location.hostname.replace(/^[^.]+\./, '');
      
      const signupUrl = `https://${baseDomain}/setup?token=${link.token}`;

      const { data, error } = await supabase.functions.invoke('send-email', {
        body: {
          template: 'company_creation_link',
          to: { email: link.email },
          data: {
            recipientEmail: link.email,
            signupUrl,
            expiresAt: format(new Date(link.expires_at), 'PPP p'),
            planName,
            trialDays: link.enable_trial ? (link.trial_days || 14) : 0,
            senderName: user?.email || 'Platform Admin',
          },
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.message || data.error);
      return data;
    },
    onSuccess: () => {
      toast.success('Email resent successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to resend email: ${error.message}`);
    },
  });

  const copyLink = (link: CompanyLink) => {
    const baseDomain = window.location.hostname.includes('localhost') 
      ? 'localhost:8080' 
      : window.location.hostname.replace(/^[^.]+\./, '');
    const signupUrl = `https://${baseDomain}/setup?token=${link.token}`;
    navigator.clipboard.writeText(signupUrl);
    toast.success('Link copied to clipboard');
  };

  const getStatusBadge = (link: CompanyLink) => {
    if (link.used_at || (link.uses && link.max_uses && link.uses >= link.max_uses)) {
      return (
        <Badge variant="secondary" className="gap-1">
          <CheckCircle className="h-3 w-3" />
          Used
        </Badge>
      );
    }
    if (isPast(new Date(link.expires_at))) {
      return (
        <Badge variant="destructive" className="gap-1">
          <XCircle className="h-3 w-3" />
          Expired
        </Badge>
      );
    }
    return (
      <Badge variant="default" className="gap-1 bg-green-600">
        <AlertCircle className="h-3 w-3" />
        Active
      </Badge>
    );
  };

  const handleExtend = (link: CompanyLink) => {
    setSelectedLink(link);
    setExtendHours(72);
    setExtendDialogOpen(true);
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Link className="h-5 w-5" />
                Company Creation Links
              </CardTitle>
              <CardDescription>
                Manage signup links for new companies
              </CardDescription>
            </div>
            <Button onClick={onCreateNew}>
              Generate New Link
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : !links?.length ? (
            <div className="text-center py-12">
              <Link className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No links created yet</p>
              <Button className="mt-4" onClick={onCreateNew}>
                Generate Your First Link
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Recipient</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {links.map((link) => (
                  <TableRow key={link.id}>
                    <TableCell>
                      {link.email ? (
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{link.email}</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">No email</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {link.plan?.name || 'Default'}
                      </Badge>
                      {link.enable_trial && link.trial_days && (
                        <span className="text-xs text-muted-foreground ml-2">
                          {link.trial_days}d trial
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm">
                        <Clock className="h-3 w-3 text-muted-foreground" />
                        {isPast(new Date(link.expires_at)) ? (
                          <span className="text-destructive">
                            Expired {formatDistanceToNow(new Date(link.expires_at))} ago
                          </span>
                        ) : (
                          <span>
                            {formatDistanceToNow(new Date(link.expires_at))} left
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(link.expires_at), 'MMM d, yyyy h:mm a')}
                      </span>
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(link)}
                      {link.used_company && (
                        <div className="mt-1">
                          <span className="text-xs text-muted-foreground">
                            → {link.used_company.name}
                          </span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground truncate max-w-[150px] block">
                        {link.notes || '-'}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => copyLink(link)}>
                            <Copy className="h-4 w-4 mr-2" />
                            Copy Link
                          </DropdownMenuItem>
                          
                          {link.used_company && (
                            <DropdownMenuItem 
                              onClick={() => window.open(`/platform/companies/${link.used_by_company_id}`, '_blank')}
                            >
                              <ExternalLink className="h-4 w-4 mr-2" />
                              View Company
                            </DropdownMenuItem>
                          )}
                          
                          {!link.used_at && (
                            <>
                              <DropdownMenuSeparator />
                              
                              {link.email && (
                                <DropdownMenuItem 
                                  onClick={() => resendEmailMutation.mutate(link)}
                                  disabled={resendEmailMutation.isPending}
                                >
                                  {resendEmailMutation.isPending ? (
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                  ) : (
                                    <Mail className="h-4 w-4 mr-2" />
                                  )}
                                  Resend Email
                                </DropdownMenuItem>
                              )}
                              
                              <DropdownMenuItem onClick={() => handleExtend(link)}>
                                <RefreshCw className="h-4 w-4 mr-2" />
                                Extend Expiry
                              </DropdownMenuItem>
                              
                              <DropdownMenuSeparator />
                              
                              <DropdownMenuItem 
                                onClick={() => deleteMutation.mutate(link.id)}
                                className="text-destructive"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Revoke Link
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Extend Expiry Dialog */}
      <Dialog open={extendDialogOpen} onOpenChange={setExtendDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Extend Link Expiry</DialogTitle>
            <DialogDescription>
              Add more time to this signup link
            </DialogDescription>
          </DialogHeader>
          
          {selectedLink && (
            <div className="space-y-4 py-4">
              <div className="bg-muted rounded-lg p-3">
                <p className="text-sm text-muted-foreground">Current expiry:</p>
                <p className="font-medium">
                  {format(new Date(selectedLink.expires_at), 'PPP p')}
                </p>
                {isPast(new Date(selectedLink.expires_at)) && (
                  <Badge variant="destructive" className="mt-2">Expired</Badge>
                )}
              </div>
              
              <div className="space-y-2">
                <Label>Extend by (hours)</Label>
                <Input
                  type="number"
                  min={1}
                  value={extendHours}
                  onChange={(e) => setExtendHours(parseInt(e.target.value) || 24)}
                />
                <p className="text-xs text-muted-foreground">
                  New expiry will be: {format(
                    addHours(
                      isPast(new Date(selectedLink.expires_at)) 
                        ? new Date() 
                        : new Date(selectedLink.expires_at), 
                      extendHours
                    ),
                    'PPP p'
                  )}
                </p>
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setExtendDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => selectedLink && extendMutation.mutate({ linkId: selectedLink.id, hours: extendHours })}
              disabled={extendMutation.isPending}
            >
              {extendMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Extend
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}