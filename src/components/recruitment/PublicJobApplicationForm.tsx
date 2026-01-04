import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useSubmitApplication } from '@/hooks/usePublicJobs';
import { toast } from 'sonner';

const applicationSchema = z.object({
  first_name: z.string().min(1, 'First name is required').max(100),
  last_name: z.string().min(1, 'Last name is required').max(100),
  email: z.string().email('Invalid email address').max(255),
  phone: z.string().max(20).optional(),
  linkedin_url: z.string().url('Invalid URL').max(500).optional().or(z.literal('')),
  portfolio_url: z.string().url('Invalid URL').max(500).optional().or(z.literal('')),
  cover_letter: z.string().max(5000).optional(),
  source: z.string().optional(),
});

type ApplicationFormData = z.infer<typeof applicationSchema>;

interface PublicJobApplicationFormProps {
  jobId: string;
  companyId: string;
  jobTitle: string;
}

const SOURCE_OPTIONS = [
  { value: 'company_website', label: 'Company Website' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'indeed', label: 'Indeed' },
  { value: 'glassdoor', label: 'Glassdoor' },
  { value: 'referral', label: 'Employee Referral' },
  { value: 'job_board', label: 'Job Board' },
  { value: 'other', label: 'Other' },
];

export function PublicJobApplicationForm({ jobId, companyId, jobTitle }: PublicJobApplicationFormProps) {
  const [submitted, setSubmitted] = useState(false);
  const submitApplication = useSubmitApplication();

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<ApplicationFormData>({
    resolver: zodResolver(applicationSchema),
    defaultValues: {
      source: 'company_website',
    },
  });

  const onSubmit = async (data: ApplicationFormData) => {
    try {
      await submitApplication.mutateAsync({
        job_id: jobId,
        company_id: companyId,
        first_name: data.first_name,
        last_name: data.last_name,
        email: data.email,
        phone: data.phone || null,
        linkedin_url: data.linkedin_url || null,
        portfolio_url: data.portfolio_url || null,
        cover_letter: data.cover_letter || null,
        source: data.source || 'company_website',
        status: 'applied',
      });
      setSubmitted(true);
    } catch (error: any) {
      toast.error(error.message || 'Failed to submit application');
    }
  };

  if (submitted) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <CheckCircle className="h-16 w-16 mx-auto text-green-500 mb-4" />
          <h3 className="text-xl font-semibold mb-2">Application Submitted!</h3>
          <p className="text-muted-foreground">
            Thank you for applying to <strong>{jobTitle}</strong>. We've received your application and will review it shortly.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Apply for this Position</CardTitle>
        <CardDescription>Fill in your details below to submit your application</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="first_name">First Name *</Label>
              <Input
                id="first_name"
                {...register('first_name')}
                placeholder="John"
              />
              {errors.first_name && (
                <p className="text-sm text-destructive">{errors.first_name.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="last_name">Last Name *</Label>
              <Input
                id="last_name"
                {...register('last_name')}
                placeholder="Doe"
              />
              {errors.last_name && (
                <p className="text-sm text-destructive">{errors.last_name.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                {...register('email')}
                placeholder="john@example.com"
              />
              {errors.email && (
                <p className="text-sm text-destructive">{errors.email.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                {...register('phone')}
                placeholder="+1 234 567 8900"
              />
              {errors.phone && (
                <p className="text-sm text-destructive">{errors.phone.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="linkedin_url">LinkedIn Profile</Label>
              <Input
                id="linkedin_url"
                {...register('linkedin_url')}
                placeholder="https://linkedin.com/in/johndoe"
              />
              {errors.linkedin_url && (
                <p className="text-sm text-destructive">{errors.linkedin_url.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="portfolio_url">Portfolio / Website</Label>
              <Input
                id="portfolio_url"
                {...register('portfolio_url')}
                placeholder="https://yourportfolio.com"
              />
              {errors.portfolio_url && (
                <p className="text-sm text-destructive">{errors.portfolio_url.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="source">How did you hear about us?</Label>
            <Select
              defaultValue="company_website"
              onValueChange={(value) => setValue('source', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select source" />
              </SelectTrigger>
              <SelectContent>
                {SOURCE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="cover_letter">Cover Letter</Label>
            <Textarea
              id="cover_letter"
              {...register('cover_letter')}
              placeholder="Tell us why you're interested in this position and what makes you a great fit..."
              rows={6}
            />
            {errors.cover_letter && (
              <p className="text-sm text-destructive">{errors.cover_letter.message}</p>
            )}
          </div>

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Submitting...
              </>
            ) : (
              'Submit Application'
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
