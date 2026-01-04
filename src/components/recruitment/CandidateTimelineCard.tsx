import { format } from 'date-fns';
import { 
  FileText, 
  Calendar, 
  Send, 
  CheckCircle, 
  XCircle, 
  MessageSquare,
  ClipboardCheck,
  UserCheck,
  FileSignature
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useCandidateTimeline, CandidateTimelineEvent } from '@/hooks/useRecruitmentWorkflow';

interface CandidateTimelineCardProps {
  candidateId: string;
}

const getEventIcon = (eventType: string) => {
  switch (eventType) {
    case 'application_received':
      return <FileText className="h-4 w-4" />;
    case 'screening_assigned':
      return <ClipboardCheck className="h-4 w-4" />;
    case 'screening_completed':
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    case 'screening_expired':
      return <XCircle className="h-4 w-4 text-destructive" />;
    case 'interview_scheduled':
      return <Calendar className="h-4 w-4" />;
    case 'interview_completed':
      return <UserCheck className="h-4 w-4 text-green-500" />;
    case 'offer_created':
      return <FileSignature className="h-4 w-4" />;
    case 'offer_sent':
      return <Send className="h-4 w-4 text-blue-500" />;
    case 'offer_accepted':
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    case 'offer_declined':
      return <XCircle className="h-4 w-4 text-destructive" />;
    case 'status_change':
      return <FileText className="h-4 w-4" />;
    case 'note_added':
      return <MessageSquare className="h-4 w-4" />;
    default:
      return <FileText className="h-4 w-4" />;
  }
};

const getEventColor = (eventType: string) => {
  if (eventType.includes('completed') || eventType.includes('accepted')) {
    return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
  }
  if (eventType.includes('expired') || eventType.includes('declined') || eventType.includes('rejected')) {
    return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
  }
  if (eventType.includes('scheduled') || eventType.includes('sent')) {
    return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
  }
  return 'bg-muted text-muted-foreground';
};

export function CandidateTimelineCard({ candidateId }: CandidateTimelineCardProps) {
  const { data: timeline, isLoading } = useCandidateTimeline(candidateId);
  
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Activity Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">Loading...</div>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Activity Timeline</CardTitle>
      </CardHeader>
      <CardContent>
        {!timeline || timeline.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-4">
            No activity recorded yet
          </div>
        ) : (
          <ScrollArea className="h-[400px] pr-4">
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />
              
              <div className="space-y-6">
                {timeline.map((event, index) => (
                  <div key={event.id} className="relative pl-10">
                    {/* Timeline dot */}
                    <div className={`absolute left-0 w-8 h-8 rounded-full flex items-center justify-center ${getEventColor(event.event_type)}`}>
                      {getEventIcon(event.event_type)}
                    </div>
                    
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <p className="font-medium text-sm">{event.title}</p>
                        <time className="text-xs text-muted-foreground">
                          {format(new Date(event.created_at), 'MMM d, h:mm a')}
                        </time>
                      </div>
                      
                      {event.description && (
                        <p className="text-sm text-muted-foreground">{event.description}</p>
                      )}
                      
                      {event.created_by_employee && (
                        <p className="text-xs text-muted-foreground">
                          by {event.created_by_employee.first_name} {event.created_by_employee.last_name}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
