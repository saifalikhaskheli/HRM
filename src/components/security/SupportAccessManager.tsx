import { useState } from 'react';
import { useSupportAccess } from '@/hooks/useSecurity';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { UserPlus, Shield, Clock, Eye, Pencil, Loader2, AlertTriangle, CheckCircle } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';

export function SupportAccessManager() {
  const { activeAccess, isLoading, grantAccess, revokeAccess, hasActiveAccess } = useSupportAccess();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [duration, setDuration] = useState('24');
  const [accessLevel, setAccessLevel] = useState<'read' | 'write'>('read');

  const handleGrantAccess = async () => {
    await grantAccess.mutateAsync({
      reason,
      durationHours: parseInt(duration),
      accessLevel,
    });
    setDialogOpen(false);
    setReason('');
    setDuration('24');
    setAccessLevel('read');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserPlus className="h-5 w-5" />
          Support Access
        </CardTitle>
        <CardDescription>
          Grant temporary access to support staff for troubleshooting. All access is logged and audited.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {hasActiveAccess ? (
          <Alert>
            <Shield className="h-4 w-4" />
            <AlertDescription className="flex items-center justify-between">
              <span>Support access is currently active</span>
              <Badge variant="secondary" className="ml-2">
                <Clock className="h-3 w-3 mr-1" />
                {activeAccess?.[0] && formatDistanceToNow(new Date(activeAccess[0].expires_at), { addSuffix: true })}
              </Badge>
            </AlertDescription>
          </Alert>
        ) : (
          <Alert>
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription>
              No active support access. Your data is private.
            </AlertDescription>
          </Alert>
        )}

        <div className="flex gap-2">
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <UserPlus className="h-4 w-4 mr-2" />
                Grant Support Access
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Grant Support Access</DialogTitle>
                <DialogDescription>
                  Allow support staff to access your account temporarily. All actions will be logged.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    Support staff will be able to view your data to help troubleshoot issues. 
                    Access is logged and can be revoked at any time.
                  </AlertDescription>
                </Alert>

                <div className="space-y-2">
                  <Label htmlFor="reason">Reason for access</Label>
                  <Textarea
                    id="reason"
                    placeholder="Describe the issue you need help with..."
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Duration</Label>
                    <Select value={duration} onValueChange={setDuration}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1 hour</SelectItem>
                        <SelectItem value="4">4 hours</SelectItem>
                        <SelectItem value="24">24 hours</SelectItem>
                        <SelectItem value="72">3 days</SelectItem>
                        <SelectItem value="168">7 days</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Access Level</Label>
                    <Select value={accessLevel} onValueChange={(v) => setAccessLevel(v as 'read' | 'write')}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="read">
                          <div className="flex items-center gap-2">
                            <Eye className="h-4 w-4" />
                            Read Only
                          </div>
                        </SelectItem>
                        <SelectItem value="write">
                          <div className="flex items-center gap-2">
                            <Pencil className="h-4 w-4" />
                            Read & Write
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleGrantAccess} 
                  disabled={!reason.trim() || grantAccess.isPending}
                >
                  {grantAccess.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Granting...
                    </>
                  ) : (
                    'Grant Access'
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {activeAccess && activeAccess.length > 0 && (
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reason</TableHead>
                  <TableHead>Level</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeAccess.map((access) => (
                  <TableRow key={access.id}>
                    <TableCell className="max-w-xs truncate">{access.reason}</TableCell>
                    <TableCell>
                      <Badge variant={access.access_level === 'write' ? 'destructive' : 'secondary'}>
                        {access.access_level === 'write' ? (
                          <><Pencil className="h-3 w-3 mr-1" />Write</>
                        ) : (
                          <><Eye className="h-3 w-3 mr-1" />Read</>
                        )}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {format(new Date(access.expires_at), 'MMM d, HH:mm')}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => revokeAccess.mutate(access.id)}
                        disabled={revokeAccess.isPending}
                      >
                        Revoke
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
