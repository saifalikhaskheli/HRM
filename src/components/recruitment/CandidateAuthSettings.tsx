import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Save, Loader2, Shield, Mail, Globe, Linkedin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel } from '@/components/ui/form';
import { useCandidateAuthConfig, useUpdateCandidateAuthConfig } from '@/hooks/useCandidateAuth';
import { WriteGate } from '@/components/PermissionGate';

const formSchema = z.object({
  auth_enabled: z.boolean(),
  require_login_to_apply: z.boolean(),
  magic_link_enabled: z.boolean(),
  social_login_enabled: z.boolean(),
  google_enabled: z.boolean(),
  linkedin_enabled: z.boolean(),
});

type FormValues = z.infer<typeof formSchema>;

export function CandidateAuthSettings() {
  const { data: config, isLoading } = useCandidateAuthConfig();
  const updateConfig = useUpdateCandidateAuthConfig();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    values: {
      auth_enabled: config?.auth_enabled ?? false,
      require_login_to_apply: config?.require_login_to_apply ?? false,
      magic_link_enabled: config?.magic_link_enabled ?? true,
      social_login_enabled: config?.social_login_enabled ?? false,
      google_enabled: config?.google_enabled ?? false,
      linkedin_enabled: config?.linkedin_enabled ?? false,
    },
  });

  const authEnabled = form.watch('auth_enabled');
  const socialEnabled = form.watch('social_login_enabled');

  const onSubmit = (data: FormValues) => {
    updateConfig.mutate(data);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-12 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Candidate Portal Authentication
        </CardTitle>
        <CardDescription>
          Configure how candidates authenticate when applying for jobs. 
          You can require candidates to create an account before applying, 
          enabling them to track their applications and reuse their profile.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Master Toggle */}
            <FormField
              control={form.control}
              name="auth_enabled"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Enable Candidate Portal</FormLabel>
                    <FormDescription>
                      Allow candidates to create accounts and track their applications
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            {authEnabled && (
              <>
                <Separator />

                {/* Require Login */}
                <FormField
                  control={form.control}
                  name="require_login_to_apply"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Require Login to Apply</FormLabel>
                        <FormDescription>
                          Candidates must create an account before submitting applications. 
                          If disabled, candidates can optionally login.
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <Separator />

                <div className="space-y-4">
                  <h4 className="text-sm font-medium">Authentication Methods</h4>

                  {/* Magic Link */}
                  <FormField
                    control={form.control}
                    name="magic_link_enabled"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-lg border p-3">
                        <div className="flex items-center gap-3">
                          <Mail className="h-5 w-5 text-muted-foreground" />
                          <div className="space-y-0.5">
                            <FormLabel>Magic Link</FormLabel>
                            <FormDescription className="text-xs">
                              Passwordless sign-in via email
                            </FormDescription>
                          </div>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  {/* Social Login Toggle */}
                  <FormField
                    control={form.control}
                    name="social_login_enabled"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-lg border p-3">
                        <div className="flex items-center gap-3">
                          <Globe className="h-5 w-5 text-muted-foreground" />
                          <div className="space-y-0.5">
                            <FormLabel>Social Login</FormLabel>
                            <FormDescription className="text-xs">
                              Allow sign-in with social accounts
                            </FormDescription>
                          </div>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  {socialEnabled && (
                    <div className="pl-8 space-y-3">
                      {/* Google */}
                      <FormField
                        control={form.control}
                        name="google_enabled"
                        render={({ field }) => (
                          <FormItem className="flex items-center justify-between rounded-lg border p-3 bg-muted/30">
                            <div className="flex items-center gap-3">
                              <svg className="h-5 w-5" viewBox="0 0 24 24">
                                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                                <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                                <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                                <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                              </svg>
                              <Label>Google</Label>
                            </div>
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />

                      {/* LinkedIn */}
                      <FormField
                        control={form.control}
                        name="linkedin_enabled"
                        render={({ field }) => (
                          <FormItem className="flex items-center justify-between rounded-lg border p-3 bg-muted/30">
                            <div className="flex items-center gap-3">
                              <Linkedin className="h-5 w-5 text-[#0077B5]" />
                              <Label>LinkedIn</Label>
                            </div>
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />

                      <Alert>
                        <AlertDescription className="text-xs">
                          Social login providers must be configured in your Supabase dashboard 
                          under Authentication → Providers.
                        </AlertDescription>
                      </Alert>
                    </div>
                  )}
                </div>
              </>
            )}

            <WriteGate>
              <div className="flex justify-end">
                <Button type="submit" disabled={updateConfig.isPending}>
                  {updateConfig.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Save Settings
                </Button>
              </div>
            </WriteGate>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
