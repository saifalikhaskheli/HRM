import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { format } from 'date-fns';
import { 
  ArrowLeft, 
  Mail, 
  Phone, 
  Linkedin, 
  Globe, 
  FileText, 
  Calendar, 
  ClipboardCheck,
  DollarSign,
  MoreVertical,
  Star,
  ExternalLink,
  UserPlus,
  CheckCircle2,
  Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ModuleGuard } from '@/components/ModuleGuard';
import { CandidateStatusBadge } from '@/components/recruitment/CandidateStatusBadge';
import { CandidateTimelineCard } from '@/components/recruitment/CandidateTimelineCard';
import { AssignScreeningDialog } from '@/components/recruitment/AssignScreeningDialog';
import { ScheduleInterviewDialog } from '@/components/recruitment/ScheduleInterviewDialog';
import { CreateOfferDialog } from '@/components/recruitment/CreateOfferDialog';
import { useCandidate, useUpdateCandidateStatus } from '@/hooks/useRecruitment';
import { useCandidateScreenings, useInterviews, useOffers, useConvertCandidateToEmployee, useUpdateOfferStatus } from '@/hooks/useRecruitmentWorkflow';
import { toast } from 'sonner';

const statusFlow = [
  'applied',
  'screening',
  'interviewing',
  'offered',
  'hired',
] as const;

export default function CandidateDetailPage() {
  const { candidateId } = useParams<{ candidateId: string }>();
  const navigate = useNavigate();
  
  const [showAssignScreening, setShowAssignScreening] = useState(false);
  const [showScheduleInterview, setShowScheduleInterview] = useState(false);
  const [showCreateOffer, setShowCreateOffer] = useState(false);
  
  const { data: candidate, isLoading } = useCandidate(candidateId || null);
  const { data: screenings } = useCandidateScreenings(candidateId);
  const { data: interviews } = useInterviews(candidateId);
  const { data: offers } = useOffers(candidateId);
  const updateStatus = useUpdateCandidateStatus();
  const convertToEmployee = useConvertCandidateToEmployee();
  const updateOfferStatus = useUpdateOfferStatus();
  
  // Find accepted offer
  const acceptedOffer = offers?.find(o => o.status === 'accepted');
  const sentOffer = offers?.find(o => o.status === 'sent');
  const isHired = candidate?.status === 'hired';
  
  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/4" />
          <div className="h-32 bg-muted rounded" />
        </div>
      </div>
    );
  }
  
  if (!candidate) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <p className="text-muted-foreground">Candidate not found</p>
          <Button variant="outline" onClick={() => navigate('/app/recruitment')} className="mt-4">
            Back to Recruitment
          </Button>
        </div>
      </div>
    );
  }
  
  const candidateName = `${candidate.first_name} ${candidate.last_name}`;
  const currentStatusIndex = statusFlow.indexOf(candidate.status as typeof statusFlow[number]);
  
  const handleMoveToNextStage = async () => {
    if (currentStatusIndex >= statusFlow.length - 1) return;
    const nextStatus = statusFlow[currentStatusIndex + 1];
    await updateStatus.mutateAsync({ id: candidate.id, status: nextStatus });
    toast.success(`Moved to ${nextStatus}`);
  };
  
  const handleReject = async () => {
    await updateStatus.mutateAsync({ 
      id: candidate.id, 
      status: 'rejected',
      rejected_reason: 'Not a fit for the role'
    });
    toast.success('Candidate rejected');
  };
  
  const handleAcceptOffer = async (offerId: string) => {
    await updateOfferStatus.mutateAsync({
      id: offerId,
      candidateId: candidate.id,
      status: 'accepted',
      respondedAt: new Date().toISOString(),
    });
  };
  
  const handleConvertToEmployee = async () => {
    if (!acceptedOffer) return;
    const employeeId = await convertToEmployee.mutateAsync({
      candidateId: candidate.id,
      offerId: acceptedOffer.id,
      createLogin: false,
    });
    if (employeeId) {
      navigate(`/app/employees`);
    }
  };
  
  return (
    <ModuleGuard moduleId="recruitment">
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/app/recruitment')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            
            <Avatar className="h-16 w-16">
              <AvatarFallback className="text-xl">
                {candidate.first_name[0]}{candidate.last_name[0]}
              </AvatarFallback>
            </Avatar>
            
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold">{candidateName}</h1>
                <CandidateStatusBadge status={candidate.status} />
              </div>
              <p className="text-muted-foreground">
                Applied for {(candidate as any).job?.title || 'Unknown Position'}
              </p>
              <p className="text-sm text-muted-foreground">
                Applied {format(new Date(candidate.created_at), 'PPP')}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  Actions
                  <MoreVertical className="h-4 w-4 ml-2" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setShowAssignScreening(true)}>
                  <ClipboardCheck className="h-4 w-4 mr-2" />
                  Assign Screening
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setShowScheduleInterview(true)}>
                  <Calendar className="h-4 w-4 mr-2" />
                  Schedule Interview
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setShowCreateOffer(true)}>
                  <DollarSign className="h-4 w-4 mr-2" />
                  Create Offer
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleMoveToNextStage} disabled={currentStatusIndex >= statusFlow.length - 1}>
                  Move to Next Stage
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleReject} className="text-destructive">
                  Reject Candidate
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        
        {/* Hired Success Banner */}
        {isHired && candidate.hired_employee_id && (
          <Alert className="bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertTitle className="text-green-800 dark:text-green-200">Candidate Hired!</AlertTitle>
            <AlertDescription className="text-green-700 dark:text-green-300">
              This candidate has been converted to an employee.{' '}
              <Link to="/app/employees" className="underline font-medium">
                View Employee Record
              </Link>
            </AlertDescription>
          </Alert>
        )}
        
        {/* Accepted Offer - Convert to Employee Banner */}
        {acceptedOffer && !candidate.hired_employee_id && (
          <Alert className="bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-800">
            <UserPlus className="h-4 w-4 text-blue-600" />
            <AlertTitle className="text-blue-800 dark:text-blue-200">Offer Accepted!</AlertTitle>
            <AlertDescription className="text-blue-700 dark:text-blue-300 flex items-center justify-between">
              <span>
                Candidate accepted the offer. Convert them to an employee to complete the hiring process.
              </span>
              <Button 
                size="sm" 
                onClick={handleConvertToEmployee}
                disabled={convertToEmployee.isPending}
              >
                {convertToEmployee.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <UserPlus className="h-4 w-4 mr-2" />
                )}
                Convert to Employee
              </Button>
            </AlertDescription>
          </Alert>
        )}
        
        {/* Pending Offer - Mark as Accepted */}
        {sentOffer && !acceptedOffer && (
          <Alert className="bg-amber-50 border-amber-200 dark:bg-amber-950 dark:border-amber-800">
            <DollarSign className="h-4 w-4 text-amber-600" />
            <AlertTitle className="text-amber-800 dark:text-amber-200">Offer Sent</AlertTitle>
            <AlertDescription className="text-amber-700 dark:text-amber-300 flex items-center justify-between">
              <span>
                Waiting for candidate response. If they accepted verbally, you can mark it as accepted.
              </span>
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => handleAcceptOffer(sentOffer.id)}
                disabled={updateOfferStatus.isPending}
              >
                {updateOfferStatus.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Mark as Accepted
              </Button>
            </AlertDescription>
          </Alert>
        )}
        
        {/* Stage Progress */}
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              {statusFlow.map((stage, index) => (
                <div key={stage} className="flex items-center">
                  <div className={`
                    flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium
                    ${index <= currentStatusIndex 
                      ? 'bg-primary text-primary-foreground' 
                      : 'bg-muted text-muted-foreground'
                    }
                  `}>
                    {index + 1}
                  </div>
                  <span className={`ml-2 text-sm capitalize ${
                    index <= currentStatusIndex ? 'font-medium' : 'text-muted-foreground'
                  }`}>
                    {stage}
                  </span>
                  {index < statusFlow.length - 1 && (
                    <div className={`w-12 h-0.5 mx-4 ${
                      index < currentStatusIndex ? 'bg-primary' : 'bg-muted'
                    }`} />
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        
        <div className="grid grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="col-span-2">
            <Tabs defaultValue="overview">
              <TabsList>
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="screenings">
                  Screenings {screenings && screenings.length > 0 && `(${screenings.length})`}
                </TabsTrigger>
                <TabsTrigger value="interviews">
                  Interviews {interviews && interviews.length > 0 && `(${interviews.length})`}
                </TabsTrigger>
                <TabsTrigger value="offers">
                  Offers {offers && offers.length > 0 && `(${offers.length})`}
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="overview" className="space-y-4 mt-4">
                {/* Contact Info */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Contact Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <a href={`mailto:${candidate.email}`} className="hover:underline">
                        {candidate.email}
                      </a>
                    </div>
                    {candidate.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <span>{candidate.phone}</span>
                      </div>
                    )}
                    {candidate.linkedin_url && (
                      <div className="flex items-center gap-2">
                        <Linkedin className="h-4 w-4 text-muted-foreground" />
                        <a href={candidate.linkedin_url} target="_blank" rel="noopener noreferrer" className="hover:underline flex items-center gap-1">
                          LinkedIn Profile
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    )}
                    {candidate.portfolio_url && (
                      <div className="flex items-center gap-2">
                        <Globe className="h-4 w-4 text-muted-foreground" />
                        <a href={candidate.portfolio_url} target="_blank" rel="noopener noreferrer" className="hover:underline flex items-center gap-1">
                          Portfolio
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    )}
                  </CardContent>
                </Card>
                
                {/* Cover Letter */}
                {candidate.cover_letter && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Cover Letter</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="whitespace-pre-wrap text-sm">{candidate.cover_letter}</p>
                    </CardContent>
                  </Card>
                )}
                
                {/* Resume */}
                {candidate.resume_url && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Resume</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Button variant="outline" asChild>
                        <a href={candidate.resume_url} target="_blank" rel="noopener noreferrer">
                          <FileText className="h-4 w-4 mr-2" />
                          View Resume
                        </a>
                      </Button>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>
              
              <TabsContent value="screenings" className="space-y-4 mt-4">
                {!screenings || screenings.length === 0 ? (
                  <Card>
                    <CardContent className="py-8 text-center">
                      <ClipboardCheck className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <p className="text-muted-foreground">No screening tests assigned yet</p>
                      <Button className="mt-4" onClick={() => setShowAssignScreening(true)}>
                        Assign Screening Test
                      </Button>
                    </CardContent>
                  </Card>
                ) : (
                  screenings.map((screening) => (
                    <Card key={screening.id}>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-lg">
                            {screening.screening_test?.title || 'Screening Test'}
                          </CardTitle>
                          <Badge variant={
                            screening.status === 'passed' ? 'default' :
                            screening.status === 'failed' ? 'destructive' :
                            screening.status === 'expired' ? 'secondary' :
                            'outline'
                          }>
                            {screening.status}
                          </Badge>
                        </div>
                        <CardDescription>
                          Assigned {format(new Date(screening.assigned_at), 'PPP')}
                          {screening.expires_at && ` • Expires ${format(new Date(screening.expires_at), 'PPP')}`}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        {screening.score !== null && (
                          <div className="flex items-center gap-4">
                            <div>
                              <p className="text-sm text-muted-foreground">Score</p>
                              <p className="text-2xl font-bold">{screening.score}%</p>
                            </div>
                            {screening.evaluation_notes && (
                              <div className="flex-1">
                                <p className="text-sm text-muted-foreground">Notes</p>
                                <p className="text-sm">{screening.evaluation_notes}</p>
                              </div>
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))
                )}
              </TabsContent>
              
              <TabsContent value="interviews" className="space-y-4 mt-4">
                {!interviews || interviews.length === 0 ? (
                  <Card>
                    <CardContent className="py-8 text-center">
                      <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <p className="text-muted-foreground">No interviews scheduled yet</p>
                      <Button className="mt-4" onClick={() => setShowScheduleInterview(true)}>
                        Schedule Interview
                      </Button>
                    </CardContent>
                  </Card>
                ) : (
                  interviews.map((interview) => (
                    <Card key={interview.id}>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-lg">{interview.title}</CardTitle>
                          <Badge variant={
                            interview.status === 'completed' ? 'default' :
                            interview.status === 'cancelled' ? 'destructive' :
                            'outline'
                          }>
                            {interview.status}
                          </Badge>
                        </div>
                        <CardDescription>
                          Round {interview.round_number} • {interview.interview_type}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center gap-4 text-sm">
                          <div className="flex items-center gap-1">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            {format(new Date(interview.scheduled_at), 'PPP p')}
                          </div>
                          <div>{interview.duration_minutes} minutes</div>
                        </div>
                        {interview.panelists && interview.panelists.length > 0 && (
                          <div className="mt-3">
                            <p className="text-sm text-muted-foreground mb-1">Interviewers:</p>
                            <div className="flex flex-wrap gap-2">
                              {interview.panelists.map((panelist) => (
                                <Badge key={panelist.id} variant="secondary">
                                  {panelist.employee?.first_name} {panelist.employee?.last_name}
                                  {panelist.feedback_submitted && (
                                    <Star className="h-3 w-3 ml-1 fill-current" />
                                  )}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))
                )}
              </TabsContent>
              
              <TabsContent value="offers" className="space-y-4 mt-4">
                {!offers || offers.length === 0 ? (
                  <Card>
                    <CardContent className="py-8 text-center">
                      <DollarSign className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <p className="text-muted-foreground">No offers created yet</p>
                      <Button className="mt-4" onClick={() => setShowCreateOffer(true)}>
                        Create Offer
                      </Button>
                    </CardContent>
                  </Card>
                ) : (
                  offers.map((offer) => (
                    <Card key={offer.id}>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-lg">{offer.job?.title || 'Job Offer'}</CardTitle>
                          <Badge variant={
                            offer.status === 'accepted' ? 'default' :
                            offer.status === 'declined' || offer.status === 'withdrawn' ? 'destructive' :
                            offer.status === 'sent' ? 'secondary' :
                            'outline'
                          }>
                            {offer.status}
                          </Badge>
                        </div>
                        <CardDescription>
                          Created {format(new Date(offer.created_at), 'PPP')}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-3 gap-4">
                          <div>
                            <p className="text-sm text-muted-foreground">Salary</p>
                            <p className="font-medium">
                              {offer.salary_currency} {offer.salary_offered.toLocaleString()}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Start Date</p>
                            <p className="font-medium">{format(new Date(offer.start_date), 'PPP')}</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Expires</p>
                            <p className="font-medium">{format(new Date(offer.offer_expiry_date), 'PPP')}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </TabsContent>
            </Tabs>
          </div>
          
          {/* Sidebar */}
          <div className="space-y-4">
            {/* Rating */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Rating</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className={`h-6 w-6 ${
                        (candidate.rating || 0) >= star
                          ? 'text-yellow-500 fill-yellow-500'
                          : 'text-muted-foreground'
                      }`}
                    />
                  ))}
                  <span className="ml-2 text-lg font-medium">
                    {candidate.rating || 'Not rated'}
                  </span>
                </div>
              </CardContent>
            </Card>
            
            {/* Source */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Source</CardTitle>
              </CardHeader>
              <CardContent>
                <p>{candidate.source || 'Direct Application'}</p>
              </CardContent>
            </Card>
            
            {/* Timeline */}
            <CandidateTimelineCard candidateId={candidate.id} />
          </div>
        </div>
        
        {/* Dialogs */}
        <AssignScreeningDialog
          open={showAssignScreening}
          onOpenChange={setShowAssignScreening}
          candidateId={candidate.id}
          candidateName={candidateName}
          jobId={candidate.job_id}
        />
        
        <ScheduleInterviewDialog
          open={showScheduleInterview}
          onOpenChange={setShowScheduleInterview}
          candidateId={candidate.id}
          candidateName={candidateName}
          currentRound={(interviews?.length || 0) + 1}
        />
        
        <CreateOfferDialog
          open={showCreateOffer}
          onOpenChange={setShowCreateOffer}
          candidateId={candidate.id}
          candidateName={candidateName}
          jobId={candidate.job_id}
          jobTitle={(candidate as any).job?.title || 'Position'}
        />
      </div>
    </ModuleGuard>
  );
}
