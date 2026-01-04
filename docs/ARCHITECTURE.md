# HRM SaaS Platform - Development Architecture

## Table of Contents
1. [Overview](#overview)
2. [System Architecture](#system-architecture)
3. [Technology Stack](#technology-stack)
4. [Multi-Tenant Architecture](#multi-tenant-architecture)
5. [Priority-Based Development Order](#priority-based-development-order)
6. [Module Dependency Mapping](#module-dependency-mapping)
7. [Modular Design Principles](#modular-design-principles)
8. [Data Flow Architecture](#data-flow-architecture)
9. [Security Architecture](#security-architecture)
10. [Scalability & Performance](#scalability--performance)

---

## Overview

This document outlines the technical architecture for building an enterprise-grade HRM SaaS platform. The architecture is designed with the following core principles:

- **Multi-tenancy**: Complete data isolation between companies
- **Modularity**: Independent, loosely-coupled modules
- **Scalability**: Horizontal scaling capability
- **Security**: Zero-trust security model with role-based access control
- **Performance**: Sub-200ms API response times
- **Maintainability**: Clean code, comprehensive testing

---

## System Architecture

### High-Level System Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENT LAYER                             │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ Web App      │  │ Mobile App   │  │ Public APIs  │          │
│  │ (React/TS)   │  │ (React Nat.) │  │ (REST/GraphQL)│          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└─────────────────────────────────────────────────────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      API GATEWAY / LOAD BALANCER                 │
│                  (Rate Limiting, SSL, WAF)                       │
└─────────────────────────────────────────────────────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    APPLICATION LAYER                             │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────────────┐   │
│  │         Authentication & Authorization Service           │   │
│  │    (JWT, Session Management, RBAC, Tenant Context)       │   │
│  └──────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                   Core API Services                      │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │   │
│  │  │ Platform │ │ Company  │ │ User     │ │ Tenant   │   │   │
│  │  │ Admin    │ │ Mgmt     │ │ Mgmt     │ │ Context  │   │   │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘   │   │
│  └──────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                   Module Services                        │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │   │
│  │  │ Employee │ │ Leave    │ │ Attend.  │ │ Payroll  │   │   │
│  │  │ Service  │ │ Service  │ │ Service  │ │ Service  │   │   │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘   │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │   │
│  │  │ Perform. │ │ Learning │ │ Benefits │ │ Recruit. │   │   │
│  │  │ Service  │ │ Service  │ │ Service  │ │ Service  │   │   │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘   │   │
│  └──────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │               Supporting Services                        │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │   │
│  │  │ Notif.   │ │ File     │ │ Report   │ │ Audit    │   │   │
│  │  │ Service  │ │ Storage  │ │ Service  │ │ Service  │   │   │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘   │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      DATA LAYER                                  │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ PostgreSQL   │  │ Redis Cache  │  │ S3/Storage   │          │
│  │ (Primary DB) │  │ (Sessions)   │  │ (Files/Docs) │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└─────────────────────────────────────────────────────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   BACKGROUND JOBS / WORKERS                      │
├─────────────────────────────────────────────────────────────────┤
│  • Email Sending        • Payroll Processing                    │
│  • Report Generation    • Data Exports                          │
│  • Webhook Delivery     • Scheduled Tasks (Cron)                │
└─────────────────────────────────────────────────────────────────┘
```

### Layer Responsibilities

#### Client Layer
- **Web Application**: React + TypeScript SPA for desktop/tablet users
- **Mobile Application**: React Native app for mobile users (future)
- **Public APIs**: Third-party integration endpoints

#### API Gateway
- SSL termination
- Rate limiting (prevent abuse)
- WAF (Web Application Firewall)
- Request routing
- Load balancing across application instances

#### Application Layer
- **Authentication & Authorization**: Centralized auth service
- **Core API Services**: Platform, company, user, tenant management
- **Module Services**: Independent HR modules (loosely coupled)
- **Supporting Services**: Cross-cutting concerns (notifications, files, audit)

#### Data Layer
- **PostgreSQL**: Primary data store with Row-Level Security (RLS)
- **Redis**: Session storage, caching, rate limiting
- **Object Storage**: Document and file storage (S3, Cloudflare R2, Supabase Storage)

#### Background Jobs
- Asynchronous task processing (email, reports, webhooks)
- Scheduled jobs (payroll reminders, document expiry alerts)

---

## Technology Stack

### Frontend
| Technology | Purpose | Justification |
|-----------|---------|---------------|
| **React 18** | UI Framework | Industry standard, mature ecosystem, great for complex UIs |
| **TypeScript** | Type Safety | Catch errors at compile time, better developer experience |
| **Vite** | Build Tool | Fast HMR, optimized production builds |
| **React Router** | Client-side routing | Standard routing library |
| **TanStack Query** | Server state management | Caching, background refetching, optimistic updates |
| **React Hook Form** | Form handling | Performant, minimal re-renders |
| **Zod** | Schema validation | Type-safe validation, works with React Hook Form |
| **Tailwind CSS** | Styling | Utility-first, highly customizable, fast development |
| **shadcn/ui** | UI Components | Accessible (Radix), customizable, copy-paste approach |
| **Recharts** | Data visualization | Simple, composable charts |
| **Lucide Icons** | Icon library | Consistent, tree-shakeable |

### Backend
| Technology | Purpose | Justification |
|-----------|---------|---------------|
| **Supabase** | Backend-as-a-Service | Auth, DB, Storage, Edge Functions in one platform |
| **PostgreSQL 15+** | Primary database | ACID compliant, RLS for multi-tenancy, JSON support |
| **TypeScript** | Backend language | Shared types with frontend, type safety |
| **Edge Functions** | Serverless API | Auto-scaling, cost-effective |
| **Prisma / Drizzle** | ORM (if not Supabase) | Type-safe database access |

### Infrastructure
| Technology | Purpose |
|-----------|---------|
| **Vercel / AWS / GCP** | Hosting |
| **CloudFlare** | CDN + DDoS protection |
| **GitHub Actions** | CI/CD pipeline |
| **Docker** | Containerization |
| **Sentry** | Error tracking |
| **DataDog / CloudWatch** | Monitoring & logging |

---

## Multi-Tenant Architecture

### Tenancy Strategy: Shared Database with Row-Level Security (RLS)

**Approach**: All companies share the same database, but Row-Level Security policies ensure data isolation.

#### Why RLS over Separate Databases?

| Consideration | Separate DBs | RLS (Shared DB) |
|--------------|-------------|-----------------|
| **Cost** | High (one DB per tenant) | Low (one DB for all) |
| **Scaling** | Complex (manage 1000s of DBs) | Simple (scale one DB) |
| **Backups** | Expensive and slow | Single backup operation |
| **Migrations** | Must run on all DBs | Single migration |
| **Cross-tenant analytics** | Very difficult | Possible (with safeguards) |
| **Data isolation** | Excellent (physical) | Excellent (enforced by DB) |

**Decision**: Use RLS for better operational efficiency while maintaining strong isolation.

### RLS Implementation

#### Every tenant-specific table includes `company_id`:
```sql
CREATE TABLE employees (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL,
  -- other fields
  UNIQUE(company_id, email)
);
```

#### Enable RLS and create policies:
```sql
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;

-- Users can only access their own company's employees
CREATE POLICY tenant_isolation ON employees
  FOR ALL
  USING (company_id = current_setting('app.current_company_id')::UUID);

-- Platform admins can access all companies (for support)
CREATE POLICY platform_admin_access ON employees
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM platform_admins
      WHERE user_id = auth.uid()
    )
  );
```

#### Set tenant context per request:
```typescript
// Backend: Set company_id for the request
await db.query("SET app.current_company_id = $1", [user.company_id]);

// Now all queries automatically filter by company_id
const employees = await db.query("SELECT * FROM employees");
// Returns only employees for this company
```

### Tenant Context Flow

```
1. User logs in → JWT contains { user_id, company_id, role }
2. Request arrives at API → Extract JWT
3. Validate JWT → Get company_id
4. Set DB session variable → SET app.current_company_id = <company_id>
5. Execute query → RLS policy filters results automatically
6. Return response → Only tenant's data returned
```

### RLS Testing Strategy
- **Unit tests**: Verify policies block cross-tenant access
- **Integration tests**: Test with multiple companies
- **Penetration testing**: Attempt to access other tenant's data

---

## Priority-Based Development Order

### Priority 1: Platform Foundation (Weeks 1-6)

**Goal**: Build the infrastructure that all features depend on.

**Rationale**: Cannot build any modules without authentication, multi-tenancy, and company management.

**Deliverables**:
- Repository setup, CI/CD pipeline
- Authentication system (registration, login, JWT, refresh tokens)
- Multi-tenant database schema with RLS
- Company management (create, edit, suspend)
- Platform admin console
- Subscription and billing foundation

**Blockers Removed**: All other development can now proceed in parallel.

---

### Priority 2: Core Layout & Permission System (Weeks 7-9)

**Goal**: Build the navigation, role system, and permission framework.

**Rationale**: Every module needs permission checks. Build the framework before modules.

**Deliverables**:
- Application shell (sidebar, header, breadcrumbs)
- Dashboard/home page
- User management (invite, assign roles)
- Role definition and assignment
- Permission checking utilities (frontend + backend)
- Subscription-based feature gating

**Blockers Removed**: Modules can now be built independently and integrate permissions.

---

### Priority 3: Independent Module Development (Weeks 10-28)

**Goal**: Build HR modules in parallel without blocking each other.

**Rationale**: Modules are designed to be independent. Teams can work on different modules simultaneously.

**Module Development Order** (by business priority):

#### Tier 1 - Core HR (Weeks 10-16) - **MUST HAVE**
1. **Employee Management** (Weeks 10-12)
   - Most fundamental module
   - Required by all other modules
   - Blockers: None (depends only on Platform + Auth)

2. **Leave Management** (Weeks 13-14)
   - High demand feature
   - Relatively simple (good early win)
   - Blockers: Employee module (employee_id references)

3. **Attendance & Time Tracking** (Week 15)
   - Often bundled with Leave
   - Depends on: Employee module
   - Blockers: Employee module

4. **Payroll** (Week 16)
   - High-value feature
   - Requires attendance/leave integration for deductions
   - Blockers: Employee, Leave, Attendance modules

#### Tier 2 - Advanced HR (Weeks 17-22) - **SHOULD HAVE**
5. **Performance Management** (Weeks 17-18)
   - Differentiator from basic HR systems
   - Depends on: Employee module
   - Blockers: Employee module

6. **Learning & Development** (Week 19)
   - Can be built in parallel with Performance
   - Blockers: Employee module

7. **Benefits Administration** (Week 20)
   - Can be built in parallel
   - Integrates with Payroll for deductions
   - Blockers: Employee module (Payroll nice-to-have)

8. **Recruitment & ATS** (Weeks 21-22)
   - Can be built completely independently
   - Converts candidates → employees
   - Blockers: Employee module (for conversion)

#### Tier 3 - Enterprise Features (Weeks 23-28) - **NICE TO HAVE**
9. **Org Chart & Reporting Structure** (Week 23)
   - Visual layer on top of employee data
   - Blockers: Employee module

10. **Advanced Analytics** (Weeks 24-25)
    - Reads data from all modules
    - Should be built after modules are complete
    - Blockers: All other modules

11. **Compliance & Audit** (Week 26)
    - Cross-cutting concern
    - Reads from all modules
    - Blockers: All other modules

12. **Integration Framework** (Weeks 27-28)
    - API and webhooks
    - Integrates with all modules
    - Blockers: All other modules

### Parallel Development Strategy

**Weeks 10-16** (4 teams working in parallel):
- Team A: Employee Management (3 weeks) → Performance Management (2 weeks)
- Team B: Leave Management (2 weeks) → Learning & Development (1 week)
- Team C: Attendance (1 week) → Benefits Administration (1 week) → Recruitment (2 weeks)
- Team D: Payroll (1 week) → Integration Support (ongoing)

**Result**: All Tier 1 modules complete by Week 16 instead of sequentially (which would take 12 weeks).

---

## Module Dependency Mapping

### Dependency Graph

```
                    ┌─────────────────────────┐
                    │ Platform + Auth         │
                    │ (Priority 1)            │
                    └──────────┬──────────────┘
                               │
                    ┌──────────▼──────────────┐
                    │ Permissions & Roles     │
                    │ (Priority 2)            │
                    └──────────┬──────────────┘
                               │
              ┌────────────────┼────────────────┐
              │                │                │
    ┌─────────▼─────────┐     │     ┌──────────▼──────────┐
    │ Employee Module   │     │     │ Recruitment Module  │
    │ (Priority 3.1)    │     │     │ (Priority 3.8)      │
    └─────────┬─────────┘     │     └──────────┬──────────┘
              │               │                │
       ┌──────┴──────┬────────┴─────┬──────────┘
       │             │              │
┌──────▼──────┐ ┌───▼─────┐ ┌──────▼──────┐
│ Leave Mgmt  │ │ Attend. │ │ Performance │
│ (3.2)       │ │ (3.3)   │ │ (3.5)       │
└──────┬──────┘ └───┬─────┘ └─────────────┘
       │            │
       └────────┬───┘
                │
        ┌───────▼───────┐
        │ Payroll (3.4) │
        └───────┬───────┘
                │
        ┌───────▼────────┐
        │ Benefits (3.7) │
        └────────────────┘

        ┌─────────────────┐
        │ Learning (3.6)  │ (Independent)
        └─────────────────┘

                    ┌────────────────────────┐
                    │ Analytics, Audit, APIs │
                    │ (Priority 3.9-12)      │
                    │ Depends on ALL modules │
                    └────────────────────────┘
```

### Module Dependencies Table

| Module | Depends On | Can Start After | Can Be Built In Parallel With |
|--------|-----------|-----------------|-------------------------------|
| **Employee** | Platform, Auth, Permissions | Week 10 | Recruitment |
| **Recruitment** | Platform, Auth, Permissions | Week 10 | Employee |
| **Leave** | Employee | Week 13 | Attendance, Performance, Learning |
| **Attendance** | Employee | Week 13 | Leave, Performance, Learning |
| **Performance** | Employee | Week 13 | Leave, Attendance, Learning |
| **Learning** | Employee | Week 13 | Leave, Attendance, Performance |
| **Payroll** | Employee, Leave, Attendance | Week 16 | Benefits (partial) |
| **Benefits** | Employee (Payroll optional) | Week 16 | Learning, Performance |
| **Org Chart** | Employee | Week 23 | Analytics |
| **Analytics** | All modules | Week 24 | Audit |
| **Audit** | All modules | Week 26 | Analytics |
| **Integrations** | All modules | Week 27 | — |

### Critical Path

The critical path (longest sequence of dependent tasks) is:

```
Platform Setup (6 weeks)
  → Permissions (3 weeks)
    → Employee (3 weeks)
      → Leave (2 weeks) OR Attendance (1 week)
        → Payroll (1 week)
          → Benefits (1 week)
```

**Total Critical Path**: 17 weeks (but we have 28 weeks for modules, so 11 weeks of buffer)

---

## Modular Design Principles

### Principle 1: Bounded Contexts

Each module is a **bounded context** with:
- Its own domain logic
- Its own data tables (no shared tables between modules)
- Its own API endpoints
- Its own UI components

### Principle 2: Minimal Coupling

Modules should:
- **NOT** directly import code from other modules
- **NOT** directly query other module's tables
- **ONLY** depend on:
  - Core utilities (auth, API client, permissions)
  - Shared UI components (buttons, forms, modals)
  - Shared types (User, Company, Permission)

### Principle 3: Integration via APIs

If a module needs data from another module:
- Use internal API calls (e.g., Payroll calls Leave API for deductions)
- Pass data through user actions (e.g., Recruitment converts candidate → employee via Employee API)
- Use event-driven patterns (e.g., Employee created → trigger webhook)

### Principle 4: Independent Deployment

Each module should:
- Have its own database migrations
- Have its own feature branch
- Be testable independently
- Be deployable without breaking other modules

### Module Isolation Example

#### ❌ BAD: Direct dependency
```typescript
// ❌ payroll/PayrollService.ts
import { getEmployeeLeaveBalance } from '../../leave/LeaveService';

const deductions = getEmployeeLeaveBalance(employeeId); // Direct coupling!
```

#### ✅ GOOD: API-based integration
```typescript
// ✅ payroll/PayrollService.ts
import { apiClient } from '@/lib/api';

const leaveBalance = await apiClient.get(`/api/leave/balance/${employeeId}`);
const deductions = calculateDeductions(leaveBalance);
```

### Module Structure Template

```
src/modules/<module-name>/
├── pages/
│   ├── ListPage.tsx           # List view
│   ├── DetailPage.tsx         # Detail/view page
│   ├── CreatePage.tsx         # Create form
│   └── EditPage.tsx           # Edit form
├── components/
│   ├── <Module>List.tsx       # List component
│   ├── <Module>Form.tsx       # Form component
│   ├── <Module>Card.tsx       # Card component
│   └── <Module>Filters.tsx    # Filter component
├── hooks/
│   ├── use<Module>s.ts        # Fetch list (with React Query)
│   ├── use<Module>.ts         # Fetch single item
│   ├── useCreate<Module>.ts   # Create mutation
│   ├── useUpdate<Module>.ts   # Update mutation
│   └── useDelete<Module>.ts   # Delete mutation
├── types/
│   └── index.ts               # TypeScript types for module
├── utils/
│   └── helpers.ts             # Module-specific utilities
├── api.ts                      # API client functions
├── constants.ts                # Module constants (statuses, etc.)
└── routes.ts                   # Module route definitions
```

### Example: Employee Module Structure

```
src/modules/employees/
├── pages/
│   ├── EmployeeList.tsx
│   ├── EmployeeDetail.tsx
│   ├── CreateEmployee.tsx
│   └── EditEmployee.tsx
├── components/
│   ├── EmployeeCard.tsx
│   ├── EmployeeForm.tsx
│   ├── EmployeeFilters.tsx
│   ├── EmployeeAvatar.tsx
│   └── EmployeeStatusBadge.tsx
├── hooks/
│   ├── useEmployees.ts        # const { data, isLoading } = useEmployees()
│   ├── useEmployee.ts         # const { data } = useEmployee(id)
│   ├── useCreateEmployee.ts   # const { mutate } = useCreateEmployee()
│   ├── useUpdateEmployee.ts
│   └── useDeleteEmployee.ts
├── types/
│   └── index.ts               # Employee, CreateEmployeeInput, etc.
├── utils/
│   └── helpers.ts             # getFullName(), formatEmployeeId()
├── api.ts                      # employeeApi.getAll(), .create(), etc.
├── constants.ts                # EMPLOYEE_STATUS, EMPLOYMENT_TYPE
└── routes.ts                   # /app/employees/* routes
```

### Shared Code Location

**Core/Shared Code** (NOT module-specific):

```
src/
├── components/           # Shared UI components
│   ├── ui/              # shadcn/ui components
│   ├── layout/          # Layout components
│   ├── forms/           # Form components
│   └── common/          # Other shared components
├── lib/
│   ├── api.ts           # API client (axios/fetch wrapper)
│   ├── auth.ts          # Auth utilities
│   ├── permissions.ts   # Permission checking
│   └── utils.ts         # General utilities
├── hooks/
│   ├── useAuth.ts       # Auth hook
│   ├── usePermissions.ts
│   └── useToast.ts
├── contexts/
│   ├── AuthContext.tsx
│   ├── TenantContext.tsx
│   └── PermissionContext.tsx
└── types/
    ├── user.ts          # User type
    ├── company.ts       # Company type
    └── common.ts        # Common types
```

---

## Data Flow Architecture

### Request Flow (Authenticated Request)

```
┌─────────────┐
│   Client    │ 1. Request with JWT in header
└──────┬──────┘
       │
       ▼
┌─────────────────────────────┐
│   API Gateway / Middleware  │ 2. Extract & validate JWT
└──────┬──────────────────────┘
       │
       ▼
┌────────────────────────┐
│  Authentication Check  │ 3. Verify token, get user data
└──────┬─────────────────┘
       │
       ▼
┌────────────────────────┐
│  Authorization Check   │ 4. Check permissions (RBAC)
└──────┬─────────────────┘
       │
       ▼
┌────────────────────────┐
│  Set Tenant Context    │ 5. Set company_id in DB session
└──────┬─────────────────┘
       │
       ▼
┌────────────────────────┐
│  Execute Query (RLS)   │ 6. Query automatically filtered by RLS
└──────┬─────────────────┘
       │
       ▼
┌────────────────────────┐
│  Audit Log (Async)     │ 7. Log action for compliance
└──────┬─────────────────┘
       │
       ▼
┌─────────────┐
│   Return    │ 8. Return response to client
│   Response  │
└─────────────┘
```

### State Management Flow

```
┌────────────────────────────────────────────────────────────┐
│                    Client Application                       │
├────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────────────────────────────────────────┐     │
│  │           React Query (Server State)             │     │
│  │  • Fetch data from API                           │     │
│  │  • Cache responses                               │     │
│  │  • Background refetching                         │     │
│  │  • Optimistic updates                            │     │
│  │  • Automatic retries                             │     │
│  └──────────────────────────────────────────────────┘     │
│                                                             │
│  ┌──────────────────────────────────────────────────┐     │
│  │          Context API (Client State)              │     │
│  │  • AuthContext (current user, logout)            │     │
│  │  • TenantContext (current company, switch)       │     │
│  │  • PermissionContext (current permissions)       │     │
│  │  • LocalizationContext (language, timezone)      │     │
│  │  • ThemeContext (dark mode)                      │     │
│  └──────────────────────────────────────────────────┘     │
│                                                             │
│  ┌──────────────────────────────────────────────────┐     │
│  │         Local State (Component State)            │     │
│  │  • useState() for UI state                       │     │
│  │  • Form state (React Hook Form)                  │     │
│  │  • Modal open/close                              │     │
│  └──────────────────────────────────────────────────┘     │
│                                                             │
└────────────────────────────────────────────────────────────┘
```

**State Management Rules**:
- **Server state** (employees, leave requests): Use React Query
- **Global client state** (auth, theme): Use Context API
- **Local UI state** (modal open, form values): Use useState

### Data Mutation Flow (Create/Update/Delete)

```
1. User submits form
   ↓
2. React Hook Form validates with Zod schema
   ↓
3. If valid, call mutation function (React Query)
   ↓
4. Show optimistic update (optional - update UI immediately)
   ↓
5. API request sent with JWT
   ↓
6. Backend validates permission
   ↓
7. Backend validates data (Zod schema on backend too)
   ↓
8. Database transaction (insert/update/delete)
   ↓
9. Audit log created
   ↓
10. Response returned
   ↓
11. React Query updates cache
   ↓
12. UI re-renders with latest data
   ↓
13. Show success toast notification
```

---

## Security Architecture

### Defense in Depth Strategy

Multiple layers of security:

```
Layer 1: Network Security (WAF, DDoS protection, rate limiting)
Layer 2: Authentication (JWT, 2FA, session management)
Layer 3: Authorization (RBAC, permissions)
Layer 4: Data Security (RLS, encryption at rest/transit)
Layer 5: Application Security (input validation, XSS/CSRF protection)
Layer 6: Monitoring & Audit (logs, alerts, intrusion detection)
```

### Authentication Flow

```
┌──────────────┐
│ User Login   │
└──────┬───────┘
       │
       ▼
┌────────────────────────┐
│ Verify credentials     │ (bcrypt hash comparison)
└──────┬─────────────────┘
       │
       ▼
┌────────────────────────┐
│ Check 2FA (if enabled) │
└──────┬─────────────────┘
       │
       ▼
┌────────────────────────┐
│ Generate JWT           │ (contains: user_id, company_id, role)
│ Access Token (15 min)  │
│ Refresh Token (7 days) │
└──────┬─────────────────┘
       │
       ▼
┌────────────────────────┐
│ Store refresh token    │ (in httpOnly cookie or DB)
└──────┬─────────────────┘
       │
       ▼
┌────────────────────────┐
│ Return tokens to       │
│ client                 │
└────────────────────────┘
```

### Authorization Levels

1. **Platform Level** (across all companies)
   - Super Admin: Can access all companies, manage platform
   - Platform Support: Can impersonate companies for support

2. **Company Level** (within a company)
   - Company Admin: Full access to company settings and data
   - HR Manager: Access to HR modules
   - Finance Manager: Access to payroll and financial data
   - Department Manager: Access to own department only
   - Employee: Self-service only
   - Viewer: Read-only access

3. **Module Level** (within an HR module)
   - Can Access Module: `employees.access`
   - Can Read: `employees.read`
   - Can Create: `employees.create`
   - Can Update: `employees.update`
   - Can Delete: `employees.delete`
   - Can Approve: `employees.approve`
   - Can Export: `employees.export`

4. **Record Level** (specific record)
   - Own records only: Employee can view own profile
   - Department records: Manager can view own department
   - All records: HR Manager can view all employees

5. **Field Level** (specific fields)
   - Sensitive fields: Only HR Manager can view salary
   - PII fields: Only HR and employee themselves

### Permission Check Pattern

**Backend (Edge Function / API)**:
```typescript
export async function getEmployee(req: Request) {
  // 1. Extract user from JWT
  const user = await authenticate(req);
  
  // 2. Check module access
  if (!user.permissions.includes('employees.read')) {
    return unauthorized('Missing permission: employees.read');
  }
  
  // 3. Set tenant context
  await setTenantContext(user.company_id);
  
  // 4. Execute query (RLS filters automatically)
  const employee = await db.employees.findUnique(req.params.id);
  
  // 5. Field-level filtering
  if (!user.permissions.includes('employees.read_salary')) {
    delete employee.salary;
  }
  
  // 6. Audit log
  await audit.log('employee.viewed', user.id, employee.id);
  
  return success(employee);
}
```

**Frontend (React Component)**:
```tsx
import { usePermissions } from '@/hooks/usePermissions';

function EmployeeDetail({ employee }) {
  const { hasPermission } = usePermissions();
  
  return (
    <div>
      <h1>{employee.name}</h1>
      
      {/* Conditional rendering based on permission */}
      {hasPermission('employees.read_salary') && (
        <p>Salary: ${employee.salary}</p>
      )}
      
      {/* Conditional action buttons */}
      {hasPermission('employees.update') && (
        <button>Edit Employee</button>
      )}
      
      {hasPermission('employees.delete') && (
        <button>Delete Employee</button>
      )}
    </div>
  );
}
```

### Security Checklist

**Authentication**:
- [ ] Passwords hashed with bcrypt (cost factor 12+)
- [ ] JWT with short expiry (15 minutes)
- [ ] Refresh token with longer expiry (7 days)
- [ ] Refresh token rotation (one-time use)
- [ ] 2FA support (TOTP)
- [ ] Account lockout after 5 failed attempts
- [ ] Password reset with secure tokens (expiry 1 hour)

**Authorization**:
- [ ] RBAC system implemented
- [ ] Permission checks on every API endpoint
- [ ] RLS policies on all tenant tables
- [ ] Field-level permissions enforced
- [ ] Frontend permission gates

**Data Security**:
- [ ] Encryption at rest (database, file storage)
- [ ] Encryption in transit (HTTPS/TLS 1.3)
- [ ] Sensitive data encrypted (SSN, bank accounts) with AES-256
- [ ] PII data minimization
- [ ] Secure file upload (virus scanning)

**Application Security**:
- [ ] Input validation (Zod schemas)
- [ ] SQL injection prevention (parameterized queries, ORM)
- [ ] XSS prevention (React auto-escaping, CSP headers)
- [ ] CSRF protection (CSRF tokens)
- [ ] Rate limiting (per IP, per user)
- [ ] Secure headers (HSTS, X-Frame-Options, etc.)

**Monitoring & Audit**:
- [ ] Audit logs for all sensitive actions
- [ ] Failed login monitoring
- [ ] Unusual activity detection
- [ ] Error tracking (Sentry)
- [ ] Uptime monitoring
- [ ] Security alerts (Slack, email)

---

## Scalability & Performance

### Horizontal Scaling Strategy

```
┌──────────────────────────────────────────────────────┐
│               Load Balancer (AWS ALB / CloudFlare)    │
└────────────────────┬─────────────────────────────────┘
                     │
         ┌───────────┼───────────┐
         │           │           │
    ┌────▼────┐ ┌────▼────┐ ┌────▼────┐
    │ App     │ │ App     │ │ App     │
    │ Server  │ │ Server  │ │ Server  │
    │ (1)     │ │ (2)     │ │ (N)     │
    └────┬────┘ └────┬────┘ └────┬────┘
         │           │           │
         └───────────┼───────────┘
                     │
         ┌───────────▼───────────┐
         │  PostgreSQL (Primary)  │
         │  Read Replicas (1-N)   │
         └───────────┬───────────┘
                     │
         ┌───────────▼───────────┐
         │  Redis Cluster         │
         └───────────────────────┘
```

### Performance Optimizations

#### Database Level
- **Indexing**: Index all foreign keys, commonly filtered columns
- **Partitioning**: Partition large tables (attendance, audit_logs) by date
- **Read Replicas**: Route read queries to replicas
- **Connection Pooling**: Use PgBouncer or built-in pooling
- **Query Optimization**: Use EXPLAIN ANALYZE, optimize N+1 queries

#### Application Level
- **Caching**: Redis for session data, frequently accessed data
- **Background Jobs**: Move heavy tasks (reports, emails) to queues
- **Pagination**: Limit query results (50-100 per page)
- **Lazy Loading**: Load modules on demand (code splitting)
- **API Response Compression**: Gzip/Brotli compression

#### Frontend Level
- **Code Splitting**: Split bundles by route/module
- **Virtual Scrolling**: For large lists (1000+ items)
- **Image Optimization**: Compress, lazy load, use CDN
- **Memoization**: Memoize expensive computations
- **Service Workers**: Cache static assets

### Performance Targets

| Metric | Target | Measurement |
|--------|--------|-------------|
| API Response Time (p95) | < 200ms | DataDog APM |
| Page Load Time (p95) | < 2s | Lighthouse, WebPageTest |
| Time to Interactive | < 3s | Lighthouse |
| Database Query Time (p95) | < 50ms | PostgreSQL logs |
| Background Job Processing | < 1 minute | Job queue metrics |
| Uptime | 99.9% (SLA) | Uptime monitoring |

### Load Testing Strategy

**Tools**: k6, Apache JMeter, or Artillery

**Test Scenarios**:
1. **Baseline**: 100 concurrent users, 10 min
2. **Load Test**: 500 concurrent users, 30 min
3. **Stress Test**: Gradually increase to 2000 users
4. **Spike Test**: Sudden 10x traffic increase
5. **Endurance Test**: 100 users for 24 hours

**Success Criteria**:
- 95% of requests < 200ms
- 0% error rate under normal load
- Graceful degradation under stress (no crashes)

---

## Deployment Architecture

### Environment Strategy

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│ Development │────▶│  Staging    │────▶│ Production  │
└─────────────┘     └─────────────┘     └─────────────┘
   (Local dev)       (Pre-prod QA)       (Live customers)
```

**Development**: Local Docker Compose, hot reload, debug mode  
**Staging**: Identical to production, synthetic test data, QA testing  
**Production**: Auto-scaling, multiple regions, monitoring

### CI/CD Pipeline

```
┌────────────────────────────────────────────────────────────┐
│                      Git Workflow                           │
├────────────────────────────────────────────────────────────┤
│  feature/* ─┬─▶ develop ────▶ staging ────▶ main (prod)   │
│  bugfix/*  ─┘                                               │
│  hotfix/* ─────────────────────────────────▶ main (prod)   │
└────────────────────────────────────────────────────────────┘
                            ▼
┌────────────────────────────────────────────────────────────┐
│                    CI/CD Pipeline (GitHub Actions)          │
├────────────────────────────────────────────────────────────┤
│  1. Trigger: Push to branch                                │
│  2. Install dependencies (bun install)                     │
│  3. Lint (ESLint)                                          │
│  4. Type check (TypeScript)                                │
│  5. Run unit tests (Jest)                                  │
│  6. Build (Vite build)                                     │
│  7. Run E2E tests (Playwright) [staging/prod only]         │
│  8. Deploy to environment:                                 │
│     - develop ────▶ Dev environment                        │
│     - staging ────▶ Staging environment                    │
│     - main ───────▶ Production (with approval)             │
│  9. Run smoke tests                                        │
│  10. Notify team (Slack)                                   │
└────────────────────────────────────────────────────────────┘
```

### Database Migration Strategy

**Tool**: Supabase migrations or Prisma Migrate

**Process**:
1. Create migration file (SQL)
2. Test locally
3. Apply to staging (automated)
4. QA verification
5. Apply to production (with backup)
6. Rollback plan ready

**Migration Best Practices**:
- Always backward compatible (no breaking changes)
- Add columns as nullable first, backfill, then make NOT NULL
- Drop columns in separate deployment (after code deployed)
- Use transactions for data migrations
- Test rollback procedure

---

## Conclusion

This architecture provides:

1. **Scalability**: Horizontal scaling, read replicas, caching
2. **Security**: Multi-layered security, RLS, RBAC, encryption
3. **Modularity**: Independent modules, bounded contexts
4. **Maintainability**: Clean structure, separation of concerns
5. **Performance**: Optimized queries, caching, code splitting
6. **Reliability**: Monitoring, error tracking, audit logs

By following this architecture, the platform will be:
- **Enterprise-ready**: Meets security and compliance requirements
- **Developer-friendly**: Clear structure, easy to onboard new developers
- **Customer-focused**: Fast, reliable, secure user experience

The modular design ensures that teams can work in parallel without blocking each other, accelerating time-to-market while maintaining code quality and system integrity.
