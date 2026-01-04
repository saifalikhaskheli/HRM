import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { Plus, Briefcase, Users, ExternalLink, MoreHorizontal, MapPin, ClipboardList, Calendar, FileText, Eye, Settings } from 'lucide-react';
import { TablePagination } from '@/components/ui/table-pagination';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { WriteGate, RoleGate } from '@/components/PermissionGate';
import { ModuleGuard } from '@/components/ModuleGuard';
import { useJobs, useCandidates, usePipelineStats, useUpdateCandidateStatus, useUpdateJob } from '@/hooks/useRecruitment';
import { useCandidateScreenings, useInterviews, useOffers } from '@/hooks/useRecruitmentWorkflow';
import { useUserRole } from '@/hooks/useUserRole';
import { JobFormDialog } from '@/components/recruitment/JobFormDialog';
import { CandidateStatusBadge } from '@/components/recruitment/CandidateStatusBadge';
import { AssignScreeningDialog } from '@/components/recruitment/AssignScreeningDialog';
import { ScheduleInterviewDialog } from '@/components/recruitment/ScheduleInterviewDialog';
import { CreateOfferDialog } from '@/components/recruitment/CreateOfferDialog';
import { ScreeningTestsManager } from '@/components/recruitment/ScreeningTestsManager';
import { CandidateAuthSettings } from '@/components/recruitment/CandidateAuthSettings';

export default function RecruitmentPage() {
  const navigate = useNavigate();
  const { isHROrAbove } = useUserRole();
  const { data: jobs = [], isLoading: jobsLoading } = useJobs();
  const { data: candidates = [], isLoading: candidatesLoading } = useCandidates();
  const { data: screenings = [] } = useCandidateScreenings();
  const { data: interviews = [] } = useInterviews();
  const { data: offers = [] } = useOffers();
  const pipelineStats = usePipelineStats();
  const updateJob = useUpdateJob();
  const updateCandidateStatus = useUpdateCandidateStatus();

  const [activeTab, setActiveTab] = useState('jobs');
  const [jobDialogOpen, setJobDialogOpen] = useState(false);
  const [editingJob, setEditingJob] = useState<any>(null);
  
  // Pagination state
  const [jobsPage, setJobsPage] = useState(1);
  const [candidatesPage, setCandidatesPage] = useState(1);
  const PAGE_SIZE = 10;
  
  // Workflow dialogs
  const [screeningDialogOpen, setScreeningDialogOpen] = useState(false);
  const [interviewDialogOpen, setInterviewDialogOpen] = useState(false);
  const [offerDialogOpen, setOfferDialogOpen] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState<any>(null);

  const paginatedJobs = useMemo(() => {
    const start = (jobsPage - 1) * PAGE_SIZE;
    return jobs.slice(start, start + PAGE_SIZE);
  }, [jobs, jobsPage]);

  const paginatedCandidates = useMemo(() => {
    const start = (candidatesPage - 1) * PAGE_SIZE;
    return candidates.slice(start, start + PAGE_SIZE);
  }, [candidates, candidatesPage]);

  const openJobs = jobs.filter(j => j.status === 'open');
  const draftJobs = jobs.filter(j => j.status === 'draft');

  // Screening stats
  const pendingScreenings = screenings.filter(s => s.status === 'pending').length;
  const expiredScreenings = screenings.filter(s => s.status === 'expired').length;
  
  // Interview stats
  const upcomingInterviews = interviews.filter(i => i.status === 'scheduled').length;
  
  // Offer stats
  const activeOffers = offers.filter(o => ['sent', 'negotiating'].includes(o.status)).length;

  const handlePublishJob = (id: string) => {
    updateJob.mutate({ id, status: 'open', published_at: new Date().toISOString() });
  };

  const handleCloseJob = (id: string) => {
    updateJob.mutate({ id, status: 'closed' });
  };

  const openAssignScreening = (candidate: any) => {
    setSelectedCandidate(candidate);
    setScreeningDialogOpen(true);
  };

  const openScheduleInterview = (candidate: any) => {
    setSelectedCandidate(candidate);
    setInterviewDialogOpen(true);
  };

  const openCreateOffer = (candidate: any) => {
    setSelectedCandidate(candidate);
    setOfferDialogOpen(true);
  };

  return (
    <ModuleGuard moduleId="recruitment">
      <div className="p-4 md:p-6 space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Recruitment</h1>
            <p className="text-muted-foreground">Manage job postings and candidates</p>
          </div>
          <div className="flex items-center gap-2">
            {openJobs.length > 0 && (
              <Button
                variant="outline"
                onClick={() => window.open('/careers', '_blank')}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                View Careers Page
              </Button>
            )}
            <WriteGate>
              <RoleGate role="hr_manager">
                <Button onClick={() => { setEditingJob(null); setJobDialogOpen(true); }}>
                  <Plus className="h-4 w-4 mr-2" />
                  Post Job
                </Button>
              </RoleGate>
            </WriteGate>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Open Jobs</CardDescription>
              <CardTitle className="text-2xl">{openJobs.length}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Applied</CardDescription>
              <CardTitle className="text-2xl">{pipelineStats.applied}</CardTitle>
            </CardHeader>
          </Card>
          <Card className={pendingScreenings > 0 ? 'border-purple-500/50' : ''}>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1">
                <ClipboardList className="h-3 w-3" />
                Screening
              </CardDescription>
              <CardTitle className="text-2xl">{pipelineStats.screening}</CardTitle>
              {pendingScreenings > 0 && (
                <p className="text-xs text-purple-600">{pendingScreenings} pending</p>
              )}
            </CardHeader>
          </Card>
          <Card className={upcomingInterviews > 0 ? 'border-amber-500/50' : ''}>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                Interviewing
              </CardDescription>
              <CardTitle className="text-2xl">{pipelineStats.interviewing}</CardTitle>
              {upcomingInterviews > 0 && (
                <p className="text-xs text-amber-600">{upcomingInterviews} scheduled</p>
              )}
            </CardHeader>
          </Card>
          <Card className={activeOffers > 0 ? 'border-cyan-500/50' : ''}>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1">
                <FileText className="h-3 w-3" />
                Offered
              </CardDescription>
              <CardTitle className="text-2xl">{pipelineStats.offered}</CardTitle>
              {activeOffers > 0 && (
                <p className="text-xs text-cyan-600">{activeOffers} active</p>
              )}
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Hired</CardDescription>
              <CardTitle className="text-2xl text-green-600">{pipelineStats.hired}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total</CardDescription>
              <CardTitle className="text-2xl">{pipelineStats.total}</CardTitle>
            </CardHeader>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="jobs">Job Postings</TabsTrigger>
            <TabsTrigger value="candidates">Candidates</TabsTrigger>
            <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
            <TabsTrigger value="tests" className="flex items-center gap-1">
              <Settings className="h-3 w-3" />
              Screening Tests
            </TabsTrigger>
            <TabsTrigger value="screenings" className="flex items-center gap-1">
              Screenings
              {pendingScreenings > 0 && (
                <Badge variant="secondary" className="h-5 px-1.5">{pendingScreenings}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="interviews" className="flex items-center gap-1">
              Interviews
              {upcomingInterviews > 0 && (
                <Badge variant="secondary" className="h-5 px-1.5">{upcomingInterviews}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="offers" className="flex items-center gap-1">
              Offers
              {activeOffers > 0 && (
                <Badge variant="secondary" className="h-5 px-1.5">{activeOffers}</Badge>
              )}
            </TabsTrigger>
            {isHROrAbove && (
              <TabsTrigger value="settings" className="flex items-center gap-1">
                <Settings className="h-3 w-3" />
                Settings
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="jobs" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Job Postings</CardTitle>
                <CardDescription>Manage your open positions</CardDescription>
              </CardHeader>
              <CardContent>
                {jobsLoading ? (
                  <div className="text-center py-8 text-muted-foreground">Loading...</div>
                ) : jobs.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Briefcase className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No job postings yet. Create your first job posting to start hiring.</p>
                  </div>
                ) : (
                  <>
                    <div className="rounded-md border">
                      <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Position</TableHead>
                          <TableHead>Department</TableHead>
                          <TableHead>Location</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Candidates</TableHead>
                          <TableHead>Posted</TableHead>
                          <TableHead className="w-[80px]"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginatedJobs.map((job) => {
                          const jobCandidates = candidates.filter(c => c.job_id === job.id);
                          return (
                            <TableRow key={job.id}>
                              <TableCell>
                                <div>
                                  <p className="font-medium">{job.title}</p>
                                  <p className="text-xs text-muted-foreground">{job.employment_type.replace('_', ' ')}</p>
                                </div>
                              </TableCell>
                              <TableCell>{(job.department as any)?.name || '-'}</TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1 text-sm">
                                  <MapPin className="h-3 w-3" />
                                  {job.is_remote ? 'Remote' : job.location || '-'}
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge variant={
                                  job.status === 'open' ? 'default' :
                                  job.status === 'draft' ? 'secondary' :
                                  'outline'
                                }>
                                  {job.status}
                                </Badge>
                              </TableCell>
                              <TableCell>{jobCandidates.length}</TableCell>
                              <TableCell>
                                {job.published_at ? format(new Date(job.published_at), 'MMM d, yyyy') : '-'}
                              </TableCell>
                              <TableCell>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon">
                                      <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => { setEditingJob(job); setJobDialogOpen(true); }}>
                                      Edit
                                    </DropdownMenuItem>
                                    {job.status === 'draft' && (
                                      <DropdownMenuItem onClick={() => handlePublishJob(job.id)}>
                                        Publish
                                      </DropdownMenuItem>
                                    )}
                                    {job.status === 'open' && (
                                      <DropdownMenuItem onClick={() => handleCloseJob(job.id)}>
                                        Close Position
                                      </DropdownMenuItem>
                                    )}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                    </div>
                    <TablePagination
                      currentPage={jobsPage}
                      totalItems={jobs.length}
                      pageSize={PAGE_SIZE}
                      onPageChange={setJobsPage}
                    />
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="candidates" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>All Candidates</CardTitle>
                <CardDescription>View and manage all applicants</CardDescription>
              </CardHeader>
              <CardContent>
                {candidatesLoading ? (
                  <div className="text-center py-8 text-muted-foreground">Loading...</div>
                ) : candidates.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No candidates found.</p>
                  </div>
                ) : (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Candidate</TableHead>
                          <TableHead>Position</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Applied</TableHead>
                          <TableHead className="w-[150px]"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginatedCandidates.map((candidate) => (
                          <TableRow 
                            key={candidate.id} 
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => navigate(`/app/recruitment/candidates/${candidate.id}`)}
                          >
                            <TableCell>
                              <div>
                                <p className="font-medium">{candidate.first_name} {candidate.last_name}</p>
                                <p className="text-xs text-muted-foreground">{candidate.email}</p>
                              </div>
                            </TableCell>
                            <TableCell>{(candidate.job as any)?.title || '-'}</TableCell>
                            <TableCell>
                              <CandidateStatusBadge status={candidate.status} />
                            </TableCell>
                            <TableCell>
                              {format(new Date(candidate.created_at), 'MMM d, yyyy')}
                            </TableCell>
                            <TableCell onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center gap-1">
                                <Button 
                                  variant="ghost" 
                                  size="icon"
                                  onClick={() => navigate(`/app/recruitment/candidates/${candidate.id}`)}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                                <WriteGate>
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button variant="ghost" size="sm">
                                        Actions
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                      <DropdownMenuItem onClick={() => openAssignScreening(candidate)}>
                                        <ClipboardList className="h-4 w-4 mr-2" />
                                        Assign Screening
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => openScheduleInterview(candidate)}>
                                        <Calendar className="h-4 w-4 mr-2" />
                                        Schedule Interview
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => openCreateOffer(candidate)}>
                                        <FileText className="h-4 w-4 mr-2" />
                                        Create Offer
                                      </DropdownMenuItem>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem onClick={() => updateCandidateStatus.mutate({ id: candidate.id, status: 'screening' })}>
                                        Move to Screening
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => updateCandidateStatus.mutate({ id: candidate.id, status: 'interviewing' })}>
                                        Move to Interviewing
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => updateCandidateStatus.mutate({ id: candidate.id, status: 'offered' })}>
                                        Move to Offered
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => updateCandidateStatus.mutate({ id: candidate.id, status: 'hired' })}>
                                        Mark Hired
                                      </DropdownMenuItem>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem 
                                        className="text-destructive"
                                        onClick={() => updateCandidateStatus.mutate({ id: candidate.id, status: 'rejected' })}
                                      >
                                        Reject
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </WriteGate>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="pipeline" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Hiring Pipeline</CardTitle>
                <CardDescription>Visual overview of candidates by stage</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
                  {[
                    { label: 'Applied', key: 'applied', color: 'bg-blue-500' },
                    { label: 'Screening', key: 'screening', color: 'bg-purple-500' },
                    { label: 'Interviewing', key: 'interviewing', color: 'bg-amber-500' },
                    { label: 'Offered', key: 'offered', color: 'bg-cyan-500' },
                    { label: 'Hired', key: 'hired', color: 'bg-green-500' },
                    { label: 'Rejected', key: 'rejected', color: 'bg-red-500' },
                    { label: 'Withdrawn', key: 'withdrawn', color: 'bg-gray-500' },
                  ].map((stage) => {
                    const count = pipelineStats[stage.key as keyof typeof pipelineStats] || 0;
                    const stageCandidates = candidates.filter(c => c.status === stage.key);
                    
                    return (
                      <div key={stage.key} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${stage.color}`} />
                            <span className="text-sm font-medium">{stage.label}</span>
                          </div>
                          <span className="text-sm text-muted-foreground">{count}</span>
                        </div>
                        <div className="space-y-1 max-h-[300px] overflow-auto">
                          {stageCandidates.slice(0, 10).map((candidate) => (
                            <div 
                              key={candidate.id} 
                              className="p-2 bg-muted/50 rounded text-xs cursor-pointer hover:bg-muted transition-colors"
                              onClick={() => navigate(`/app/recruitment/candidates/${candidate.id}`)}
                            >
                              <p className="font-medium truncate">{candidate.first_name} {candidate.last_name}</p>
                              <p className="text-muted-foreground truncate">{(candidate.job as any)?.title}</p>
                            </div>
                          ))}
                          {stageCandidates.length === 0 && (
                            <div className="p-2 text-xs text-muted-foreground text-center">
                              No candidates
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="tests" className="mt-4">
            <ScreeningTestsManager />
          </TabsContent>

          <TabsContent value="screenings" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Screening Tests</CardTitle>
                <CardDescription>Track assigned screening tests and their status</CardDescription>
              </CardHeader>
              <CardContent>
                {screenings.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <ClipboardList className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No screenings assigned yet.</p>
                  </div>
                ) : (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Candidate</TableHead>
                          <TableHead>Test</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Score</TableHead>
                          <TableHead>Expires</TableHead>
                          <TableHead></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {screenings.map((screening: any) => (
                          <TableRow key={screening.id}>
                            <TableCell>
                              <div>
                                <p className="font-medium">
                                  {screening.candidate?.first_name} {screening.candidate?.last_name}
                                </p>
                                <p className="text-xs text-muted-foreground">{screening.candidate?.email}</p>
                              </div>
                            </TableCell>
                            <TableCell>{screening.screening_test?.title || '-'}</TableCell>
                            <TableCell>
                              <Badge variant={
                                screening.status === 'completed' ? 'default' :
                                screening.status === 'passed' ? 'default' :
                                screening.status === 'failed' ? 'destructive' :
                                screening.status === 'expired' ? 'destructive' :
                                screening.status === 'in_progress' ? 'secondary' :
                                'outline'
                              }>
                                {screening.status}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {screening.score !== null ? `${screening.score}%` : '-'}
                            </TableCell>
                            <TableCell>
                              {screening.expires_at && (
                                <span className={new Date(screening.expires_at) < new Date() ? 'text-destructive' : ''}>
                                  {format(new Date(screening.expires_at), 'MMM d, h:mm a')}
                                </span>
                              )}
                            </TableCell>
                            <TableCell>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => navigate(`/app/recruitment/candidates/${screening.candidate_id}`)}
                              >
                                View
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="interviews" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Scheduled Interviews</CardTitle>
                <CardDescription>Upcoming and past interviews</CardDescription>
              </CardHeader>
              <CardContent>
                {interviews.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No interviews scheduled yet.</p>
                  </div>
                ) : (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Candidate</TableHead>
                          <TableHead>Interview</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Scheduled</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {interviews.map((interview: any) => (
                          <TableRow key={interview.id}>
                            <TableCell>
                              <div>
                                <p className="font-medium">
                                  {interview.candidate?.first_name} {interview.candidate?.last_name}
                                </p>
                                <p className="text-xs text-muted-foreground">{interview.candidate?.email}</p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div>
                                <p className="font-medium">{interview.title}</p>
                                <p className="text-xs text-muted-foreground">Round {interview.round_number}</p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{interview.interview_type}</Badge>
                            </TableCell>
                            <TableCell>
                              {format(new Date(interview.scheduled_at), 'MMM d, h:mm a')}
                            </TableCell>
                            <TableCell>
                              <Badge variant={
                                interview.status === 'completed' ? 'default' :
                                interview.status === 'cancelled' ? 'destructive' :
                                interview.status === 'no_show' ? 'destructive' :
                                'secondary'
                              }>
                                {interview.status}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => navigate(`/app/recruitment/candidates/${interview.candidate_id}`)}
                              >
                                View
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="offers" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Job Offers</CardTitle>
                <CardDescription>Track sent offers and responses</CardDescription>
              </CardHeader>
              <CardContent>
                {offers.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No offers created yet.</p>
                  </div>
                ) : (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Candidate</TableHead>
                          <TableHead>Position</TableHead>
                          <TableHead>Salary</TableHead>
                          <TableHead>Start Date</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {offers.map((offer: any) => (
                          <TableRow key={offer.id}>
                            <TableCell>
                              <div>
                                <p className="font-medium">
                                  {offer.candidate?.first_name} {offer.candidate?.last_name}
                                </p>
                                <p className="text-xs text-muted-foreground">{offer.candidate?.email}</p>
                              </div>
                            </TableCell>
                            <TableCell>{offer.job?.title || '-'}</TableCell>
                            <TableCell>
                              {offer.salary_currency} {offer.salary_offered?.toLocaleString()}
                            </TableCell>
                            <TableCell>
                              {format(new Date(offer.start_date), 'MMM d, yyyy')}
                            </TableCell>
                            <TableCell>
                              <Badge variant={
                                offer.status === 'accepted' ? 'default' :
                                offer.status === 'declined' ? 'destructive' :
                                offer.status === 'expired' ? 'destructive' :
                                offer.status === 'withdrawn' ? 'destructive' :
                                'secondary'
                              }>
                                {offer.status}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => navigate(`/app/recruitment/candidates/${offer.candidate_id}`)}
                              >
                                View
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Settings Tab */}
          {isHROrAbove && (
            <TabsContent value="settings" className="mt-4 space-y-6">
              <CandidateAuthSettings />
            </TabsContent>
          )}
        </Tabs>
      </div>

      <JobFormDialog 
        open={jobDialogOpen} 
        onOpenChange={setJobDialogOpen}
        job={editingJob}
      />

      {selectedCandidate && (
        <>
          <AssignScreeningDialog
            open={screeningDialogOpen}
            onOpenChange={setScreeningDialogOpen}
            candidateId={selectedCandidate.id}
            candidateName={`${selectedCandidate.first_name} ${selectedCandidate.last_name}`}
            jobId={selectedCandidate.job_id}
          />
          <ScheduleInterviewDialog
            open={interviewDialogOpen}
            onOpenChange={setInterviewDialogOpen}
            candidateId={selectedCandidate.id}
            candidateName={`${selectedCandidate.first_name} ${selectedCandidate.last_name}`}
          />
          <CreateOfferDialog
            open={offerDialogOpen}
            onOpenChange={setOfferDialogOpen}
            candidateId={selectedCandidate.id}
            candidateName={`${selectedCandidate.first_name} ${selectedCandidate.last_name}`}
            jobId={selectedCandidate.job_id}
            jobTitle={(selectedCandidate.job as any)?.title || 'Position'}
          />
        </>
      )}
    </ModuleGuard>
  );
}
