import { Link } from 'react-router-dom';
import { Briefcase, MapPin, Clock, Building2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useDomainCompany } from '@/hooks/useDomainCompany';
import { usePublicJobs } from '@/hooks/usePublicJobs';

export default function CareersPage() {
  const { company, isLoading: companyLoading } = useDomainCompany();
  const { data: jobs = [], isLoading: jobsLoading } = usePublicJobs(company?.id || null);

  const isLoading = companyLoading || jobsLoading;

  const formatEmploymentType = (type: string) => {
    return type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  if (companyLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container max-w-4xl mx-auto py-12 px-4">
          <Skeleton className="h-12 w-64 mb-2" />
          <Skeleton className="h-6 w-48" />
        </div>
      </div>
    );
  }

  if (!company) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="py-12 text-center">
            <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">Company Not Found</h2>
            <p className="text-muted-foreground">
              We couldn't find the company you're looking for.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container max-w-4xl mx-auto py-8 px-4">
          <div className="flex items-center gap-4">
            {company.logo_url && (
              <img
                src={company.logo_url}
                alt={company.name}
                className="h-16 w-16 object-contain rounded-lg"
              />
            )}
            <div>
              <h1 className="text-3xl font-bold">{company.name}</h1>
              <p className="text-muted-foreground">Career Opportunities</p>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="container max-w-4xl mx-auto py-8 px-4">
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-6 w-48" />
                  <Skeleton className="h-4 w-32" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-4 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : jobs.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <Briefcase className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <h2 className="text-xl font-semibold mb-2">No Open Positions</h2>
              <p className="text-muted-foreground max-w-md mx-auto">
                We don't have any open positions at the moment. Please check back later for new opportunities.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            <p className="text-muted-foreground">
              {jobs.length} open position{jobs.length !== 1 ? 's' : ''}
            </p>
            
            {jobs.map((job) => (
              <Card key={job.id} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-xl">{job.title}</CardTitle>
                      <CardDescription className="flex flex-wrap items-center gap-3 mt-2">
                        {job.department && (
                          <span className="flex items-center gap-1">
                            <Building2 className="h-3.5 w-3.5" />
                            {job.department.name}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5" />
                          {job.is_remote ? 'Remote' : job.location || 'On-site'}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          {formatEmploymentType(job.employment_type)}
                        </span>
                      </CardDescription>
                    </div>
                    <Link to={`/careers/${job.slug}`}>
                      <Button>View Details</Button>
                    </Link>
                  </div>
                </CardHeader>
                {(job.show_salary && (job.salary_min || job.salary_max)) && (
                  <CardContent className="pt-0">
                    <Badge variant="secondary">
                      {job.salary_currency || 'USD'}{' '}
                      {job.salary_min?.toLocaleString()}
                      {job.salary_max && ` - ${job.salary_max.toLocaleString()}`}
                    </Badge>
                  </CardContent>
                )}
              </Card>
            ))}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t mt-auto">
        <div className="container max-w-4xl mx-auto py-6 px-4 text-center text-sm text-muted-foreground">
          &copy; {new Date().getFullYear()} {company.name}. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
