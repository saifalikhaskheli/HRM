import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, MapPin, Clock, Building2, DollarSign, Users, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { useDomainCompany } from '@/hooks/useDomainCompany';
import { usePublicJob } from '@/hooks/usePublicJobs';
import { PublicJobApplicationForm } from '@/components/recruitment/PublicJobApplicationForm';

export default function JobDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const { company, isLoading: companyLoading } = useDomainCompany();
  const { data: job, isLoading: jobLoading } = usePublicJob(company?.id || null, slug || null);

  const isLoading = companyLoading || jobLoading;

  const formatEmploymentType = (type: string) => {
    return type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container max-w-4xl mx-auto py-12 px-4">
          <Skeleton className="h-8 w-32 mb-8" />
          <Skeleton className="h-10 w-96 mb-4" />
          <Skeleton className="h-6 w-64 mb-8" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (!company || !job) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="py-12 text-center">
            <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">Job Not Found</h2>
            <p className="text-muted-foreground mb-4">
              This position may no longer be available.
            </p>
            <Link to="/careers">
              <Button variant="outline">View All Positions</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container max-w-4xl mx-auto py-6 px-4">
          <Link 
            to="/careers" 
            className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to all positions
          </Link>
          
          <div className="flex items-start gap-4">
            {company.logo_url && (
              <img
                src={company.logo_url}
                alt={company.name}
                className="h-12 w-12 object-contain rounded-lg hidden sm:block"
              />
            )}
            <div className="flex-1">
              <h1 className="text-2xl sm:text-3xl font-bold">{job.title}</h1>
              <p className="text-muted-foreground">{company.name}</p>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="container max-w-4xl mx-auto py-8 px-4">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Job Details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Quick Info */}
            <Card>
              <CardContent className="py-4">
                <div className="flex flex-wrap gap-4 text-sm">
                  {job.department && (
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Building2 className="h-4 w-4" />
                      <span>{job.department.name}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <MapPin className="h-4 w-4" />
                    <span>{job.is_remote ? 'Remote' : job.location || 'On-site'}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    <span>{formatEmploymentType(job.employment_type)}</span>
                  </div>
                  {job.openings && job.openings > 1 && (
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Users className="h-4 w-4" />
                      <span>{job.openings} openings</span>
                    </div>
                  )}
                  {job.published_at && (
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      <span>Posted {format(new Date(job.published_at), 'MMM d, yyyy')}</span>
                    </div>
                  )}
                </div>
                
                {job.show_salary && (job.salary_min || job.salary_max) && (
                  <div className="flex items-center gap-1.5 mt-4">
                    <DollarSign className="h-4 w-4 text-green-600" />
                    <Badge variant="secondary" className="text-sm">
                      {job.salary_currency || 'USD'}{' '}
                      {job.salary_min?.toLocaleString()}
                      {job.salary_max && ` - ${job.salary_max.toLocaleString()}`}
                    </Badge>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Description */}
            {job.description && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">About this role</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="prose prose-sm max-w-none dark:prose-invert">
                    <p className="whitespace-pre-wrap">{job.description}</p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Requirements */}
            {job.requirements && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Requirements</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="prose prose-sm max-w-none dark:prose-invert">
                    <p className="whitespace-pre-wrap">{job.requirements}</p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Responsibilities */}
            {job.responsibilities && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Responsibilities</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="prose prose-sm max-w-none dark:prose-invert">
                    <p className="whitespace-pre-wrap">{job.responsibilities}</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Application Form */}
          <div className="lg:col-span-1">
            <div className="sticky top-6">
              <PublicJobApplicationForm
                jobId={job.id}
                companyId={job.company_id}
                jobTitle={job.title}
              />
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t mt-12">
        <div className="container max-w-4xl mx-auto py-6 px-4 text-center text-sm text-muted-foreground">
          &copy; {new Date().getFullYear()} {company.name}. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
