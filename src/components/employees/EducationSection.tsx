import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { GraduationCap, Plus, Pencil, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { 
  useEmployeeEducation, 
  useAddEducation, 
  useUpdateEducation, 
  useDeleteEducation,
  type Education 
} from '@/hooks/useEmployeeEducation';

interface EducationSectionProps {
  employeeId: string;
  canEdit?: boolean;
}

interface EducationFormData {
  institution: string;
  degree: string;
  field_of_study: string;
  start_date: string;
  end_date: string;
  grade: string;
  is_current: boolean;
  description: string;
}

const defaultFormData: EducationFormData = {
  institution: '',
  degree: '',
  field_of_study: '',
  start_date: '',
  end_date: '',
  grade: '',
  is_current: false,
  description: '',
};

export function EducationSection({ employeeId, canEdit = false }: EducationSectionProps) {
  const { data: education, isLoading } = useEmployeeEducation(employeeId);
  const addEducation = useAddEducation();
  const updateEducation = useUpdateEducation();
  const deleteEducation = useDeleteEducation();
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<EducationFormData>(defaultFormData);

  const handleOpenAdd = () => {
    setEditingId(null);
    setFormData(defaultFormData);
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (edu: Education) => {
    setEditingId(edu.id);
    setFormData({
      institution: edu.institution,
      degree: edu.degree,
      field_of_study: edu.field_of_study || '',
      start_date: edu.start_date || '',
      end_date: edu.end_date || '',
      grade: edu.grade || '',
      is_current: edu.is_current || false,
      description: edu.description || '',
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const payload = {
      institution: formData.institution,
      degree: formData.degree,
      field_of_study: formData.field_of_study || null,
      start_date: formData.start_date || null,
      end_date: formData.is_current ? null : (formData.end_date || null),
      grade: formData.grade || null,
      is_current: formData.is_current,
      description: formData.description || null,
    };

    if (editingId) {
      await updateEducation.mutateAsync({ id: editingId, education: payload });
    } else {
      await addEducation.mutateAsync({ employeeId, education: payload });
    }
    
    setIsDialogOpen(false);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to remove this education record?')) {
      await deleteEducation.mutateAsync({ id, employeeId });
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5" />
            Education
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <GraduationCap className="h-5 w-5" />
          Education
        </CardTitle>
        {canEdit && (
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" onClick={handleOpenAdd}>
                <Plus className="h-4 w-4 mr-1" />
                Add
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>{editingId ? 'Edit Education' : 'Add Education'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <Label htmlFor="institution">Institution *</Label>
                    <Input
                      id="institution"
                      value={formData.institution}
                      onChange={(e) => setFormData({ ...formData, institution: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="degree">Degree *</Label>
                    <Input
                      id="degree"
                      value={formData.degree}
                      onChange={(e) => setFormData({ ...formData, degree: e.target.value })}
                      placeholder="e.g., Bachelor's, Master's"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="field_of_study">Field of Study</Label>
                    <Input
                      id="field_of_study"
                      value={formData.field_of_study}
                      onChange={(e) => setFormData({ ...formData, field_of_study: e.target.value })}
                      placeholder="e.g., Computer Science"
                    />
                  </div>
                  <div>
                    <Label htmlFor="start_date">Start Date</Label>
                    <Input
                      id="start_date"
                      type="date"
                      value={formData.start_date}
                      onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="end_date">End Date</Label>
                    <Input
                      id="end_date"
                      type="date"
                      value={formData.end_date}
                      onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                      disabled={formData.is_current}
                    />
                  </div>
                  <div className="col-span-2 flex items-center gap-2">
                    <Switch
                      id="is_current"
                      checked={formData.is_current}
                      onCheckedChange={(checked) => setFormData({ ...formData, is_current: checked })}
                    />
                    <Label htmlFor="is_current">Currently studying here</Label>
                  </div>
                  <div>
                    <Label htmlFor="grade">Grade/GPA</Label>
                    <Input
                      id="grade"
                      value={formData.grade}
                      onChange={(e) => setFormData({ ...formData, grade: e.target.value })}
                    />
                  </div>
                  <div className="col-span-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      rows={3}
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={addEducation.isPending || updateEducation.isPending}>
                    {editingId ? 'Update' : 'Add'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </CardHeader>
      <CardContent>
        {education?.length === 0 ? (
          <p className="text-muted-foreground text-sm">No education records added yet.</p>
        ) : (
          <div className="space-y-4">
            {education?.map((edu) => (
              <div key={edu.id} className="border rounded-lg p-4 relative group">
                {canEdit && (
                  <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleOpenEdit(edu)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(edu.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
                <h4 className="font-semibold">{edu.degree}{edu.field_of_study ? ` in ${edu.field_of_study}` : ''}</h4>
                <p className="text-muted-foreground">{edu.institution}</p>
                <p className="text-sm text-muted-foreground">
                  {edu.start_date ? format(new Date(edu.start_date), 'MMM yyyy') : 'N/A'}
                  {' - '}
                  {edu.is_current ? 'Present' : (edu.end_date ? format(new Date(edu.end_date), 'MMM yyyy') : 'N/A')}
                  {edu.grade && ` • Grade: ${edu.grade}`}
                </p>
                {edu.description && <p className="text-sm mt-2">{edu.description}</p>}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
