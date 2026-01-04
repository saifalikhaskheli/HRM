import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Monitor, Smartphone, Laptop, Trash2, RefreshCw, Shield, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { ReauthDialog } from './ReauthDialog';

interface TrustedDevice {
  id: string;
  device_fingerprint: string;
  device_name: string;
  browser: string | null;
  os: string | null;
  last_used_at: string;
  first_seen_at: string;
  is_current: boolean;
  is_trusted: boolean;
}

function getDeviceIcon(os: string | null) {
  if (!os) return Monitor;
  const osLower = os.toLowerCase();
  if (osLower.includes('android') || osLower.includes('iphone') || osLower.includes('ios')) {
    return Smartphone;
  }
  if (osLower.includes('mac') || osLower.includes('windows') || osLower.includes('linux')) {
    return Laptop;
  }
  return Monitor;
}

export function TrustedDevicesManager() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [deviceToRemove, setDeviceToRemove] = useState<TrustedDevice | null>(null);
  const [showReauth, setShowReauth] = useState(false);
  const [pendingAction, setPendingAction] = useState<'single' | 'all' | null>(null);

  const { data: devices, isLoading, refetch } = useQuery({
    queryKey: ['trusted-devices', user?.user_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('trusted_devices')
        .select('*')
        .order('last_used_at', { ascending: false });

      if (error) throw error;
      return data as TrustedDevice[];
    },
    enabled: !!user?.user_id,
  });

  const removeDeviceMutation = useMutation({
    mutationFn: async (deviceId: string) => {
      const { error } = await supabase
        .from('trusted_devices')
        .delete()
        .eq('id', deviceId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trusted-devices'] });
      toast.success('Device removed successfully');
    },
    onError: (error) => {
      console.error('Failed to remove device:', error);
      toast.error('Failed to remove device');
    },
  });

  const removeAllDevicesMutation = useMutation({
    mutationFn: async () => {
      const currentDevice = devices?.find(d => d.is_current);
      const { error } = await supabase
        .from('trusted_devices')
        .delete()
        .neq('id', currentDevice?.id || '');

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trusted-devices'] });
      toast.success('All other devices removed');
    },
    onError: (error) => {
      console.error('Failed to remove devices:', error);
      toast.error('Failed to remove devices');
    },
  });

  const handleRemoveDevice = (device: TrustedDevice) => {
    setDeviceToRemove(device);
    setPendingAction('single');
    setShowReauth(true);
  };

  const handleRemoveAllDevices = () => {
    setPendingAction('all');
    setShowReauth(true);
  };

  const handleReauthSuccess = () => {
    if (pendingAction === 'single' && deviceToRemove) {
      removeDeviceMutation.mutate(deviceToRemove.id);
    } else if (pendingAction === 'all') {
      removeAllDevicesMutation.mutate();
    }
    setPendingAction(null);
    setDeviceToRemove(null);
  };

  const handleReauthClose = (open: boolean) => {
    setShowReauth(open);
    if (!open) {
      setPendingAction(null);
      setDeviceToRemove(null);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Trusted Devices
          </CardTitle>
          <CardDescription>Loading your devices...</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2].map((i) => (
            <div key={i} className="flex items-center gap-4 p-4 border rounded-lg">
              <Skeleton className="h-10 w-10 rounded-lg" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-48" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  const hasOtherDevices = devices && devices.filter(d => !d.is_current).length > 0;

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Trusted Devices
              </CardTitle>
              <CardDescription>
                Devices that have accessed your account. Remove any you don't recognize.
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
              {hasOtherDevices && (
                <Button 
                  variant="destructive" 
                  size="sm"
                  onClick={handleRemoveAllDevices}
                  disabled={removeAllDevicesMutation.isPending}
                >
                  Remove All Others
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {!devices || devices.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Monitor className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No trusted devices found</p>
              <p className="text-sm">Devices will appear here after you log in</p>
            </div>
          ) : (
            <div className="space-y-3">
              {devices.map((device) => {
                const DeviceIcon = getDeviceIcon(device.os);
                return (
                  <div
                    key={device.id}
                    className={`flex items-center gap-4 p-4 border rounded-lg transition-colors ${
                      device.is_current ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
                    }`}
                  >
                    <div className={`p-2 rounded-lg ${device.is_current ? 'bg-primary/10' : 'bg-muted'}`}>
                      <DeviceIcon className={`h-6 w-6 ${device.is_current ? 'text-primary' : 'text-muted-foreground'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium truncate">{device.device_name}</h4>
                        {device.is_current && (
                          <Badge variant="default" className="text-xs">Current</Badge>
                        )}
                        {device.is_trusted && !device.is_current && (
                          <Badge variant="secondary" className="text-xs">Trusted</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                        <span>{device.browser || 'Unknown browser'}</span>
                        <span>•</span>
                        <span>{device.os || 'Unknown OS'}</span>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                        <Clock className="h-3 w-3" />
                        <span>
                          Last active {formatDistanceToNow(new Date(device.last_used_at), { addSuffix: true })}
                        </span>
                      </div>
                    </div>
                    {!device.is_current && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => handleRemoveDevice(device)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <ReauthDialog
        open={showReauth}
        onOpenChange={handleReauthClose}
        onSuccess={handleReauthSuccess}
        title="Confirm Device Removal"
        description={
          pendingAction === 'all'
            ? 'For security, please enter your password to remove all other devices.'
            : `For security, please enter your password to remove "${deviceToRemove?.device_name}".`
        }
      />
    </>
  );
}
