# Development Tasks & Sequence

## Overview

This document breaks down all development tasks in the order they should be completed, with dependencies, estimated effort, and parallel work opportunities.

## Task Estimation Legend
- **XS**: 1-2 hours
- **S**: 2-4 hours (half day)
- **M**: 1 day
- **L**: 2-3 days
- **XL**: 4-5 days (week)
- **XXL**: 2+ weeks

---

## Phase 0: Foundation & Setup (2 weeks)

### Week 1: Repository & Infrastructure

| ID | Task | Size | Dependencies | Assignee |
|----|------|------|--------------|----------|
| 0.1 | Initialize repository with branching strategy | S | None | Tech Lead |
| 0.2 | Setup CI/CD pipeline (GitHub Actions) | M | 0.1 | DevOps |
| 0.3 | Configure Docker Compose for local dev | M | 0.1 | DevOps |
| 0.4 | Setup PostgreSQL + Supabase | M | 0.3 | Backend Dev |
| 0.5 | Configure Redis for caching | S | 0.3 | Backend Dev |
| 0.6 | Setup object storage (S3/Supabase Storage) | S | 0.4 | Backend Dev |
| 0.7 | Configure email service (SendGrid/Resend) | S | None | Backend Dev |
| 0.8 | Setup error tracking (Sentry) | S | 0.2 | DevOps |
| 0.9 | Setup monitoring (DataDog/CloudWatch) | M | 0.2 | DevOps |
| 0.10 | Create project board & ticket templates | S | None | PM |

**Parallel Work**: 0.2-0.3-0.4 can be done in parallel, 0.5-0.6-0.7 in parallel

### Week 2: Tech Stack & Boilerplate

| ID | Task | Size | Dependencies | Assignee |
|----|------|------|--------------|----------|
| 0.11 | Setup Vite + React + TypeScript | M | 0.1 | Frontend Dev |
| 0.12 | Configure TanStack Query | S | 0.11 | Frontend Dev |
| 0.13 | Setup React Hook Form + Zod | S | 0.11 | Frontend Dev |
| 0.14 | Configure Tailwind + shadcn/ui | M | 0.11 | Frontend Dev |
| 0.15 | Setup React Router | S | 0.11 | Frontend Dev |
| 0.16 | Configure ESLint + Prettier | S | 0.11 | Frontend Dev |
| 0.17 | Setup testing (Jest + Testing Library) | M | 0.11 | QA Engineer |
| 0.18 | Setup E2E testing (Playwright) | M | 0.11 | QA Engineer |
| 0.19 | Create README with setup instructions | S | All above | Tech Lead |
| 0.20 | First deployment to staging | M | All above | DevOps |

**Parallel Work**: 0.12-0.16 can be done in parallel, 0.17-0.18 in parallel

---

## Phase 1: Platform & Company Management (4 weeks)

### Week 3: Authentication Foundation

| ID | Task | Size | Dependencies | Assignee |
|----|------|------|--------------|----------|
| 1.1 | Design database schema (users, auth tables) | M | 0.4 | Backend Dev |
| 1.2 | Create database migrations | M | 1.1 | Backend Dev |
| 1.3 | Implement JWT token generation/validation | M | 1.2 | Backend Dev |
| 1.4 | Build registration endpoint + email verification | L | 1.3 | Backend Dev |
| 1.5 | Build login endpoint | M | 1.3 | Backend Dev |
| 1.6 | Build password reset flow | M | 1.3 | Backend Dev |
| 1.7 | Implement refresh token rotation | M | 1.5 | Backend Dev |
| 1.8 | Build 2FA setup & verification | L | 1.5 | Backend Dev |
| 1.9 | Create login page (UI) | M | 1.5 | Frontend Dev |
| 1.10 | Create registration page (UI) | M | 1.4 | Frontend Dev |
| 1.11 | Create forgot password page (UI) | M | 1.6 | Frontend Dev |
| 1.12 | Implement AuthContext & hooks | M | 1.9 | Frontend Dev |
| 1.13 | Create protected route wrapper | S | 1.12 | Frontend Dev |
| 1.14 | Write auth E2E tests | L | 1.9-1.11 | QA Engineer |

**Critical Path**: 1.1 → 1.2 → 1.3 → 1.5 → 1.9  
**Parallel Work**: After 1.3, tasks 1.4-1.8 can be done in parallel by different devs

### Week 4: Multi-Tenant Company Management

| ID | Task | Size | Dependencies | Assignee |
|----|------|------|--------------|----------|
| 1.15 | Design company tables schema | M | 1.2 | Backend Dev |
| 1.16 | Create company migrations | M | 1.15 | Backend Dev |
| 1.17 | Implement RLS policies | L | 1.16 | Backend Dev |
| 1.18 | Build company CRUD API | L | 1.17 | Backend Dev |
| 1.19 | Build platform admin dashboard API | M | 1.18 | Backend Dev |
| 1.20 | Create platform admin UI | L | 1.19 | Frontend Dev |
| 1.21 | Create company list page | M | 1.18 | Frontend Dev |
| 1.22 | Create company detail page | M | 1.18 | Frontend Dev |
| 1.23 | Implement tenant context switching | M | 1.18 | Backend Dev |
| 1.24 | Create TenantContext (frontend) | M | 1.23 | Frontend Dev |
| 1.25 | Write RLS isolation tests | L | 1.17 | QA Engineer |

**Critical Path**: 1.15 → 1.16 → 1.17 → 1.18 → 1.21  
**Parallel Work**: 1.19-1.20, 1.21-1.22 in parallel

### Week 5: Company Onboarding

| ID | Task | Size | Dependencies | Assignee |
|----|------|------|--------------|----------|
| 1.26 | Design onboarding flow (5 steps) | M | 1.18 | Backend Dev |
| 1.27 | Build onboarding API endpoints | L | 1.26 | Backend Dev |
| 1.28 | Create onboarding wizard UI | XL | 1.27 | Frontend Dev |
| 1.29 | Build company settings API | M | 1.18 | Backend Dev |
| 1.30 | Create company settings page | L | 1.29 | Frontend Dev |
| 1.31 | Build location management API | M | 1.18 | Backend Dev |
| 1.32 | Create location management UI | M | 1.31 | Frontend Dev |
| 1.33 | Implement localization settings | M | 1.30 | Frontend Dev |
| 1.34 | Write onboarding E2E test | L | 1.28 | QA Engineer |

**Critical Path**: 1.26 → 1.27 → 1.28  
**Parallel Work**: 1.29-1.30, 1.31-1.32 in parallel

### Week 6: Subscription & Billing

| ID | Task | Size | Dependencies | Assignee |
|----|------|------|--------------|----------|
| 1.35 | Design subscription tables schema | M | 1.16 | Backend Dev |
| 1.36 | Create subscription migrations | M | 1.35 | Backend Dev |
| 1.37 | Define subscription plans & features | M | 1.36 | PM + Backend Dev |
| 1.38 | Integrate Stripe (checkout, webhooks) | XL | 1.37 | Backend Dev |
| 1.39 | Build subscription management API | L | 1.38 | Backend Dev |
| 1.40 | Create pricing page | L | 1.37 | Frontend Dev |
| 1.41 | Create checkout flow | L | 1.38 | Frontend Dev |
| 1.42 | Build billing history page | M | 1.39 | Frontend Dev |
| 1.43 | Implement trial logic & warnings | M | 1.39 | Backend Dev |
| 1.44 | Create feature gate utility | M | 1.37 | Backend Dev |
| 1.45 | Implement feature gates in UI | M | 1.44 | Frontend Dev |
| 1.46 | Write subscription tests | L | 1.38-1.39 | QA Engineer |

**Critical Path**: 1.35 → 1.36 → 1.37 → 1.38 → 1.39  
**Parallel Work**: 1.40-1.41-1.42 in parallel after 1.38

---

## Phase 2: Core HR Layout & Navigation (3 weeks)

### Week 7: Layout & Dashboard

| ID | Task | Size | Dependencies | Assignee |
|----|------|------|--------------|----------|
| 2.1 | Design app layout (sidebar, header) | M | 1.28 | Frontend Dev |
| 2.2 | Build responsive sidebar navigation | L | 2.1 | Frontend Dev |
| 2.3 | Build header with user menu | M | 2.1 | Frontend Dev |
| 2.4 | Implement breadcrumb navigation | S | 2.1 | Frontend Dev |
| 2.5 | Build dashboard API (metrics) | M | 1.39 | Backend Dev |
| 2.6 | Create dashboard page | L | 2.5 | Frontend Dev |
| 2.7 | Build activity feed component | M | 2.6 | Frontend Dev |
| 2.8 | Build upcoming events widget | M | 2.6 | Frontend Dev |
| 2.9 | Build quick actions widget | M | 2.6 | Frontend Dev |
| 2.10 | Write layout tests | M | 2.1-2.6 | QA Engineer |

**Critical Path**: 2.1 → 2.2 → 2.6  
**Parallel Work**: 2.3-2.4, 2.7-2.8-2.9 in parallel

### Week 8: User & Role Management

| ID | Task | Size | Dependencies | Assignee |
|----|------|------|--------------|----------|
| 2.11 | Design roles & permissions schema | L | 1.36 | Backend Dev |
| 2.12 | Create roles/permissions migrations | M | 2.11 | Backend Dev |
| 2.13 | Seed system roles & permissions | M | 2.12 | Backend Dev |
| 2.14 | Build user management API | L | 2.13 | Backend Dev |
| 2.15 | Build role assignment API | M | 2.13 | Backend Dev |
| 2.16 | Create user list page | L | 2.14 | Frontend Dev |
| 2.17 | Create user invite flow | M | 2.14 | Frontend Dev |
| 2.18 | Create role management page | L | 2.15 | Frontend Dev |
| 2.19 | Build user CSV upload | M | 2.14 | Backend + Frontend |
| 2.20 | Write RBAC tests | L | 2.14-2.15 | QA Engineer |

**Critical Path**: 2.11 → 2.12 → 2.13 → 2.14 → 2.16  
**Parallel Work**: 2.16-2.17-2.18 in parallel after 2.14

### Week 9: Permission System Implementation

| ID | Task | Size | Dependencies | Assignee |
|----|------|------|--------------|----------|
| 2.21 | Build permission checking middleware | M | 2.13 | Backend Dev |
| 2.22 | Create permission utilities (frontend) | M | 2.21 | Frontend Dev |
| 2.23 | Create PermissionGuard component | M | 2.22 | Frontend Dev |
| 2.24 | Implement usePermissions hook | M | 2.22 | Frontend Dev |
| 2.25 | Add permission checks to navigation | M | 2.23 | Frontend Dev |
| 2.26 | Implement feature gate checks | M | 1.45, 2.21 | Backend Dev |
| 2.27 | Add feature gates to UI | M | 2.26 | Frontend Dev |
| 2.28 | Build department management | L | 1.31 | Backend + Frontend |
| 2.29 | Write permission E2E tests | XL | 2.21-2.27 | QA Engineer |

**Critical Path**: 2.21 → 2.22 → 2.23 → 2.25  
**Parallel Work**: 2.28 can be done in parallel

---

## Phase 3: Core Modules (7 weeks)

### Weeks 10-12: Employee Management Module

| ID | Task | Size | Dependencies | Assignee |
|----|------|------|--------------|----------|
| 3.1 | Design employee tables schema | L | 2.28 | Backend Dev |
| 3.2 | Create employee migrations | M | 3.1 | Backend Dev |
| 3.3 | Build employee CRUD API | XL | 3.2 | Backend Dev |
| 3.4 | Build employee document vault API | L | 3.3 | Backend Dev |
| 3.5 | Build emergency contact API | M | 3.3 | Backend Dev |
| 3.6 | Create employee list page | L | 3.3 | Frontend Dev |
| 3.7 | Create employee detail page | L | 3.3 | Frontend Dev |
| 3.8 | Create employee form (create/edit) | L | 3.3 | Frontend Dev |
| 3.9 | Build employee search & filters | M | 3.6 | Frontend Dev |
| 3.10 | Build document upload UI | M | 3.4 | Frontend Dev |
| 3.11 | Build onboarding workflow API | L | 3.3 | Backend Dev |
| 3.12 | Create onboarding checklist UI | L | 3.11 | Frontend Dev |
| 3.13 | Build lifecycle events API | M | 3.3 | Backend Dev |
| 3.14 | Create transfer/promotion flow | M | 3.13 | Frontend Dev |
| 3.15 | Build offboarding workflow | M | 3.13 | Backend + Frontend |
| 3.16 | Write employee module tests | XL | 3.3-3.15 | QA Engineer |

**Critical Path**: 3.1 → 3.2 → 3.3 → 3.6  
**Parallel Work**: After 3.3, split into 3 tracks: (3.4-3.10), (3.11-3.12), (3.13-3.14-3.15)

### Weeks 13-14: Leave Management Module

| ID | Task | Size | Dependencies | Assignee |
|----|------|------|--------------|----------|
| 3.17 | Design leave tables schema | L | 3.3 | Backend Dev |
| 3.18 | Create leave migrations | M | 3.17 | Backend Dev |
| 3.19 | Build leave policy configuration API | L | 3.18 | Backend Dev |
| 3.20 | Build leave balance calculation logic | L | 3.19 | Backend Dev |
| 3.21 | Build leave request API | L | 3.20 | Backend Dev |
| 3.22 | Build leave approval workflow API | M | 3.21 | Backend Dev |
| 3.23 | Create leave policy management UI | L | 3.19 | Frontend Dev |
| 3.24 | Create leave request form | L | 3.21 | Frontend Dev |
| 3.25 | Create leave approval queue | M | 3.22 | Frontend Dev |
| 3.26 | Build leave calendar view | L | 3.21 | Frontend Dev |
| 3.27 | Build leave balance display | M | 3.20 | Frontend Dev |
| 3.28 | Implement leave notifications | M | 3.22 | Backend Dev |
| 3.29 | Write leave module tests | L | 3.19-3.28 | QA Engineer |

**Critical Path**: 3.17 → 3.18 → 3.19 → 3.20 → 3.21 → 3.24  
**Parallel Work**: After 3.21, (3.22-3.25), (3.26-3.27) in parallel

### Week 15: Attendance & Time Tracking Module

| ID | Task | Size | Dependencies | Assignee |
|----|------|------|--------------|----------|
| 3.30 | Design attendance tables schema | M | 3.3 | Backend Dev |
| 3.31 | Create attendance migrations | M | 3.30 | Backend Dev |
| 3.32 | Build clock in/out API | L | 3.31 | Backend Dev |
| 3.33 | Build attendance correction API | M | 3.32 | Backend Dev |
| 3.34 | Build time tracking API | M | 3.31 | Backend Dev |
| 3.35 | Create clock in/out UI | M | 3.32 | Frontend Dev |
| 3.36 | Create attendance records page | L | 3.32 | Frontend Dev |
| 3.37 | Create timesheet view | M | 3.34 | Frontend Dev |
| 3.38 | Build attendance reports | M | 3.32 | Backend + Frontend |
| 3.39 | Write attendance module tests | M | 3.32-3.38 | QA Engineer |

**Critical Path**: 3.30 → 3.31 → 3.32 → 3.35  
**Parallel Work**: After 3.31, (3.32-3.35-3.36), (3.34-3.37) in parallel

### Week 16: Payroll Module

| ID | Task | Size | Dependencies | Assignee |
|----|------|------|--------------|----------|
| 3.40 | Design payroll tables schema | L | 3.3, 3.21, 3.32 | Backend Dev |
| 3.41 | Create payroll migrations | M | 3.40 | Backend Dev |
| 3.42 | Build salary component configuration API | L | 3.41 | Backend Dev |
| 3.43 | Build employee compensation API | M | 3.42 | Backend Dev |
| 3.44 | Build pay run creation logic | L | 3.43 | Backend Dev |
| 3.45 | Integrate leave/attendance deductions | M | 3.44, 3.21, 3.32 | Backend Dev |
| 3.46 | Build payslip generation (PDF) | L | 3.44 | Backend Dev |
| 3.47 | Create salary component management UI | M | 3.42 | Frontend Dev |
| 3.48 | Create pay run management UI | L | 3.44 | Frontend Dev |
| 3.49 | Create payslip viewer (employee) | M | 3.46 | Frontend Dev |
| 3.50 | Build payroll reports | M | 3.44 | Backend + Frontend |
| 3.51 | Write payroll module tests | L | 3.42-3.50 | QA Engineer |

**Critical Path**: 3.40 → 3.41 → 3.42 → 3.43 → 3.44 → 3.48  
**Parallel Work**: After 3.44, (3.45-3.46-3.49), (3.47-3.48-3.50) in parallel

---

## Phase 4: Advanced Modules (6 weeks)

### Weeks 17-18: Performance Management Module

| ID | Task | Size | Dependencies | Assignee |
|----|------|------|--------------|----------|
| 4.1 | Design performance tables schema | L | 3.3 | Backend Dev |
| 4.2 | Create performance migrations | M | 4.1 | Backend Dev |
| 4.3 | Build review cycle management API | L | 4.2 | Backend Dev |
| 4.4 | Build review form submission API | L | 4.3 | Backend Dev |
| 4.5 | Build goals API | M | 4.2 | Backend Dev |
| 4.6 | Build continuous feedback API | M | 4.2 | Backend Dev |
| 4.7 | Create review cycle setup UI | L | 4.3 | Frontend Dev |
| 4.8 | Create review form UI | L | 4.4 | Frontend Dev |
| 4.9 | Create goals management UI | M | 4.5 | Frontend Dev |
| 4.10 | Create feedback widget | M | 4.6 | Frontend Dev |
| 4.11 | Write performance module tests | L | 4.3-4.10 | QA Engineer |

**(Similar pattern continues for other Phase 4 modules)**

---

## Parallel Development Matrix

### Team Allocation (6 developers)

**Week 10-16 Example** (all working in parallel):

| Developer | Week 10-12 | Week 13-14 | Week 15 | Week 16 |
|-----------|------------|------------|---------|---------|
| Backend Dev 1 | Employee API (3.3) | Leave API (3.19-3.22) | Attendance API (3.32-3.34) | Payroll API (3.42-3.46) |
| Backend Dev 2 | Employee Onboarding (3.11-3.13) | Leave Balance Logic (3.20) | Attendance Reports (3.38) | Payroll Integration (3.45-3.50) |
| Frontend Dev 1 | Employee UI (3.6-3.8) | Leave UI (3.23-3.25) | Attendance UI (3.35-3.37) | Payroll UI (3.47-3.49) |
| Frontend Dev 2 | Employee Features (3.9-3.12) | Leave Calendar (3.26-3.27) | Attendance Corrections (3.36) | Payroll Reports (3.50) |
| Full-Stack Dev | Employee Offboarding (3.15) | Leave Notifications (3.28) | Support Backend/Frontend | Support Backend/Frontend |
| QA Engineer | Test Plan | Write Tests (3.16) | Write Tests (3.29, 3.39) | Write Tests (3.51) |

---

## Task Dependencies Summary

### High-Priority Dependencies (Blocking Multiple Tasks)

1. **Authentication (1.3)** → Blocks all module development
2. **RLS Implementation (1.17)** → Blocks all data operations
3. **Permission System (2.21)** → Blocks all protected features
4. **Employee Module (3.3)** → Blocks Leave, Attendance, Payroll, Performance

### Module Interdependencies

```
Employees (3.3)
  ├─► Leave (3.21) - requires employee records
  ├─► Attendance (3.32) - requires employee records
  ├─► Payroll (3.44) - requires employee records
  ├─► Performance (4.4) - requires employee records
  └─► Recruitment (4.X) - converts to employee

Leave (3.21)
  └─► Payroll (3.45) - deductions for unpaid leave

Attendance (3.32)
  └─► Payroll (3.45) - deductions for absent days
```

---

## Milestone Checklist

### Milestone 1: MVP (End of Week 16)
- [ ] Authentication & authorization working
- [ ] Company onboarding complete
- [ ] Employee management functional
- [ ] Leave management functional
- [ ] Attendance tracking functional
- [ ] Basic payroll functional
- [ ] Deployed to staging

### Milestone 2: Beta (End of Week 28)
- [ ] All core & advanced modules complete
- [ ] Integrations framework ready
- [ ] Reports & analytics working
- [ ] Mobile responsive
- [ ] Performance optimized
- [ ] Security audit passed
- [ ] Beta customers onboarded

### Milestone 3: Launch (End of Week 32)
- [ ] All features complete & tested
- [ ] Documentation complete
- [ ] Support system ready
- [ ] Marketing materials ready
- [ ] Deployed to production
- [ ] First 10 paying customers

---

## Risk Mitigation

### Technical Risks
- **RLS Policy Complexity**: Allocate extra time for testing (Week 4)
- **Payroll Calculation Logic**: Start early, extensive testing (Week 16)
- **Performance at Scale**: Load testing throughout (Week 29)

### Timeline Risks
- **Scope Creep**: Strict feature freeze after Week 28
- **Dependencies**: Buffer time in each phase (+1 week)
- **Integration Issues**: Daily standups to identify blockers early

---

## Daily Standup Template

**What I did yesterday:**
- Task IDs completed

**What I'm doing today:**
- Task IDs in progress

**Blockers:**
- Dependencies waiting on others
- Technical issues

**Need help with:**
- Code review requests
- Architecture decisions

---

This task breakdown ensures the team knows exactly what to build, in what order, and who's responsible for each piece.
