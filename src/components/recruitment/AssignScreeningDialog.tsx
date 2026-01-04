import { useState } from 'react';
import { format, addDays, addHours } from 'date-fns';
import { Calendar, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useScreeningTests, useAssignScreening } from '@/hooks/useRecruitmentWorkflow';

interface AssignScreeningDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  candidateId: string;
  candidateName: string;
  jobId?: string;
}

export function AssignScreeningDialog({ 
  open, 
  onOpenChange, 
  candidateId, 
  candidateName,
  jobId 
}: AssignScreeningDialogProps) {
  const [selectedTestId, setSelectedTestId] = useState<string>('');
  const [expiryOption, setExpiryOption] = useState<string>('48h');
  
  const { data: tests, isLoading } = useScreeningTests(jobId);
  const assignScreening = useAssignScreening();
  
  const getExpiryDate = (): Date => {
    const now = new Date();
    switch (expiryOption) {
      case '24h': return addHours(now, 24);
      case '48h': return addHours(now, 48);
      case '72h': return addHours(now, 72);
      case '1w': return addDays(now, 7);
      default: return addHours(now, 48);
    }
  };
  
  const handleAssign = async () => {
    if (!selectedTestId) return;
    
    await assignScreening.mutateAsync({
      candidateId,
      screeningTestId: selectedTestId,
      expiresAt: getExpiryDate(),
    });
    
    onOpenChange(false);
    setSelectedTestId('');
    setExpiryOption('48h');
  };
  
  const selectedTest = tests?.find(t => t.id === selectedTestId);
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Assign Screening Test</DialogTitle>
          <DialogDescription>
            Assign a screening test to {candidateName}. They will receive an email with a link to complete the test.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          <div className="space-y-2">
            <Label>Select Screening Test</Label>
            {isLoading ? (
              <div className="text-sm text-muted-foreground">Loading tests...</div>
            ) : tests && tests.length > 0 ? (
              <Select value={selectedTestId} onValueChange={setSelectedTestId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a test..." />
                </SelectTrigger>
                <SelectContent>
                  {tests.map((test) => (
                    <SelectItem key={test.id} value={test.id}>
                      {test.title} ({test.duration_minutes} min • {test.questions.length} questions)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="text-sm text-muted-foreground">
                No screening tests available. Create one first.
              </div>
            )}
          </div>
          
          {selectedTest && (
            <div className="rounded-lg border p-3 bg-muted/50">
              <div className="font-medium">{selectedTest.title}</div>
              {selectedTest.description && (
                <p className="text-sm text-muted-foreground mt-1">{selectedTest.description}</p>
              )}
              <div className="flex items-center gap-4 mt-2 text-sm">
                <div className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  {selectedTest.duration_minutes} minutes
                </div>
                <div>
                  {selectedTest.questions.length} questions
                </div>
                <div>
                  Pass: {selectedTest.passing_score}%
                </div>
              </div>
            </div>
          )}
          
          <div className="space-y-2">
            <Label>Expiry Time</Label>
            <RadioGroup value={expiryOption} onValueChange={setExpiryOption}>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="24h" id="24h" />
                  <Label htmlFor="24h" className="font-normal">24 hours</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="48h" id="48h" />
                  <Label htmlFor="48h" className="font-normal">48 hours</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="72h" id="72h" />
                  <Label htmlFor="72h" className="font-normal">72 hours</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="1w" id="1w" />
                  <Label htmlFor="1w" className="font-normal">1 week</Label>
                </div>
              </div>
            </RadioGroup>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              Expires: {format(getExpiryDate(), 'PPP p')}
            </p>
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleAssign} 
            disabled={!selectedTestId || assignScreening.isPending}
          >
            {assignScreening.isPending ? 'Assigning...' : 'Assign Test'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
