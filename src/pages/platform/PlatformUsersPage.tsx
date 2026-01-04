import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Search, Users, Building2, Save, Loader2, Clock, CheckCircle, XCircle, Inbox } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface UserWithCompanyCount {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  max_companies: number;
  company_count: number;
  companies: { name: string; role: string }[];
}

interface MultiCompanyRequest {
  id: string;
  user_id: string;
  user_email: string;
  user_name: string | null;
  requested_count: number;
  reason: string;
  status: string;
  created_at: string;
}

export default function PlatformUsersPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState<number>(1);
  
  const queryClient = useQueryClient();

  // Fetch pending requests
  const { data: pendingRequests, isLoading: requestsLoading } = useQuery({
    queryKey: ["platform-multi-company-requests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("multi_company_requests")
        .select("*")
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as MultiCompanyRequest[];
    },
  });

  const { data: users, isLoading } = useQuery({
    queryKey: ["platform-users", searchQuery],
    queryFn: async () => {
      let query = supabase
        .from("profiles")
        .select("id, email, first_name, last_name, max_companies")
        .order("email");

      if (searchQuery) {
        query = query.ilike("email", `%${searchQuery}%`);
      }

      const { data: profiles, error: profilesError } = await query.limit(50);

      if (profilesError) throw profilesError;
      if (!profiles) return [];

      const userIds = profiles.map((p) => p.id);
      const { data: companyUsers, error: companyError } = await supabase
        .from("company_users")
        .select(`
          user_id,
          role,
          is_active,
          companies:company_id (name)
        `)
        .in("user_id", userIds)
        .eq("is_active", true);

      if (companyError) throw companyError;

      const usersWithCounts: UserWithCompanyCount[] = profiles.map((profile) => {
        const userCompanies = (companyUsers || []).filter(
          (cu) => cu.user_id === profile.id
        );
        return {
          ...profile,
          company_count: userCompanies.length,
          companies: userCompanies.map((cu) => ({
            name: (cu.companies as unknown as { name: string })?.name || "Unknown",
            role: cu.role,
          })),
        };
      });

      return usersWithCounts;
    },
    enabled: true,
  });

  const updateMaxCompanies = useMutation({
    mutationFn: async ({ userId, maxCompanies }: { userId: string; maxCompanies: number }) => {
      const { error } = await supabase
        .from("profiles")
        .update({ max_companies: maxCompanies })
        .eq("id", userId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["platform-users"] });
      toast.success("User company limit has been updated.");
      setEditingUserId(null);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const approveRequest = useMutation({
    mutationFn: async ({ requestId, userId, requestedCount }: { requestId: string; userId: string; requestedCount: number }) => {
      // Update user's max_companies
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ max_companies: requestedCount })
        .eq("id", userId);

      if (profileError) throw profileError;

      // Update request status
      const { error: requestError } = await supabase
        .from("multi_company_requests")
        .update({
          status: "approved",
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", requestId);

      if (requestError) throw requestError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["platform-multi-company-requests"] });
      queryClient.invalidateQueries({ queryKey: ["platform-users"] });
      toast.success("User's company limit has been updated.");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const rejectRequest = useMutation({
    mutationFn: async ({ requestId }: { requestId: string }) => {
      const { error } = await supabase
        .from("multi_company_requests")
        .update({
          status: "rejected",
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", requestId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["platform-multi-company-requests"] });
      toast.success("The request has been rejected.");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleEdit = (user: UserWithCompanyCount) => {
    setEditingUserId(user.id);
    setEditingValue(user.max_companies);
  };

  const handleSave = (userId: string) => {
    updateMaxCompanies.mutate({ userId, maxCompanies: editingValue });
  };

  const handleCancel = () => {
    setEditingUserId(null);
  };

  const quickSetLimit = (userId: string, limit: number) => {
    updateMaxCompanies.mutate({ userId, maxCompanies: limit });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">User Management</h1>
        <p className="text-muted-foreground">
          Manage user permissions and multi-company access limits
        </p>
      </div>

      {/* Pending Requests Section */}
      {pendingRequests && pendingRequests.length > 0 && (
        <Card className="border-orange-200 bg-orange-50/50 dark:border-orange-900 dark:bg-orange-950/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Inbox className="h-5 w-5 text-orange-600" />
              Pending Access Requests
              <Badge variant="secondary" className="ml-2">
                {pendingRequests.length}
              </Badge>
            </CardTitle>
            <CardDescription>
              Users requesting multi-company access. Review and approve or reject these requests.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {pendingRequests.map((request) => (
                <div
                  key={request.id}
                  className="flex items-start justify-between gap-4 p-4 bg-background rounded-lg border"
                >
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{request.user_name || "Unknown"}</span>
                      <span className="text-muted-foreground">({request.user_email})</span>
                      <Badge variant="outline">
                        <Clock className="mr-1 h-3 w-3" />
                        {formatDistanceToNow(new Date(request.created_at), { addSuffix: true })}
                      </Badge>
                    </div>
                    <div className="text-sm">
                      <span className="text-muted-foreground">Requesting: </span>
                      <strong>{request.requested_count} companies</strong>
                    </div>
                    <div className="text-sm text-muted-foreground bg-muted p-2 rounded">
                      <strong>Reason:</strong> {request.reason}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => approveRequest.mutate({
                        requestId: request.id,
                        userId: request.user_id,
                        requestedCount: request.requested_count,
                      })}
                      disabled={approveRequest.isPending}
                    >
                      {approveRequest.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <CheckCircle className="mr-1 h-4 w-4" />
                      )}
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => rejectRequest.mutate({ requestId: request.id })}
                      disabled={rejectRequest.isPending}
                    >
                      {rejectRequest.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <XCircle className="mr-1 h-4 w-4" />
                      )}
                      Reject
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Users
          </CardTitle>
          <CardDescription>
            Search for users by email and manage their company access limits. By default, users can only belong to 1 company.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !users || users.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchQuery ? "No users found matching your search" : "No users found"}
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Companies</TableHead>
                    <TableHead>Limit</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div className="font-medium">
                          {user.first_name || user.last_name
                            ? `${user.first_name || ""} ${user.last_name || ""}`.trim()
                            : "—"}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {user.email}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Badge variant={user.company_count > 0 ? "default" : "secondary"}>
                            <Building2 className="mr-1 h-3 w-3" />
                            {user.company_count} / {user.max_companies}
                          </Badge>
                          {user.companies.length > 0 && (
                            <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                              {user.companies.map((c) => c.name).join(", ")}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {editingUserId === user.id ? (
                          <div className="flex items-center gap-2">
                            <Select
                              value={editingValue.toString()}
                              onValueChange={(v) => setEditingValue(parseInt(v))}
                            >
                              <SelectTrigger className="w-20">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {[1, 2, 3, 4, 5, 10, 20, 50].map((n) => (
                                  <SelectItem key={n} value={n.toString()}>
                                    {n}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Button
                              size="sm"
                              onClick={() => handleSave(user.id)}
                              disabled={updateMaxCompanies.isPending}
                            >
                              {updateMaxCompanies.isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Save className="h-4 w-4" />
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={handleCancel}
                            >
                              Cancel
                            </Button>
                          </div>
                        ) : (
                          <span className="font-medium">{user.max_companies}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {editingUserId !== user.id && (
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleEdit(user)}
                            >
                              Edit Limit
                            </Button>
                            {user.max_companies === 1 && (
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => quickSetLimit(user.id, 5)}
                              >
                                Grant Multi-Company
                              </Button>
                            )}
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
