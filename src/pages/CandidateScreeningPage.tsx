import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { Clock, AlertCircle, CheckCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ScreeningQuestion } from '@/hooks/useRecruitmentWorkflow';

interface ScreeningData {
  id: string;
  status: string;
  expires_at: string;
  started_at: string | null;
  screening_test: {
    id: string;
    title: string;
    description: string | null;
    duration_minutes: number;
    questions: ScreeningQuestion[];
    passing_score: number;
  };
  candidate: {
    first_name: string;
    last_name: string;
  };
}

export default function CandidateScreeningPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');
  
  const [screening, setScreening] = useState<ScreeningData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string | number>>({});
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  
  // Fetch screening data
  useEffect(() => {
    const fetchScreening = async () => {
      if (!token) {
        setError('Invalid screening link');
        setIsLoading(false);
        return;
      }
      
      try {
        const { data, error: fetchError } = await supabase
          .from('candidate_screenings')
          .select(`
            id,
            status,
            expires_at,
            started_at,
            screening_test:screening_tests(
              id,
              title,
              description,
              duration_minutes,
              questions,
              passing_score
            ),
            candidate:candidates(first_name, last_name)
          `)
          .eq('access_token', token)
          .single();
        
        if (fetchError) throw fetchError;
        
        if (!data) {
          setError('Screening not found');
          return;
        }
        
        // Check if expired
        if (new Date(data.expires_at) < new Date()) {
          setError('This screening link has expired');
          return;
        }
        
        // Check if already completed
        if (data.status === 'completed' || data.status === 'passed' || data.status === 'failed') {
          setIsCompleted(true);
        }
        
        setScreening({
          ...data,
          screening_test: {
            ...data.screening_test,
            questions: (data.screening_test?.questions as unknown as ScreeningQuestion[]) || [],
          },
        } as ScreeningData);
        
        // Calculate time remaining
        if (data.started_at && data.screening_test) {
          const startTime = new Date(data.started_at).getTime();
          const durationMs = data.screening_test.duration_minutes * 60 * 1000;
          const endTime = startTime + durationMs;
          const remaining = Math.max(0, Math.floor((endTime - Date.now()) / 1000));
          setTimeRemaining(remaining);
        }
      } catch (err) {
        console.error('Error fetching screening:', err);
        setError('Failed to load screening');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchScreening();
  }, [token]);
  
  // Timer countdown
  useEffect(() => {
    if (timeRemaining === null || timeRemaining <= 0 || isCompleted) return;
    
    const timer = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(timer);
          handleSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    return () => clearInterval(timer);
  }, [timeRemaining, isCompleted]);
  
  const startScreening = async () => {
    if (!screening) return;
    
    try {
      const { error } = await supabase
        .from('candidate_screenings')
        .update({
          status: 'in_progress',
          started_at: new Date().toISOString(),
        })
        .eq('id', screening.id);
      
      if (error) throw error;
      
      setScreening({
        ...screening,
        status: 'in_progress',
        started_at: new Date().toISOString(),
      });
      
      setTimeRemaining(screening.screening_test.duration_minutes * 60);
    } catch (err) {
      console.error('Error starting screening:', err);
      toast.error('Failed to start screening');
    }
  };
  
  const handleAnswerChange = (questionId: string, answer: string | number) => {
    setAnswers({ ...answers, [questionId]: answer });
  };
  
  const handleSubmit = async () => {
    if (!screening || isSubmitting) return;
    
    setIsSubmitting(true);
    
    try {
      // Calculate score
      let totalPoints = 0;
      let earnedPoints = 0;
      
      screening.screening_test.questions.forEach((question) => {
        totalPoints += question.points;
        
        const answer = answers[question.id];
        if (answer !== undefined) {
          if (question.type === 'multiple_choice' && question.correctAnswer !== undefined) {
            if (answer === question.correctAnswer) {
              earnedPoints += question.points;
            }
          } else if (question.type === 'yes_no' && question.correctAnswer !== undefined) {
            if (answer === question.correctAnswer) {
              earnedPoints += question.points;
            }
          } else if (question.type === 'text' || question.type === 'rating') {
            // Text and rating questions need manual evaluation
            earnedPoints += question.points * 0.5; // Give partial credit
          }
        }
      });
      
      const score = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0;
      const status = score >= screening.screening_test.passing_score ? 'passed' : 'completed';
      
      const { error } = await supabase
        .from('candidate_screenings')
        .update({
          status,
          score,
          completed_at: new Date().toISOString(),
          answers: Object.entries(answers).map(([questionId, answer]) => ({
            questionId,
            answer,
          })),
        })
        .eq('id', screening.id);
      
      if (error) throw error;
      
      setIsCompleted(true);
      toast.success('Screening submitted successfully!');
    } catch (err) {
      console.error('Error submitting screening:', err);
      toast.error('Failed to submit screening');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto" />
          <p className="mt-4 text-muted-foreground">Loading screening...</p>
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Unable to Access Screening</h2>
            <p className="text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  if (isCompleted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Screening Completed</h2>
            <p className="text-muted-foreground">
              Thank you for completing the screening test. The hiring team will review your responses and get back to you.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  if (!screening) return null;
  
  // Not started yet - show intro
  if (screening.status === 'pending') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-2xl w-full">
          <CardHeader>
            <CardTitle className="text-2xl">{screening.screening_test.title}</CardTitle>
            <CardDescription>
              Welcome, {screening.candidate.first_name}! Please read the instructions carefully before starting.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {screening.screening_test.description && (
              <p className="text-muted-foreground">{screening.screening_test.description}</p>
            )}
            
            <Alert>
              <Clock className="h-4 w-4" />
              <AlertDescription>
                <strong>Time Limit:</strong> You have {screening.screening_test.duration_minutes} minutes to complete this test.
                Once you start, the timer cannot be paused.
              </AlertDescription>
            </Alert>
            
            <div className="space-y-2">
              <p><strong>Total Questions:</strong> {screening.screening_test.questions.length}</p>
              <p><strong>Passing Score:</strong> {screening.screening_test.passing_score}%</p>
              <p><strong>Expires:</strong> {format(new Date(screening.expires_at), 'PPP p')}</p>
            </div>
            
            <Button size="lg" className="w-full" onClick={startScreening}>
              Start Screening
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  // In progress - show questions
  const currentQuestion = screening.screening_test.questions[currentQuestionIndex];
  const progress = ((currentQuestionIndex + 1) / screening.screening_test.questions.length) * 100;
  
  return (
    <div className="min-h-screen bg-background">
      {/* Header with timer */}
      <div className="sticky top-0 bg-background border-b z-10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="font-semibold">{screening.screening_test.title}</h1>
            <p className="text-sm text-muted-foreground">
              Question {currentQuestionIndex + 1} of {screening.screening_test.questions.length}
            </p>
          </div>
          
          {timeRemaining !== null && (
            <div className={`flex items-center gap-2 px-3 py-1 rounded-full ${
              timeRemaining < 300 ? 'bg-destructive/10 text-destructive' : 'bg-muted'
            }`}>
              <Clock className="h-4 w-4" />
              <span className="font-mono font-medium">{formatTime(timeRemaining)}</span>
            </div>
          )}
        </div>
        <Progress value={progress} className="h-1" />
      </div>
      
      {/* Question */}
      <div className="max-w-3xl mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              {currentQuestion.question}
            </CardTitle>
            <CardDescription>
              {currentQuestion.points} points
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {currentQuestion.type === 'multiple_choice' && currentQuestion.options && (
              <RadioGroup
                value={answers[currentQuestion.id]?.toString() || ''}
                onValueChange={(value) => handleAnswerChange(currentQuestion.id, parseInt(value))}
              >
                {currentQuestion.options.map((option, index) => (
                  <div key={index} className="flex items-center space-x-2">
                    <RadioGroupItem value={index.toString()} id={`option-${index}`} />
                    <Label htmlFor={`option-${index}`} className="font-normal cursor-pointer">
                      {option}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            )}
            
            {currentQuestion.type === 'yes_no' && (
              <RadioGroup
                value={answers[currentQuestion.id]?.toString() || ''}
                onValueChange={(value) => handleAnswerChange(currentQuestion.id, value)}
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="yes" id="yes" />
                  <Label htmlFor="yes" className="font-normal cursor-pointer">Yes</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="no" id="no" />
                  <Label htmlFor="no" className="font-normal cursor-pointer">No</Label>
                </div>
              </RadioGroup>
            )}
            
            {currentQuestion.type === 'text' && (
              <Textarea
                placeholder="Type your answer here..."
                value={(answers[currentQuestion.id] as string) || ''}
                onChange={(e) => handleAnswerChange(currentQuestion.id, e.target.value)}
                className="min-h-[150px]"
              />
            )}
            
            {currentQuestion.type === 'rating' && (
              <RadioGroup
                value={answers[currentQuestion.id]?.toString() || ''}
                onValueChange={(value) => handleAnswerChange(currentQuestion.id, parseInt(value))}
                className="flex gap-4"
              >
                {[1, 2, 3, 4, 5].map((rating) => (
                  <div key={rating} className="flex flex-col items-center">
                    <RadioGroupItem value={rating.toString()} id={`rating-${rating}`} />
                    <Label htmlFor={`rating-${rating}`} className="font-normal">{rating}</Label>
                  </div>
                ))}
              </RadioGroup>
            )}
          </CardContent>
        </Card>
        
        {/* Navigation */}
        <div className="flex items-center justify-between mt-6">
          <Button
            variant="outline"
            onClick={() => setCurrentQuestionIndex(Math.max(0, currentQuestionIndex - 1))}
            disabled={currentQuestionIndex === 0}
          >
            <ChevronLeft className="h-4 w-4 mr-2" />
            Previous
          </Button>
          
          {currentQuestionIndex < screening.screening_test.questions.length - 1 ? (
            <Button
              onClick={() => setCurrentQuestionIndex(currentQuestionIndex + 1)}
            >
              Next
              <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Submitting...' : 'Submit Screening'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
