import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AuthProvider } from "@/contexts/AuthContext";
import { TenantProvider } from "@/contexts/TenantContext";
import { ImpersonationProvider } from "@/contexts/ImpersonationContext";
import { LocalizationProvider } from "@/contexts/LocalizationContext";
import { SessionTimeoutWarning } from "@/components/SessionTimeoutWarning";
import { lazy, Suspense } from "react";

// Public pages (lazy loaded)
const CareersPage = lazy(() => import("./pages/CareersPage"));
const JobDetailPage = lazy(() => import("./pages/JobDetailPage"));
const CandidateAuthPage = lazy(() => import("./pages/CandidateAuthPage"));
const CandidateScreeningPage = lazy(() => import("./pages/CandidateScreeningPage"));

// Core pages (not lazy - needed immediately)
import Auth from "./pages/Auth";
import Onboarding from "./pages/Onboarding";
import NotFound from "./pages/NotFound";
import Unauthorized from "./pages/Unauthorized";
import Setup from "./pages/Setup";
import { RootRedirect } from "@/components/RootRedirect";

// App layout
import { AppLayout, AuthLayout } from "@/components/layout";
import { PlatformLayout } from "@/components/platform/PlatformLayout";

// Lazy load app pages
const DashboardPage = lazy(() => import("./pages/app/DashboardPage"));
const EmployeesPage = lazy(() => import("./pages/app/EmployeesPage"));
const DepartmentsPage = lazy(() => import("./pages/app/DepartmentsPage"));
const LeavePage = lazy(() => import("./pages/app/LeavePage"));
const TimePage = lazy(() => import("./pages/app/TimePage"));
const PayrollPage = lazy(() => import("./pages/app/PayrollPage"));
const ExpensesPage = lazy(() => import("./pages/app/ExpensesPage"));
const RecruitmentPage = lazy(() => import("./pages/app/RecruitmentPage"));
const CandidateDetailPage = lazy(() => import("./pages/app/CandidateDetailPage"));
const PerformancePage = lazy(() => import("./pages/app/PerformancePage"));
const DocumentsPage = lazy(() => import("./pages/app/DocumentsPage"));
const SettingsPage = lazy(() => import("./pages/app/SettingsPage"));
const LogsPage = lazy(() => import("./pages/app/LogsPage"));
const CompliancePage = lazy(() => import("./pages/app/CompliancePage"));
const IntegrationsPage = lazy(() => import("./pages/app/IntegrationsPage"));
const ProfilePage = lazy(() => import("./pages/app/ProfilePage"));
const MyPayslipsPage = lazy(() => import("./pages/app/MyPayslipsPage"));
const MyInfoPage = lazy(() => import("./pages/app/MyInfoPage"));
const MyTeamPage = lazy(() => import("./pages/app/MyTeamPage"));
const MySecurityPage = lazy(() => import("./pages/app/MySecurityPage"));
const ShiftManagementPage = lazy(() => import("./pages/app/ShiftManagementPage"));

// Settings sub-pages
const CompanySettingsPage = lazy(() => import("./pages/app/settings/CompanySettingsPage"));
const BillingSettingsPage = lazy(() => import("./pages/app/settings/BillingSettingsPage"));
const UsersSettingsPage = lazy(() => import("./pages/app/settings/UsersSettingsPage"));
const InviteUsersPage = lazy(() => import("./pages/app/settings/InviteUsersPage"));
const SecuritySettingsPage = lazy(() => import("./pages/app/settings/SecuritySettingsPage"));
const EmailSettingsPage = lazy(() => import("./pages/app/settings/EmailSettingsPage"));
const PermissionsSettingsPage = lazy(() => import("./pages/app/settings/PermissionsSettingsPage"));
const NotificationSettingsPage = lazy(() => import("./pages/app/settings/NotificationSettingsPage"));
const AppearanceSettingsPage = lazy(() => import("./pages/app/settings/AppearanceSettingsPage"));
const LocalizationSettingsPage = lazy(() => import("./pages/app/settings/LocalizationSettingsPage"));
const DomainSettingsPage = lazy(() => import("./pages/app/settings/DomainSettingsPage"));
const EmployeeIdSettingsPage = lazy(() => import("./pages/app/settings/EmployeeIdSettingsPage"));
// Utility pages
const HelpPage = lazy(() => import("./pages/app/HelpPage"));

// Platform admin pages
const PlatformDashboardPage = lazy(() => import("./pages/platform/PlatformDashboardPage"));
const PlatformAdminsPage = lazy(() => import("./pages/platform/PlatformAdminsPage"));
const PlatformCompaniesPage = lazy(() => import("./pages/platform/PlatformCompaniesPage"));
const PlatformCompanyDetailPage = lazy(() => import("./pages/platform/PlatformCompanyDetailPage"));
const PlatformPlansPage = lazy(() => import("./pages/platform/PlatformPlansPage"));
const PlatformAnalyticsPage = lazy(() => import("./pages/platform/PlatformAnalyticsPage"));
const PlatformSettingsPage = lazy(() => import("./pages/platform/PlatformSettingsPage"));
const PlatformLogsPage = lazy(() => import("./pages/platform/PlatformLogsPage"));
const PlatformWebhooksPage = lazy(() => import("./pages/platform/PlatformWebhooksPage"));
const PlatformUsersPage = lazy(() => import("./pages/platform/PlatformUsersPage"));
const PlatformCompanyPermissionsPage = lazy(() => import("./pages/platform/PlatformCompanyPermissionsPage"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: (failureCount, error) => {
        if (error instanceof Error && error.message.includes('permission')) {
          return false;
        }
        return failureCount < 3;
      },
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: false,
    },
  },
});

const PageLoader = () => (
  <div className="flex items-center justify-center h-screen">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
  </div>
);

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <ImpersonationProvider>
              <TenantProvider>
                <LocalizationProvider>
                <SessionTimeoutWarning />
              <Suspense fallback={<PageLoader />}>
                <Routes>
                  {/* Public routes */}
                  <Route path="/" element={<RootRedirect />} />
                  <Route path="/auth" element={<AuthLayout><Auth /></AuthLayout>} />
                  <Route path="/setup" element={<AuthLayout><Setup /></AuthLayout>} />
                  <Route path="/careers" element={<CareersPage />} />
                  <Route path="/careers/auth" element={<CandidateAuthPage />} />
                  <Route path="/careers/:slug" element={<JobDetailPage />} />
                  <Route path="/screening/:token" element={<CandidateScreeningPage />} />
                  <Route path="/onboarding" element={<AuthLayout><Onboarding /></AuthLayout>} />
                  <Route path="/unauthorized" element={<Unauthorized />} />

                  {/* Platform admin routes */}
                  <Route path="/platform" element={<PlatformLayout />}>
                    <Route index element={<Navigate to="/platform/dashboard" replace />} />
                    <Route path="dashboard" element={<PlatformDashboardPage />} />
                    <Route path="admins" element={<PlatformAdminsPage />} />
                    <Route path="companies" element={<PlatformCompaniesPage />} />
                    <Route path="companies/:companyId" element={<PlatformCompanyDetailPage />} />
                    <Route path="companies/:companyId/permissions" element={<PlatformCompanyPermissionsPage />} />
                    <Route path="users" element={<PlatformUsersPage />} />
                    <Route path="plans" element={<PlatformPlansPage />} />
                    <Route path="analytics" element={<PlatformAnalyticsPage />} />
                    <Route path="logs" element={<PlatformLogsPage />} />
                    <Route path="webhooks" element={<PlatformWebhooksPage />} />
                    <Route path="settings" element={<PlatformSettingsPage />} />
                    {/* Redirects for old log routes */}
                    <Route path="audit-logs" element={<Navigate to="/platform/logs" replace />} />
                    <Route path="impersonation-logs" element={<Navigate to="/platform/logs" replace />} />
                    <Route path="email-logs" element={<Navigate to="/platform/logs" replace />} />
                    <Route path="billing-logs" element={<Navigate to="/platform/logs" replace />} />
                    <Route path="application-logs" element={<Navigate to="/platform/logs" replace />} />
                  </Route>

                  {/* Protected app routes */}
                  <Route path="/app" element={<AppLayout />}>
                    <Route index element={<Navigate to="/app/dashboard" replace />} />
                    <Route path="dashboard" element={<DashboardPage />} />
                    <Route path="employees" element={<EmployeesPage />} />
                    <Route path="departments" element={<DepartmentsPage />} />
                    <Route path="leave" element={<LeavePage />} />
                    <Route path="time" element={<TimePage />} />
                    <Route path="payroll" element={<PayrollPage />} />
                    <Route path="expenses" element={<ExpensesPage />} />
                    <Route path="recruitment" element={<RecruitmentPage />} />
                    <Route path="recruitment/candidates/:candidateId" element={<CandidateDetailPage />} />
                    <Route path="performance" element={<PerformancePage />} />
                    <Route path="documents" element={<DocumentsPage />} />
                    <Route path="logs" element={<LogsPage />} />
                    <Route path="compliance" element={<CompliancePage />} />
                    {/* Redirects for old log routes */}
                    <Route path="audit" element={<Navigate to="/app/logs" replace />} />
                    <Route path="security-events" element={<Navigate to="/app/logs" replace />} />
                    <Route path="integrations" element={<IntegrationsPage />} />
                    <Route path="shifts" element={<ShiftManagementPage />} />
                    <Route path="settings" element={<SettingsPage />}>
                      <Route index element={<Navigate to="/app/settings/company" replace />} />
                      <Route path="company" element={<CompanySettingsPage />} />
                      <Route path="billing" element={<BillingSettingsPage />} />
                      <Route path="users" element={<UsersSettingsPage />} />
                      <Route path="users/invite" element={<InviteUsersPage />} />
                      <Route path="security" element={<SecuritySettingsPage />} />
                      <Route path="email" element={<EmailSettingsPage />} />
                      <Route path="permissions" element={<PermissionsSettingsPage />} />
                      <Route path="notifications" element={<NotificationSettingsPage />} />
                      <Route path="appearance" element={<AppearanceSettingsPage />} />
                      <Route path="localization" element={<LocalizationSettingsPage />} />
                      <Route path="domain" element={<DomainSettingsPage />} />
                      <Route path="employee-id" element={<EmployeeIdSettingsPage />} />
                      <Route path="integrations" element={<IntegrationsPage />} />
                      <Route path="compliance" element={<CompliancePage />} />
                    </Route>
                    <Route path="email-logs" element={<Navigate to="/app/logs" replace />} />
                    <Route path="help" element={<HelpPage />} />
                    <Route path="profile" element={<ProfilePage />} />
                    <Route path="payslips" element={<MyPayslipsPage />} />
                    <Route path="my-info" element={<MyInfoPage />} />
                    <Route path="my-team" element={<MyTeamPage />} />
                    <Route path="my-security" element={<MySecurityPage />} />
                  </Route>

                  {/* Catch-all */}
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
            </LocalizationProvider>
            </TenantProvider>
          </ImpersonationProvider>
        </AuthProvider>
      </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;