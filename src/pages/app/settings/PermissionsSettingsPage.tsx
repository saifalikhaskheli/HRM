import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { UserPermissionsTable } from '@/components/permissions/UserPermissionsTable';
import { RolePermissionsManager } from '@/components/permissions/RolePermissionsManager';
import { UserOverridesList } from '@/components/permissions/UserOverridesList';
import { RoleGate } from '@/components/PermissionGate';
import { Users, Shield, UserCog } from 'lucide-react';

export function PermissionsSettingsPage() {
  return (
    <RoleGate role="company_admin">
      <Card>
        <CardHeader>
          <CardTitle>Permission Management</CardTitle>
          <CardDescription>
            Manage user permissions across different modules and features
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="users" className="space-y-6">
            <TabsList>
              <TabsTrigger value="users" className="gap-2">
                <Users className="h-4 w-4" />
                User Permissions
              </TabsTrigger>
              <TabsTrigger value="roles" className="gap-2">
                <Shield className="h-4 w-4" />
                Role Permissions
              </TabsTrigger>
              <TabsTrigger value="overrides" className="gap-2">
                <UserCog className="h-4 w-4" />
                User Overrides
              </TabsTrigger>
            </TabsList>

            <TabsContent value="users" className="min-w-0">
              <UserPermissionsTable />
            </TabsContent>

            <TabsContent value="roles">
              <RolePermissionsManager />
            </TabsContent>

            <TabsContent value="overrides">
              <UserOverridesList />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </RoleGate>
  );
}

export default PermissionsSettingsPage;
