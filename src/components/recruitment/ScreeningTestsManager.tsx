import { useState } from 'react';
import { format } from 'date-fns';
import { Plus, Edit, Trash2, FileQuestion, MoreHorizontal } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { ScreeningTestBuilder } from './ScreeningTestBuilder';
import { useScreeningTests, useUpdateScreeningTest, ScreeningTest } from '@/hooks/useRecruitmentWorkflow';
import { WriteGate } from '@/components/PermissionGate';
import { toast } from 'sonner';

export function ScreeningTestsManager() {
  const [builderOpen, setBuilderOpen] = useState(false);
  const [editingTest, setEditingTest] = useState<ScreeningTest | null>(null);
  
  const { data: tests = [], isLoading } = useScreeningTests();
  const updateTest = useUpdateScreeningTest();
  
  const handleEdit = (test: ScreeningTest) => {
    setEditingTest(test);
    setBuilderOpen(true);
  };
  
  const handleCreate = () => {
    setEditingTest(null);
    setBuilderOpen(true);
  };
  
  const handleDelete = async (test: ScreeningTest) => {
    try {
      await updateTest.mutateAsync({ id: test.id, is_active: false });
      toast.success('Screening test deleted');
    } catch (error) {
      toast.error('Failed to delete screening test');
    }
  };
  
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Screening Tests</CardTitle>
            <CardDescription>Create and manage screening tests for candidates</CardDescription>
          </div>
          <WriteGate>
            <Button onClick={handleCreate}>
              <Plus className="h-4 w-4 mr-2" />
              Create Test
            </Button>
          </WriteGate>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Loading...</div>
        ) : tests.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <FileQuestion className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No screening tests created yet.</p>
            <p className="text-sm">Create your first test to start evaluating candidates.</p>
            <WriteGate>
              <Button variant="outline" className="mt-4" onClick={handleCreate}>
                <Plus className="h-4 w-4 mr-2" />
                Create Test
              </Button>
            </WriteGate>
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Test Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Questions</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Pass Score</TableHead>
                  <TableHead>Template</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="w-[80px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tests.map((test) => (
                  <TableRow key={test.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{test.title}</p>
                        {test.description && (
                          <p className="text-xs text-muted-foreground line-clamp-1">{test.description}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{test.test_type}</Badge>
                    </TableCell>
                    <TableCell>{test.questions.length}</TableCell>
                    <TableCell>{test.duration_minutes} min</TableCell>
                    <TableCell>{test.passing_score}%</TableCell>
                    <TableCell>
                      {test.is_template ? (
                        <Badge variant="secondary">Template</Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {format(new Date(test.created_at), 'MMM d, yyyy')}
                    </TableCell>
                    <TableCell>
                      <WriteGate>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleEdit(test)}>
                              <Edit className="h-4 w-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <DropdownMenuItem 
                                  onSelect={(e) => e.preventDefault()}
                                  className="text-destructive"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Screening Test</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete "{test.title}"? This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDelete(test)}>
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </WriteGate>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
      
      <ScreeningTestBuilder
        open={builderOpen}
        onOpenChange={(open) => {
          setBuilderOpen(open);
          if (!open) setEditingTest(null);
        }}
        editingTest={editingTest}
      />
    </Card>
  );
}
