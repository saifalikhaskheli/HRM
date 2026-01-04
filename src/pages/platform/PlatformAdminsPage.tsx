import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { createPlatformAdmin } from '@/lib/platform-api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Loader2, Plus, Shield, Crown, UserCog, Headphones } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface PlatformAdminFormData {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  role: 'owner' | 'admin' | 'support';
}

const roleIcons = {
  owner: Crown,
  admin: Shield,
  support: Headphones,
};

const roleColors = {
  owner: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  admin: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  support: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
};

export default function PlatformAdminsPage() {
  const { user, platformAdminRole } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState<PlatformAdminFormData>({
    email: '',
    password: '',
    first_name: '',
    last_name: '',
    role: 'admin',
  });

  const isOwner = platformAdminRole === 'owner';

  // Fetch platform admins
  const { data: platformAdmins, isLoading } = useQuery({
    queryKey: ['platform-admins'],
    queryFn: async () => {
      const { data: admins, error } = await supabase
        .from('platform_admins')
        .select('id, user_id, role, is_active, created_at')
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Fetch profiles for these users
      const userIds = admins.map(a => a.user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, email, first_name, last_name')
        .in('id', userIds);

      // Merge data
      return admins.map(admin => {
        const profile = profiles?.find(p => p.id === admin.user_id);
        return {
          ...admin,
          email: profile?.email || 'Unknown',
          first_name: profile?.first_name,
          last_name: profile?.last_name,
        };
      });
    },
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: PlatformAdminFormData) => {
      const result = await createPlatformAdmin({
        email: data.email,
        password: data.password,
        first_name: data.first_name || undefined,
        last_name: data.last_name || undefined,
        role: data.role,
      });

      if (!result.success) {
        throw new Error(result.error || 'Failed to create platform admin');
      }

      return result.data;
    },
    onSuccess: () => {
      toast.success('Platform admin created successfully');
      queryClient.invalidateQueries({ queryKey: ['platform-admins'] });
      setDialogOpen(false);
      setFormData({
        email: '',
        password: '',
        first_name: '',
        last_name: '',
        role: 'admin',
      });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Toggle active status mutation
  const toggleActiveMutation = useMutation({
    mutationFn: async ({ adminId, isActive }: { adminId: string; isActive: boolean }) => {
      const { error } = await supabase
        .from('platform_admins')
        .update({ is_active: !isActive })
        .eq('id', adminId);

      if (error) throw error;
    },
    onSuccess: (_, { isActive }) => {
      toast.success(isActive ? 'Platform admin deactivated' : 'Platform admin reactivated');
      queryClient.invalidateQueries({ queryKey: ['platform-admins'] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.email || !formData.password) {
      toast.error('Email and password are required');
      return;
    }
    if (formData.password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    createMutation.mutate(formData);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Platform Admins</h2>
          <p className="text-muted-foreground">Manage administrators who can access this platform</p>
        </div>
        {isOwner && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Admin
              </Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={handleSubmit}>
                <DialogHeader>
                  <DialogTitle>Add Platform Admin</DialogTitle>
                  <DialogDescription>
                    Create a new platform administrator account
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="admin@example.com"
                      required
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      placeholder="••••••••"
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="first_name">First Name</Label>
                      <Input
                        id="first_name"
                        value={formData.first_name}
                        onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                        placeholder="John"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="last_name">Last Name</Label>
                      <Input
                        id="last_name"
                        value={formData.last_name}
                        onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                        placeholder="Doe"
                      />
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="role">Role</Label>
                    <Select
                      value={formData.role}
                      onValueChange={(value: 'owner' | 'admin' | 'support') =>
                        setFormData({ ...formData, role: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="owner">Owner - Full access</SelectItem>
                        <SelectItem value="admin">Admin - Manage platform</SelectItem>
                        <SelectItem value="support">Support - View only</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createMutation.isPending}>
                    {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Create Admin
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Platform Admins</CardTitle>
          <CardDescription>
            Platform admins can manage all companies, subscriptions, and platform settings
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : platformAdmins?.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No platform admins found</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  {isOwner && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {platformAdmins?.map((admin) => {
                  const RoleIcon = roleIcons[admin.role as keyof typeof roleIcons] || Shield;
                  const isCurrentUser = admin.user_id === user?.user_id;
                  
                  return (
                    <TableRow key={admin.id}>
                      <TableCell className="font-medium">
                        {admin.first_name || admin.last_name
                          ? `${admin.first_name || ''} ${admin.last_name || ''}`.trim()
                          : '-'}
                        {isCurrentUser && (
                          <Badge variant="outline" className="ml-2">You</Badge>
                        )}
                      </TableCell>
                      <TableCell>{admin.email}</TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium capitalize ${roleColors[admin.role as keyof typeof roleColors] || ''}`}>
                          <RoleIcon className="h-3 w-3" />
                          {admin.role}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant={admin.is_active ? 'default' : 'secondary'}>
                          {admin.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {new Date(admin.created_at).toLocaleDateString()}
                      </TableCell>
                      {isOwner && (
                        <TableCell className="text-right">
                          {!isCurrentUser && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleActiveMutation.mutate({ 
                                adminId: admin.id, 
                                isActive: admin.is_active 
                              })}
                              disabled={toggleActiveMutation.isPending}
                            >
                              {admin.is_active ? 'Deactivate' : 'Reactivate'}
                            </Button>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {!isOwner && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground text-center">
              Only platform owners can add or manage other platform admins.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
