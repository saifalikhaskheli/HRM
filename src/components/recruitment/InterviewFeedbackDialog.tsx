import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { useSubmitFeedback } from '@/hooks/useRecruitmentWorkflow';
import { toast } from 'sonner';
import { Star } from 'lucide-react';

interface InterviewFeedbackDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  interviewId: string;
  panelistId: string;
  candidateName: string;
}

export function InterviewFeedbackDialog({
  open,
  onOpenChange,
  interviewId,
  panelistId,
  candidateName,
}: InterviewFeedbackDialogProps) {
  const submitFeedback = useSubmitFeedback();
  
  const [overallRating, setOverallRating] = useState(3);
  const [technicalRating, setTechnicalRating] = useState(3);
  const [communicationRating, setCommunicationRating] = useState(3);
  const [cultureFitRating, setCultureFitRating] = useState(3);
  const [strengths, setStrengths] = useState('');
  const [weaknesses, setWeaknesses] = useState('');
  const [recommendation, setRecommendation] = useState<string>('');
  const [detailedNotes, setDetailedNotes] = useState('');

  const handleSubmit = () => {
    if (!recommendation) {
      toast.error('Please select a recommendation');
      return;
    }

    submitFeedback.mutate({
      interview_id: interviewId,
      panelist_id: panelistId,
      overall_rating: overallRating,
      technical_rating: technicalRating,
      communication_rating: communicationRating,
      culture_fit_rating: cultureFitRating,
      strengths,
      weaknesses,
      recommendation: recommendation as any,
      detailed_notes: detailedNotes,
    }, {
      onSuccess: () => {
        toast.success('Feedback submitted successfully');
        onOpenChange(false);
        resetForm();
      },
      onError: () => {
        toast.error('Failed to submit feedback');
      },
    });
  };

  const resetForm = () => {
    setOverallRating(3);
    setTechnicalRating(3);
    setCommunicationRating(3);
    setCultureFitRating(3);
    setStrengths('');
    setWeaknesses('');
    setRecommendation('');
    setDetailedNotes('');
  };

  const RatingSlider = ({ 
    label, 
    value, 
    onChange 
  }: { 
    label: string; 
    value: number; 
    onChange: (value: number) => void;
  }) => (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-sm">{label}</Label>
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((star) => (
            <Star
              key={star}
              className={`h-4 w-4 ${star <= value ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'}`}
            />
          ))}
        </div>
      </div>
      <Slider
        value={[value]}
        onValueChange={([v]) => onChange(v)}
        min={1}
        max={5}
        step={1}
        className="w-full"
      />
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Submit Interview Feedback</DialogTitle>
          <DialogDescription>
            Provide your evaluation for {candidateName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Rating Section */}
          <div className="space-y-4">
            <h4 className="font-medium text-sm">Ratings</h4>
            <div className="grid gap-4 p-4 border rounded-lg bg-muted/30">
              <RatingSlider 
                label="Overall Impression" 
                value={overallRating} 
                onChange={setOverallRating} 
              />
              <RatingSlider 
                label="Technical Skills" 
                value={technicalRating} 
                onChange={setTechnicalRating} 
              />
              <RatingSlider 
                label="Communication" 
                value={communicationRating} 
                onChange={setCommunicationRating} 
              />
              <RatingSlider 
                label="Culture Fit" 
                value={cultureFitRating} 
                onChange={setCultureFitRating} 
              />
            </div>
          </div>

          {/* Strengths */}
          <div className="space-y-2">
            <Label htmlFor="strengths">Strengths</Label>
            <Textarea
              id="strengths"
              placeholder="What stood out positively about this candidate?"
              value={strengths}
              onChange={(e) => setStrengths(e.target.value)}
              rows={3}
            />
          </div>

          {/* Weaknesses */}
          <div className="space-y-2">
            <Label htmlFor="weaknesses">Areas for Improvement</Label>
            <Textarea
              id="weaknesses"
              placeholder="What concerns or gaps did you identify?"
              value={weaknesses}
              onChange={(e) => setWeaknesses(e.target.value)}
              rows={3}
            />
          </div>

          {/* Recommendation */}
          <div className="space-y-2">
            <Label htmlFor="recommendation">Recommendation *</Label>
            <Select value={recommendation} onValueChange={setRecommendation}>
              <SelectTrigger>
                <SelectValue placeholder="Select your recommendation" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="strong_hire">
                  <span className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-green-500" />
                    Strong Hire
                  </span>
                </SelectItem>
                <SelectItem value="hire">
                  <span className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-green-400" />
                    Hire
                  </span>
                </SelectItem>
                <SelectItem value="neutral">
                  <span className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-yellow-400" />
                    Neutral
                  </span>
                </SelectItem>
                <SelectItem value="no_hire">
                  <span className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-red-400" />
                    No Hire
                  </span>
                </SelectItem>
                <SelectItem value="strong_no_hire">
                  <span className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-red-500" />
                    Strong No Hire
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Detailed Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Additional Notes</Label>
            <Textarea
              id="notes"
              placeholder="Any other observations or comments..."
              value={detailedNotes}
              onChange={(e) => setDetailedNotes(e.target.value)}
              rows={4}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitFeedback.isPending}>
            {submitFeedback.isPending ? 'Submitting...' : 'Submit Feedback'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
