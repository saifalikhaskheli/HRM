import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Trash2, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useCreateScreeningTest, useUpdateScreeningTest, ScreeningQuestion, ScreeningTest } from '@/hooks/useRecruitmentWorkflow';

const questionSchema = z.object({
  id: z.string(),
  type: z.enum(['multiple_choice', 'text', 'yes_no', 'rating']),
  question: z.string().min(1, 'Question is required'),
  options: z.array(z.string()).optional(),
  correctAnswer: z.union([z.string(), z.number()]).optional(),
  points: z.number().min(1).default(10),
});

const formSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  test_type: z.enum(['questionnaire', 'coding', 'personality', 'skills']),
  duration_minutes: z.number().min(5).max(180),
  passing_score: z.number().min(0).max(100),
  is_template: z.boolean(),
  job_id: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface ScreeningTestBuilderProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingTest?: ScreeningTest | null;
  jobId?: string;
}

export function ScreeningTestBuilder({ open, onOpenChange, editingTest, jobId }: ScreeningTestBuilderProps) {
  const [questions, setQuestions] = useState<ScreeningQuestion[]>(
    editingTest?.questions || []
  );
  
  const createTest = useCreateScreeningTest();
  const updateTest = useUpdateScreeningTest();
  
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: editingTest?.title || '',
      description: editingTest?.description || '',
      test_type: editingTest?.test_type || 'questionnaire',
      duration_minutes: editingTest?.duration_minutes || 60,
      passing_score: editingTest?.passing_score || 70,
      is_template: editingTest?.is_template || false,
      job_id: editingTest?.job_id || jobId || undefined,
    },
  });
  
  const addQuestion = () => {
    const newQuestion: ScreeningQuestion = {
      id: crypto.randomUUID(),
      type: 'multiple_choice',
      question: '',
      options: ['', '', '', ''],
      points: 10,
    };
    setQuestions([...questions, newQuestion]);
  };
  
  const removeQuestion = (id: string) => {
    setQuestions(questions.filter(q => q.id !== id));
  };
  
  const updateQuestion = (id: string, updates: Partial<ScreeningQuestion>) => {
    setQuestions(questions.map(q => q.id === id ? { ...q, ...updates } : q));
  };
  
  const onSubmit = async (values: FormValues) => {
    const testData = {
      title: values.title,
      description: values.description,
      test_type: values.test_type,
      duration_minutes: values.duration_minutes,
      passing_score: values.passing_score,
      is_template: values.is_template,
      questions,
      job_id: values.job_id || null,
    };
    
    if (editingTest) {
      await updateTest.mutateAsync({ id: editingTest.id, ...testData });
    } else {
      await createTest.mutateAsync(testData);
    }
    
    onOpenChange(false);
    form.reset();
    setQuestions([]);
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editingTest ? 'Edit Screening Test' : 'Create Screening Test'}</DialogTitle>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Test Title</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Technical Assessment" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="test_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Test Type</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="questionnaire">Questionnaire</SelectItem>
                        <SelectItem value="coding">Coding Test</SelectItem>
                        <SelectItem value="personality">Personality Assessment</SelectItem>
                        <SelectItem value="skills">Skills Test</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Describe the purpose of this test..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <div className="grid grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="duration_minutes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Duration (minutes)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        {...field} 
                        onChange={e => field.onChange(parseInt(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="passing_score"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Passing Score (%)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        {...field}
                        onChange={e => field.onChange(parseInt(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="is_template"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <FormLabel>Reusable Template</FormLabel>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
            
            {/* Questions Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-lg font-semibold">Questions</Label>
                <Button type="button" variant="outline" size="sm" onClick={addQuestion}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Question
                </Button>
              </div>
              
              {questions.length === 0 ? (
                <Card className="border-dashed">
                  <CardContent className="py-8 text-center text-muted-foreground">
                    No questions added yet. Click "Add Question" to get started.
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  {questions.map((question, index) => (
                    <Card key={question.id}>
                      <CardHeader className="py-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <GripVertical className="h-4 w-4 text-muted-foreground" />
                            <CardTitle className="text-sm">Question {index + 1}</CardTitle>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeQuestion(question.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Question Type</Label>
                            <Select
                              value={question.type}
                              onValueChange={(value) => updateQuestion(question.id, { 
                                type: value as ScreeningQuestion['type'],
                                options: value === 'multiple_choice' ? ['', '', '', ''] : undefined,
                              })}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="multiple_choice">Multiple Choice</SelectItem>
                                <SelectItem value="text">Text Answer</SelectItem>
                                <SelectItem value="yes_no">Yes/No</SelectItem>
                                <SelectItem value="rating">Rating (1-5)</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          
                          <div className="space-y-2">
                            <Label>Points</Label>
                            <Input
                              type="number"
                              value={question.points}
                              onChange={(e) => updateQuestion(question.id, { points: parseInt(e.target.value) || 10 })}
                            />
                          </div>
                        </div>
                        
                        <div className="space-y-2">
                          <Label>Question</Label>
                          <Textarea
                            value={question.question}
                            onChange={(e) => updateQuestion(question.id, { question: e.target.value })}
                            placeholder="Enter your question..."
                          />
                        </div>
                        
                        {question.type === 'multiple_choice' && question.options && (
                          <div className="space-y-2">
                            <Label>Options</Label>
                            {question.options.map((option, optIndex) => (
                              <div key={optIndex} className="flex items-center gap-2">
                                <Input
                                  value={option}
                                  onChange={(e) => {
                                    const newOptions = [...question.options!];
                                    newOptions[optIndex] = e.target.value;
                                    updateQuestion(question.id, { options: newOptions });
                                  }}
                                  placeholder={`Option ${optIndex + 1}`}
                                />
                                <input
                                  type="radio"
                                  name={`correct-${question.id}`}
                                  checked={question.correctAnswer === optIndex}
                                  onChange={() => updateQuestion(question.id, { correctAnswer: optIndex })}
                                  title="Mark as correct answer"
                                />
                              </div>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
            
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={createTest.isPending || updateTest.isPending}
              >
                {editingTest ? 'Update Test' : 'Create Test'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
