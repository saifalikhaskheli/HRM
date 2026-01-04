import { useState } from 'react';
import { FileText, Upload, Settings, Search, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PermGate, WriteGate } from '@/components/PermissionGate';
import { ModuleGuard } from '@/components/ModuleGuard';
import { DocumentUploadDialog } from '@/components/documents/DocumentUploadDialog';
import { DocumentList } from '@/components/documents/DocumentList';
import { DocumentTypeManager } from '@/components/documents/DocumentTypeManager';
import { DocumentExpiryAlerts } from '@/components/documents/DocumentExpiryAlerts';
import { useAllDocuments, useMyDocuments, useTeamDocuments } from '@/hooks/useDocuments';
import { usePermission } from '@/contexts/PermissionContext';

export default function DocumentsPage() {
  const { can } = usePermission();
  const { data: allDocuments = [], isLoading: allLoading } = useAllDocuments();
  const { data: myDocuments = [], isLoading: myLoading } = useMyDocuments();
  const { data: teamDocuments = [], isLoading: teamLoading } = useTeamDocuments();
  
  const [uploadOpen, setUploadOpen] = useState(false);
  const [parentDocumentId, setParentDocumentId] = useState<string | undefined>();
  const [searchQuery, setSearchQuery] = useState('');

  const canReadAll = can('documents', 'read');
  const canVerify = can('documents', 'verify');
  const canManageSettings = can('documents', 'manage');
  
  // Determine default tab based on permissions
  const defaultTab = canReadAll ? 'all' : 'my';
  const [activeTab, setActiveTab] = useState(defaultTab);

  const filteredAllDocs = allDocuments.filter((doc) =>
    doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    doc.employee?.first_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    doc.employee?.last_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    doc.document_type?.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredMyDocs = myDocuments.filter((doc) =>
    doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    doc.document_type?.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredTeamDocs = teamDocuments.filter((doc) =>
    doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    doc.employee?.first_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    doc.employee?.last_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    doc.document_type?.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const pendingVerificationCount = allDocuments.filter(
    d => d.verification_status === 'pending' || (!d.verification_status && !d.is_verified)
  ).length;

  const handleUploadVersion = (documentId: string) => {
    setParentDocumentId(documentId);
    setUploadOpen(true);
  };

  const handleCloseUpload = (open: boolean) => {
    setUploadOpen(open);
    if (!open) {
      setParentDocumentId(undefined);
    }
  };

  return (
    <ModuleGuard moduleId="documents">
      <div className="p-4 md:p-6 space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Documents</h1>
            <p className="text-muted-foreground">Manage employee documents and files</p>
          </div>
          <WriteGate>
            <PermGate module="documents" action="create">
              <Button onClick={() => setUploadOpen(true)}>
                <Upload className="h-4 w-4 mr-2" />
                Upload Document
              </Button>
            </PermGate>
          </WriteGate>
        </div>

        {/* Stats Cards - visible to those with read permission */}
        {canReadAll && (
          <div className="grid gap-4 grid-cols-1 md:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Total Documents</CardDescription>
                <CardTitle className="text-3xl">{allDocuments.length}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Verified</CardDescription>
                <CardTitle className="text-3xl text-green-600">
                  {allDocuments.filter(d => d.verification_status === 'verified' || d.is_verified).length}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Pending Verification</CardDescription>
                <CardTitle className="text-3xl text-amber-600">
                  {pendingVerificationCount}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Rejected</CardDescription>
                <CardTitle className="text-3xl text-destructive">
                  {allDocuments.filter(d => d.verification_status === 'rejected').length}
                </CardTitle>
              </CardHeader>
            </Card>
          </div>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="flex items-center justify-between">
            <TabsList>
              {canReadAll && <TabsTrigger value="all">All Documents</TabsTrigger>}
              <TabsTrigger value="my">My Documents</TabsTrigger>
              {teamDocuments.length > 0 && (
                <TabsTrigger value="team">Team Documents</TabsTrigger>
              )}
              {canVerify && (
                <TabsTrigger value="expiry">
                  <AlertTriangle className="h-4 w-4 mr-1" />
                  Expiry Alerts
                </TabsTrigger>
              )}
              {canManageSettings && (
                <TabsTrigger value="settings">
                  <Settings className="h-4 w-4 mr-1" />
                  Settings
                </TabsTrigger>
              )}
            </TabsList>

            {activeTab !== 'settings' && activeTab !== 'expiry' && (
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search documents..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            )}
          </div>

          {canReadAll && (
            <TabsContent value="all" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>All Documents</CardTitle>
                  <CardDescription>
                    View and manage all employee documents
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <DocumentList
                    documents={filteredAllDocs}
                    isLoading={allLoading}
                    showEmployee={true}
                    onUploadVersion={handleUploadVersion}
                  />
                </CardContent>
              </Card>
            </TabsContent>
          )}

          <TabsContent value="my" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>My Documents</CardTitle>
                <CardDescription>
                  View your personal documents
                </CardDescription>
              </CardHeader>
              <CardContent>
                <DocumentList
                  documents={filteredMyDocs}
                  isLoading={myLoading}
                  showEmployee={false}
                />
              </CardContent>
            </Card>
          </TabsContent>

          {teamDocuments.length > 0 && (
            <TabsContent value="team" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>Team Documents</CardTitle>
                  <CardDescription>
                    View documents from your direct reports
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <DocumentList
                    documents={filteredTeamDocs}
                    isLoading={teamLoading}
                    showEmployee={true}
                  />
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {canVerify && (
            <TabsContent value="expiry" className="mt-6">
              <DocumentExpiryAlerts />
            </TabsContent>
          )}

          {canManageSettings && (
            <TabsContent value="settings" className="mt-6">
              <DocumentTypeManager />
            </TabsContent>
          )}
        </Tabs>

        <DocumentUploadDialog
          open={uploadOpen}
          onOpenChange={handleCloseUpload}
          parentDocumentId={parentDocumentId}
        />
      </div>
    </ModuleGuard>
  );
}
