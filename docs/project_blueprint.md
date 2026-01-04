# HR SaaS Platform - Project Blueprint

> **Version**: 1.0.0  
> **Generated**: 2026-01-01  
> **Purpose**: Complete system documentation for rebuilding the platform from scratch

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Architecture](#2-architecture)
3. [Data Models & Database Schema](#3-data-models--database-schema)
4. [Datapoint Inventory](#4-datapoint-inventory)
5. [User Roles & Permissions](#5-user-roles--permissions)
6. [Feature Modules](#6-feature-modules)
7. [Workflows](#7-workflows)
8. [API & Edge Functions](#8-api--edge-functions)
9. [Security](#9-security)
10. [Multi-Tenancy](#10-multi-tenancy)
11. [Subscription & Billing](#11-subscription--billing)
12. [Email System](#12-email-system)
13. [Frontend Architecture](#13-frontend-architecture)
14. [Rebuild Checklist](#14-rebuild-checklist)

---

## 1. Project Overview

### 1.1 Project Purpose

A comprehensive **multi-tenant HR/HRMS SaaS platform** that enables companies to manage their human resources operations including employee management, leave tracking, time tracking, payroll processing, recruitment, performance reviews, and document management.

### 1.2 Problem Statement

Organizations need a centralized, secure, and scalable solution to:
- Manage employee data and organizational structure
- Track attendance, time, and leave
- Process payroll with configurable calculations
- Handle recruitment pipeline (jobs, candidates, interviews, offers)
- Conduct performance reviews
- Manage employee documents with expiry tracking
- Ensure compliance and audit trails

### 1.3 Target Users

| User Type | Description |
|-----------|-------------|
| **Platform Admins** | Manage the entire SaaS platform, companies, plans, billing |
| **Company Admins** | Manage their company's HR operations, users, settings |
| **HR Managers** | Handle day-to-day HR operations, recruitment, payroll |
| **Managers** | Approve leave, review team performance, view reports |
| **Employees** | Submit leave, track time, view payslips, update profile |

### 1.4 Tech Stack

| Layer | Technology | Version |
|-------|------------|---------|
| Frontend | React + TypeScript | ^18.3.1 |
| Build Tool | Vite | Latest |
| Styling | Tailwind CSS | Latest |
| UI Components | shadcn/ui + Radix UI | Latest |
| State Management | TanStack React Query | ^5.83.0 |
| Routing | React Router DOM | ^6.30.1 |
| Forms | React Hook Form + Zod | ^7.61.1 / ^3.25.76 |
| Backend | Supabase (PostgreSQL + Edge Functions) | Latest |
| Auth | Supabase Auth | Latest |
| Storage | Supabase Storage | Latest |
| Email | Resend (configurable per company) | Latest |
| Charts | Recharts | ^2.15.4 |
| OCR | Tesseract.js | ^7.0.0 |
| Excel | xlsx | ^0.18.5 |

### 1.5 Repository Structure

```
├── src/
│   ├── components/          # React components
│   │   ├── ui/              # shadcn/ui base components
│   │   ├── layout/          # App layout components
│   │   ├── platform/        # Platform admin components
│   │   ├── employees/       # Employee management
│   │   ├── leave/           # Leave management
│   │   ├── payroll/         # Payroll components
│   │   ├── recruitment/     # Recruitment components
│   │   ├── performance/     # Performance review components
│   │   ├── documents/       # Document management
│   │   ├── security/        # Security components (MFA, etc.)
│   │   └── settings/        # Settings components
│   ├── contexts/            # React contexts
│   ├── hooks/               # Custom React hooks
│   ├── pages/               # Page components
│   │   ├── app/             # Tenant app pages
│   │   └── platform/        # Platform admin pages
│   ├── types/               # TypeScript types
│   ├── config/              # Configuration files
│   ├── lib/                 # Utility functions
│   └── integrations/        # External integrations
│       └── supabase/        # Supabase client & types
├── supabase/
│   ├── functions/           # Edge functions
│   │   └── _shared/         # Shared utilities
│   ├── migrations/          # Database migrations
│   └── config.toml          # Supabase configuration
├── public/                  # Static assets
└── docs/                    # Documentation
```

---

## 2. Architecture

### 2.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend (React)                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │  Platform   │  │   Tenant    │  │     Public Pages        │  │
│  │   Admin     │  │    App      │  │  (Careers, Screening)   │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Supabase Backend                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │  Supabase   │  │    Edge     │  │      PostgreSQL         │  │
│  │    Auth     │  │  Functions  │  │      Database           │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │   Storage   │  │  Realtime   │  │     Row Level           │  │
│  │   Buckets   │  │ Subscriptions│  │     Security            │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Context Hierarchy

```
<QueryClientProvider>
  <BrowserRouter>
    <AuthProvider>              // Authentication state
      <ImpersonationProvider>   // Platform admin impersonation
        <TenantProvider>        // Current company context
          <PermissionProvider>  // Permission checks
            <App />
          </PermissionProvider>
        </TenantProvider>
      </ImpersonationProvider>
    </AuthProvider>
  </BrowserRouter>
</QueryClientProvider>
```

---

## 3. Data Models & Database Schema

### 3.1 Core Tables Overview

| Table | Description | Multi-tenant |
|-------|-------------|--------------|
| `companies` | Tenant companies | Root table |
| `profiles` | User profiles (extends auth.users) | No (global) |
| `company_users` | User-company relationships with roles | Yes |
| `employees` | Employee records | Yes |
| `departments` | Department hierarchy | Yes |

### 3.2 Complete Table Schemas

#### 3.2.1 Companies Table

```sql
CREATE TABLE companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  logo_url TEXT,
  email TEXT,
  phone TEXT,
  website TEXT,
  industry TEXT,
  size_range TEXT,
  address JSONB,
  timezone TEXT DEFAULT 'UTC',
  date_format TEXT DEFAULT 'YYYY-MM-DD',
  fiscal_year_start INTEGER DEFAULT 1,
  settings JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  pf_enabled BOOLEAN DEFAULT false,
  pf_employee_rate NUMERIC,
  pf_employer_rate NUMERIC,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

**Datapoints:**

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| id | UUID | Yes | auto | Primary key |
| name | TEXT | Yes | - | Company display name |
| slug | TEXT | Yes | - | URL-safe unique identifier |
| logo_url | TEXT | No | null | Company logo URL |
| email | TEXT | No | null | Company contact email |
| phone | TEXT | No | null | Company phone |
| website | TEXT | No | null | Company website |
| industry | TEXT | No | null | Industry category |
| size_range | TEXT | No | null | Employee count range |
| address | JSONB | No | null | {street, city, state, country, postal_code} |
| timezone | TEXT | No | 'UTC' | Company timezone |
| date_format | TEXT | No | 'YYYY-MM-DD' | Preferred date format |
| fiscal_year_start | INTEGER | No | 1 | Fiscal year start month (1-12) |
| settings | JSONB | No | {} | Company-specific settings |
| is_active | BOOLEAN | No | true | Frozen/active status |
| pf_enabled | BOOLEAN | No | false | Provident fund enabled |
| pf_employee_rate | NUMERIC | No | null | Employee PF contribution % |
| pf_employer_rate | NUMERIC | No | null | Employer PF contribution % |

#### 3.2.2 Profiles Table

```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  email TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  phone TEXT,
  avatar_url TEXT,
  locale TEXT DEFAULT 'en',
  timezone TEXT DEFAULT 'UTC',
  max_companies INTEGER DEFAULT 1,
  force_password_change BOOLEAN DEFAULT false,
  login_type TEXT,
  last_login_at TIMESTAMPTZ,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

#### 3.2.3 Company Users Table (Multi-tenant Junction)

```sql
CREATE TABLE company_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role DEFAULT 'employee',
  is_active BOOLEAN DEFAULT true,
  is_primary BOOLEAN DEFAULT false,
  permissions JSONB,
  invited_at TIMESTAMPTZ,
  invited_by UUID,
  joined_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(company_id, user_id)
);
```

#### 3.2.4 Employees Table

```sql
CREATE TABLE employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) NOT NULL,
  user_id UUID REFERENCES auth.users(id),
  employee_number TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL,
  personal_email TEXT,
  phone TEXT,
  date_of_birth DATE,
  gender TEXT,
  nationality TEXT,
  national_id TEXT,
  hire_date DATE NOT NULL,
  probation_end_date DATE,
  termination_date DATE,
  termination_reason TEXT,
  department_id UUID REFERENCES departments(id),
  manager_id UUID REFERENCES employees(id),
  job_title TEXT,
  employment_type employment_type DEFAULT 'full_time',
  employment_status employment_status DEFAULT 'active',
  work_location TEXT,
  salary NUMERIC,
  salary_currency TEXT DEFAULT 'USD',
  address JSONB,
  bank_details JSONB,
  emergency_contact JSONB,
  tax_info JSONB,
  benefits JSONB,
  skills TEXT[],
  certifications JSONB,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(company_id, employee_number)
);
```

**JSONB Schemas:**

```typescript
// address
interface Address {
  street?: string;
  city?: string;
  state?: string;
  country?: string;
  postal_code?: string;
}

// bank_details
interface BankDetails {
  bank_name?: string;
  account_name?: string;
  account_number?: string;
  routing_number?: string;
  iban?: string;
  swift_code?: string;
}

// emergency_contact
interface EmergencyContact {
  name?: string;
  relationship?: string;
  phone?: string;
  email?: string;
}

// tax_info
interface TaxInfo {
  tax_id?: string;
  tax_bracket?: string;
  exemptions?: number;
}
```

#### 3.2.5 Departments Table

```sql
CREATE TABLE departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) NOT NULL,
  parent_id UUID REFERENCES departments(id),
  name TEXT NOT NULL,
  code TEXT,
  description TEXT,
  manager_id UUID REFERENCES employees(id),
  cost_center TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### 3.3 Leave Management Tables

#### 3.3.1 Leave Types

```sql
CREATE TABLE leave_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) NOT NULL,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  description TEXT,
  color TEXT,
  default_days NUMERIC,
  max_consecutive_days INTEGER,
  min_notice_days INTEGER,
  carry_over_limit INTEGER,
  accrual_rate NUMERIC,
  is_paid BOOLEAN DEFAULT true,
  requires_approval BOOLEAN DEFAULT true,
  requires_document BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

#### 3.3.2 Leave Requests

```sql
CREATE TABLE leave_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) NOT NULL,
  employee_id UUID REFERENCES employees(id) NOT NULL,
  leave_type_id UUID REFERENCES leave_types(id) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  start_half_day BOOLEAN DEFAULT false,
  end_half_day BOOLEAN DEFAULT false,
  total_days NUMERIC NOT NULL,
  reason TEXT,
  status leave_status DEFAULT 'pending',
  reviewed_by UUID REFERENCES employees(id),
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  document_urls TEXT[],
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

#### 3.3.3 Leave Balances

```sql
CREATE TABLE leave_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) NOT NULL,
  employee_id UUID REFERENCES employees(id) NOT NULL,
  leave_type_id UUID REFERENCES leave_types(id) NOT NULL,
  fiscal_year INTEGER NOT NULL,
  total_entitlement NUMERIC DEFAULT 0,
  used_days NUMERIC DEFAULT 0,
  pending_days NUMERIC DEFAULT 0,
  carried_over NUMERIC DEFAULT 0,
  manual_adjustment NUMERIC DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(company_id, employee_id, leave_type_id, fiscal_year)
);
```

### 3.4 Time Tracking Tables

```sql
CREATE TABLE time_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) NOT NULL,
  employee_id UUID REFERENCES employees(id) NOT NULL,
  entry_date DATE NOT NULL,
  clock_in TIMESTAMPTZ NOT NULL,
  clock_out TIMESTAMPTZ,
  break_duration INTEGER DEFAULT 0,
  total_hours NUMERIC,
  overtime_hours NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'active',
  notes TEXT,
  location JSONB,
  is_manual BOOLEAN DEFAULT false,
  approved_by UUID REFERENCES employees(id),
  approved_at TIMESTAMPTZ,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE time_entry_breaks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) NOT NULL,
  employee_id UUID REFERENCES employees(id) NOT NULL,
  time_entry_id UUID REFERENCES time_entries(id) NOT NULL,
  break_start TIMESTAMPTZ NOT NULL,
  break_end TIMESTAMPTZ,
  break_type TEXT,
  duration_minutes INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### 3.5 Payroll Tables

```sql
CREATE TABLE payroll_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  run_date DATE NOT NULL,
  status payroll_status DEFAULT 'draft',
  total_gross NUMERIC DEFAULT 0,
  total_net NUMERIC DEFAULT 0,
  total_deductions NUMERIC DEFAULT 0,
  total_employer_cost NUMERIC DEFAULT 0,
  employee_count INTEGER DEFAULT 0,
  currency TEXT DEFAULT 'USD',
  notes TEXT,
  processed_by UUID REFERENCES employees(id),
  processed_at TIMESTAMPTZ,
  approved_by UUID REFERENCES employees(id),
  approved_at TIMESTAMPTZ,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE payroll_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) NOT NULL,
  payroll_run_id UUID REFERENCES payroll_runs(id) NOT NULL,
  employee_id UUID REFERENCES employees(id) NOT NULL,
  base_salary NUMERIC DEFAULT 0,
  hours_worked NUMERIC,
  overtime_hours NUMERIC,
  overtime_pay NUMERIC,
  bonuses NUMERIC,
  commissions NUMERIC,
  allowances JSONB,
  gross_pay NUMERIC NOT NULL,
  tax_deductions NUMERIC,
  pf_deduction NUMERIC,
  benefits_deductions NUMERIC,
  other_deductions JSONB,
  total_deductions NUMERIC,
  net_pay NUMERIC NOT NULL,
  employer_contributions JSONB,
  total_employer_cost NUMERIC,
  days_present INTEGER,
  days_absent INTEGER,
  days_late INTEGER,
  half_days INTEGER,
  total_late_minutes INTEGER,
  notes TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### 3.6 Recruitment Tables

```sql
CREATE TABLE jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) NOT NULL,
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  department_id UUID REFERENCES departments(id),
  hiring_manager_id UUID REFERENCES employees(id),
  description TEXT,
  requirements TEXT,
  responsibilities TEXT,
  employment_type employment_type DEFAULT 'full_time',
  location TEXT,
  is_remote BOOLEAN DEFAULT false,
  salary_min NUMERIC,
  salary_max NUMERIC,
  salary_currency TEXT,
  show_salary BOOLEAN DEFAULT false,
  openings INTEGER DEFAULT 1,
  status job_status DEFAULT 'draft',
  published_at TIMESTAMPTZ,
  closes_at TIMESTAMPTZ,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(company_id, slug)
);

CREATE TABLE candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) NOT NULL,
  job_id UUID REFERENCES jobs(id) NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  resume_url TEXT,
  cover_letter TEXT,
  linkedin_url TEXT,
  portfolio_url TEXT,
  source TEXT,
  status candidate_status DEFAULT 'applied',
  current_stage_started_at TIMESTAMPTZ,
  overall_rating NUMERIC,
  rating NUMERIC,
  expected_salary NUMERIC,
  expected_salary_currency TEXT,
  availability_date DATE,
  notice_period_days INTEGER,
  notes JSONB,
  interview_notes JSONB,
  rejected_reason TEXT,
  referral_employee_id UUID REFERENCES employees(id),
  hired_employee_id UUID REFERENCES employees(id),
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE interviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) NOT NULL,
  candidate_id UUID REFERENCES candidates(id) NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  interview_type interview_type DEFAULT 'video',
  round_number INTEGER DEFAULT 1,
  scheduled_at TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER DEFAULT 60,
  location TEXT,
  meeting_link TEXT,
  status interview_status DEFAULT 'scheduled',
  notes TEXT,
  created_by UUID REFERENCES employees(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE interview_panelists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_id UUID REFERENCES interviews(id) NOT NULL,
  employee_id UUID REFERENCES employees(id) NOT NULL,
  role TEXT,
  is_required BOOLEAN DEFAULT true,
  feedback_submitted BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE interview_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_id UUID REFERENCES interviews(id) NOT NULL,
  panelist_id UUID REFERENCES interview_panelists(id) NOT NULL,
  overall_rating NUMERIC,
  technical_rating NUMERIC,
  communication_rating NUMERIC,
  culture_fit_rating NUMERIC,
  strengths TEXT,
  weaknesses TEXT,
  detailed_notes TEXT,
  recommendation feedback_recommendation,
  submitted_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE job_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) NOT NULL,
  job_id UUID REFERENCES jobs(id) NOT NULL,
  candidate_id UUID REFERENCES candidates(id) NOT NULL,
  department_id UUID REFERENCES departments(id),
  reporting_to UUID REFERENCES employees(id),
  salary_offered NUMERIC NOT NULL,
  salary_currency TEXT DEFAULT 'USD',
  employment_type employment_type DEFAULT 'full_time',
  start_date DATE NOT NULL,
  offer_expiry_date DATE NOT NULL,
  benefits JSONB,
  additional_terms TEXT,
  status offer_status DEFAULT 'draft',
  access_token UUID DEFAULT gen_random_uuid(),
  sent_at TIMESTAMPTZ,
  responded_at TIMESTAMPTZ,
  candidate_response TEXT,
  negotiation_notes JSONB,
  created_by UUID REFERENCES employees(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE screening_tests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) NOT NULL,
  job_id UUID REFERENCES jobs(id),
  title TEXT NOT NULL,
  description TEXT,
  test_type screening_test_type DEFAULT 'questionnaire',
  questions JSONB DEFAULT '[]',
  duration_minutes INTEGER DEFAULT 60,
  passing_score NUMERIC DEFAULT 70,
  is_template BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES employees(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE candidate_screenings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) NOT NULL,
  candidate_id UUID REFERENCES candidates(id) NOT NULL,
  screening_test_id UUID REFERENCES screening_tests(id) NOT NULL,
  access_token UUID DEFAULT gen_random_uuid(),
  status screening_status DEFAULT 'pending',
  assigned_by UUID REFERENCES employees(id),
  assigned_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  answers JSONB,
  score NUMERIC,
  evaluated_by UUID REFERENCES employees(id),
  evaluated_at TIMESTAMPTZ,
  evaluation_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE candidate_timeline (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) NOT NULL,
  candidate_id UUID REFERENCES candidates(id) NOT NULL,
  event_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  metadata JSONB,
  created_by UUID REFERENCES employees(id),
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### 3.7 Performance Review Tables

```sql
CREATE TABLE performance_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) NOT NULL,
  employee_id UUID REFERENCES employees(id) NOT NULL,
  reviewer_id UUID REFERENCES employees(id) NOT NULL,
  review_type TEXT,
  review_period_start DATE NOT NULL,
  review_period_end DATE NOT NULL,
  status review_status DEFAULT 'draft',
  overall_rating NUMERIC,
  goals JSONB,
  competencies JSONB,
  self_assessment TEXT,
  manager_assessment TEXT,
  strengths TEXT,
  areas_for_improvement TEXT,
  development_plan TEXT,
  employee_comments TEXT,
  next_review_date DATE,
  completed_at TIMESTAMPTZ,
  acknowledged_at TIMESTAMPTZ,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### 3.8 Document Management Tables

```sql
CREATE TABLE document_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) NOT NULL,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  description TEXT,
  has_expiry BOOLEAN DEFAULT false,
  reminder_days INTEGER,
  is_required BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(company_id, code)
);

CREATE TABLE employee_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) NOT NULL,
  employee_id UUID REFERENCES employees(id) NOT NULL,
  document_type_id UUID REFERENCES document_types(id) NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,
  issue_date DATE,
  expiry_date DATE,
  -- Verification workflow
  is_verified BOOLEAN DEFAULT false,
  verification_status document_verification_status DEFAULT 'pending',
  verified_by UUID REFERENCES employees(id),
  verified_at TIMESTAMPTZ,
  rejection_reason TEXT,
  -- Versioning
  version_number INTEGER DEFAULT 1,
  parent_document_id UUID REFERENCES employee_documents(id),
  is_latest_version BOOLEAN DEFAULT true,
  -- Soft delete
  deleted_at TIMESTAMPTZ,
  deleted_by UUID REFERENCES employees(id),
  -- Access tracking
  access_count INTEGER DEFAULT 0,
  last_accessed_at TIMESTAMPTZ,
  last_accessed_by UUID,
  -- Metadata
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Document verification status enum
CREATE TYPE document_verification_status AS ENUM (
  'pending',
  'verified',
  'rejected',
  'expired'
);

-- Document access logs for compliance
CREATE TABLE document_access_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES employee_documents(id) NOT NULL,
  company_id UUID REFERENCES companies(id) NOT NULL,
  accessed_by UUID NOT NULL,
  access_type TEXT NOT NULL, -- 'view', 'download', 'delete'
  ip_address_masked TEXT,
  user_agent TEXT,
  access_granted BOOLEAN DEFAULT true,
  denial_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Auto-expire trigger
CREATE OR REPLACE FUNCTION check_document_expiry()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.expiry_date IS NOT NULL 
       AND NEW.expiry_date < CURRENT_DATE 
       AND NEW.verification_status != 'expired' THEN
        NEW.verification_status := 'expired';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER auto_expire_documents
BEFORE UPDATE ON employee_documents
FOR EACH ROW
EXECUTE FUNCTION check_document_expiry();
```

**Document RLS Policies (Permission-Based):**

```sql
-- SELECT: Own documents, manager's team, or has read permission
CREATE POLICY documents_select_permission ON employee_documents
FOR SELECT USING (
  deleted_at IS NULL
  AND can_use_documents(auth.uid(), company_id)
  AND (
    is_own_employee_record(auth.uid(), employee_id)
    OR is_manager_of_employee(auth.uid(), employee_id)
    OR has_permission(auth.uid(), company_id, 'documents', 'read')
  )
);

-- INSERT: Own document or has create permission
CREATE POLICY documents_insert_permission ON employee_documents
FOR INSERT WITH CHECK (
  can_use_documents(auth.uid(), company_id)
  AND guard_write_operation(company_id)
  AND (
    is_own_employee_record(auth.uid(), employee_id)
    OR has_permission(auth.uid(), company_id, 'documents', 'create')
  )
);

-- UPDATE: Has update permission only
CREATE POLICY documents_update_permission ON employee_documents
FOR UPDATE USING (
  deleted_at IS NULL
  AND can_use_documents(auth.uid(), company_id)
  AND has_permission(auth.uid(), company_id, 'documents', 'update')
) WITH CHECK (
  guard_write_operation(company_id)
);

-- DELETE: Has delete permission only
CREATE POLICY documents_delete_permission ON employee_documents
FOR DELETE USING (
  can_use_documents(auth.uid(), company_id)
  AND has_permission(auth.uid(), company_id, 'documents', 'delete')
);
```

**Document Access Functions:**

```sql
-- Check document access for specific actions
CREATE FUNCTION can_access_document(_user_id uuid, _document_id uuid, _action text)
RETURNS boolean AS $$
DECLARE
    _company_id uuid;
    _employee_id uuid;
    _doc_employee_id uuid;
    _is_own boolean;
    _is_manager boolean;
BEGIN
    SELECT company_id, employee_id INTO _company_id, _doc_employee_id
    FROM employee_documents
    WHERE id = _document_id AND deleted_at IS NULL;
    
    IF _company_id IS NULL THEN RETURN false; END IF;
    IF NOT can_use_documents(_user_id, _company_id) THEN RETURN false; END IF;
    
    SELECT id INTO _employee_id
    FROM employees WHERE user_id = _user_id AND company_id = _company_id;
    
    _is_own := _employee_id = _doc_employee_id;
    _is_manager := is_manager_of_employee(_user_id, _doc_employee_id);
    
    CASE _action
        WHEN 'read' THEN
            RETURN _is_own OR _is_manager OR has_permission(_user_id, _company_id, 'documents', 'read');
        WHEN 'create' THEN
            RETURN has_permission(_user_id, _company_id, 'documents', 'create')
                OR (_is_own AND is_active_company_member(_user_id, _company_id));
        WHEN 'update' THEN
            RETURN has_permission(_user_id, _company_id, 'documents', 'update');
        WHEN 'delete' THEN
            RETURN has_permission(_user_id, _company_id, 'documents', 'delete');
        WHEN 'verify' THEN
            RETURN has_permission(_user_id, _company_id, 'documents', 'verify');
        ELSE RETURN false;
    END CASE;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Log document access
CREATE FUNCTION log_document_access(_document_id uuid, _access_type text, _ip_address text, _user_agent text)
RETURNS uuid AS $$
DECLARE
    _log_id uuid;
    _company_id uuid;
BEGIN
    SELECT company_id INTO _company_id FROM employee_documents WHERE id = _document_id;
    
    INSERT INTO document_access_logs (document_id, company_id, accessed_by, access_type, ip_address_masked, user_agent)
    VALUES (_document_id, _company_id, auth.uid(), _access_type, mask_ip_address(_ip_address), truncate_user_agent(_user_agent))
    RETURNING id INTO _log_id;
    
    UPDATE employee_documents SET
        access_count = COALESCE(access_count, 0) + 1,
        last_accessed_at = now(),
        last_accessed_by = auth.uid()
    WHERE id = _document_id;
    
    RETURN _log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Soft delete document
CREATE FUNCTION soft_delete_document(_document_id uuid, _employee_id uuid)
RETURNS boolean AS $$
BEGIN
    IF NOT can_access_document(auth.uid(), _document_id, 'delete') THEN
        RAISE EXCEPTION 'Not authorized to delete this document';
    END IF;
    
    UPDATE employee_documents SET deleted_at = now(), deleted_by = _employee_id
    WHERE id = _document_id;
    
    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Verify document with status
CREATE FUNCTION verify_document(_document_id uuid, _status document_verification_status, _verifier_employee_id uuid, _rejection_reason text DEFAULT NULL)
RETURNS boolean AS $$
BEGIN
    IF NOT can_access_document(auth.uid(), _document_id, 'verify') THEN
        RAISE EXCEPTION 'Not authorized to verify this document';
    END IF;
    
    IF _status = 'rejected' AND (_rejection_reason IS NULL OR _rejection_reason = '') THEN
        RAISE EXCEPTION 'Rejection reason is required';
    END IF;
    
    UPDATE employee_documents SET
        verification_status = _status,
        verified_by = _verifier_employee_id,
        verified_at = now(),
        is_verified = (_status = 'verified'),
        rejection_reason = _rejection_reason
    WHERE id = _document_id;
    
    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check document limits
CREATE FUNCTION check_document_limits(_company_id uuid, _employee_id uuid)
RETURNS jsonb AS $$
DECLARE
    _plan_features jsonb;
    _max_storage_mb integer;
    _max_per_employee integer;
    _current_storage_bytes bigint;
    _current_count integer;
BEGIN
    SELECT p.features INTO _plan_features
    FROM company_subscriptions cs JOIN plans p ON p.id = cs.plan_id
    WHERE cs.company_id = _company_id AND cs.status IN ('active', 'trialing');
    
    _max_storage_mb := COALESCE((_plan_features->'documents'->>'max_storage_mb')::integer, -1);
    _max_per_employee := COALESCE((_plan_features->'documents'->>'max_per_employee')::integer, -1);
    
    SELECT COALESCE(SUM(file_size), 0), COUNT(*) INTO _current_storage_bytes, _current_count
    FROM employee_documents WHERE company_id = _company_id AND employee_id = _employee_id AND deleted_at IS NULL;
    
    RETURN jsonb_build_object(
        'max_storage_mb', _max_storage_mb,
        'max_per_employee', _max_per_employee,
        'current_storage_bytes', _current_storage_bytes,
        'current_count', _current_count,
        'can_upload', (
            (_max_storage_mb = -1 OR (_current_storage_bytes / 1024 / 1024) < _max_storage_mb)
            AND (_max_per_employee = -1 OR _current_count < _max_per_employee)
        )
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;
```

### 3.9 Expense Management Tables

```sql
CREATE TABLE expense_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) NOT NULL,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  description TEXT,
  budget_limit NUMERIC,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) NOT NULL,
  employee_id UUID REFERENCES employees(id) NOT NULL,
  category_id UUID REFERENCES expense_categories(id) NOT NULL,
  expense_date DATE NOT NULL,
  amount NUMERIC NOT NULL,
  currency TEXT DEFAULT 'USD',
  description TEXT NOT NULL,
  receipt_url TEXT,
  status TEXT DEFAULT 'pending',
  approved_by UUID REFERENCES employees(id),
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,
  reimbursed_at TIMESTAMPTZ,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### 3.10 Subscription & Billing Tables

```sql
CREATE TABLE plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  price_monthly NUMERIC DEFAULT 0,
  price_yearly NUMERIC DEFAULT 0,
  max_employees INTEGER,
  max_storage_gb INTEGER,
  features JSONB,
  trial_enabled BOOLEAN DEFAULT true,
  trial_default_days INTEGER DEFAULT 14,
  trial_restrictions JSONB,
  sort_order INTEGER,
  is_active BOOLEAN DEFAULT true,
  is_public BOOLEAN DEFAULT true,
  company_id UUID REFERENCES companies(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE company_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) UNIQUE NOT NULL,
  plan_id UUID REFERENCES plans(id) NOT NULL,
  status subscription_status DEFAULT 'trialing',
  billing_interval plan_interval DEFAULT 'monthly',
  current_period_start TIMESTAMPTZ DEFAULT now(),
  current_period_end TIMESTAMPTZ NOT NULL,
  trial_ends_at TIMESTAMPTZ,
  trial_total_days INTEGER,
  canceled_at TIMESTAMPTZ,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

**Plan Features JSONB Schema:**

```typescript
interface PlanFeatures {
  modules: ModuleId[] | 'all';
  support?: 'community' | 'email' | 'priority' | 'dedicated';
  sso?: boolean;
  api?: boolean;
  audit?: boolean;
}
```

### 3.11 Audit & Logging Tables

```sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id),
  user_id UUID,
  action audit_action NOT NULL,
  table_name TEXT NOT NULL,
  record_id UUID,
  old_values JSONB,
  new_values JSONB,
  metadata JSONB,
  actor_role TEXT,
  target_type TEXT,
  severity TEXT,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE security_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id),
  user_id UUID,
  event_type security_event_type NOT NULL,
  description TEXT,
  severity TEXT DEFAULT 'medium',
  ip_address INET,
  ip_address_masked TEXT,
  user_agent TEXT,
  user_agent_truncated TEXT,
  location JSONB,
  metadata JSONB,
  is_resolved BOOLEAN DEFAULT false,
  resolved_by UUID,
  resolved_at TIMESTAMPTZ,
  resolution_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE application_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service TEXT NOT NULL,
  level TEXT DEFAULT 'info',
  message TEXT NOT NULL,
  context JSONB,
  error_code TEXT,
  error_stack TEXT,
  company_id UUID REFERENCES companies(id),
  user_id UUID,
  request_id TEXT,
  duration_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE billing_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) NOT NULL,
  event_type TEXT NOT NULL,
  subscription_id UUID REFERENCES company_subscriptions(id),
  plan_id UUID REFERENCES plans(id),
  previous_plan_id UUID REFERENCES plans(id),
  amount NUMERIC,
  currency TEXT,
  metadata JSONB,
  triggered_by UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE impersonation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID NOT NULL,
  company_id UUID REFERENCES companies(id) NOT NULL,
  company_name TEXT NOT NULL,
  action TEXT NOT NULL,
  session_id TEXT,
  ip_address INET,
  user_agent TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id),
  recipient_email TEXT NOT NULL,
  recipient_name TEXT,
  subject TEXT NOT NULL,
  template_type TEXT,
  provider TEXT,
  status TEXT DEFAULT 'pending',
  message_id TEXT,
  sent_at TIMESTAMPTZ,
  error_message TEXT,
  error_code TEXT,
  retry_count INTEGER DEFAULT 0,
  cc_emails TEXT[],
  bcc_emails TEXT[],
  triggered_by UUID,
  triggered_from TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### 3.12 Platform Administration Tables

```sql
CREATE TABLE platform_admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) UNIQUE NOT NULL,
  role TEXT DEFAULT 'admin',
  is_active BOOLEAN DEFAULT true,
  metadata JSONB,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE platform_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  value JSONB NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE company_creation_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token UUID UNIQUE DEFAULT gen_random_uuid(),
  created_by UUID NOT NULL,
  email TEXT,
  plan_id UUID REFERENCES plans(id),
  modules JSONB,
  enable_trial BOOLEAN DEFAULT true,
  trial_days INTEGER,
  billing_interval TEXT,
  notes TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  max_uses INTEGER DEFAULT 1,
  uses INTEGER DEFAULT 0,
  used_at TIMESTAMPTZ,
  used_by_company_id UUID REFERENCES companies(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  secret UUID DEFAULT gen_random_uuid(),
  events TEXT[] DEFAULT '{}',
  headers JSONB,
  is_active BOOLEAN DEFAULT true,
  retry_count INTEGER DEFAULT 3,
  timeout_seconds INTEGER DEFAULT 30,
  last_triggered_at TIMESTAMPTZ,
  last_status INTEGER,
  failure_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE webhook_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id UUID REFERENCES webhooks(id) NOT NULL,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  success BOOLEAN DEFAULT false,
  response_status INTEGER,
  response_body TEXT,
  error_message TEXT,
  duration_ms INTEGER,
  attempt_number INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### 3.13 Domain & Subdomain Tables

```sql
CREATE TABLE company_domains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) NOT NULL,
  subdomain TEXT,
  custom_domain TEXT,
  is_primary BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  is_verified BOOLEAN DEFAULT false,
  verification_token UUID DEFAULT gen_random_uuid(),
  verified_at TIMESTAMPTZ,
  hosting_provider TEXT,
  vercel_domain_id TEXT,
  vercel_status TEXT,
  vercel_verified BOOLEAN,
  vercel_error TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE subdomain_change_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) NOT NULL,
  requested_by UUID NOT NULL,
  current_subdomain TEXT NOT NULL,
  requested_subdomain TEXT NOT NULL,
  reason TEXT,
  status subdomain_request_status DEFAULT 'pending',
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### 3.14 Security & Access Tables

```sql
CREATE TABLE permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module permission_module NOT NULL,
  action permission_action NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(module, action)
);

CREATE TABLE role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) NOT NULL,
  role app_role NOT NULL,
  permission_id UUID REFERENCES permissions(id) NOT NULL,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(company_id, role, permission_id)
);

CREATE TABLE user_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) NOT NULL,
  user_id UUID NOT NULL,
  permission_id UUID REFERENCES permissions(id) NOT NULL,
  granted BOOLEAN DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(company_id, user_id, permission_id)
);

CREATE TABLE trusted_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  device_fingerprint TEXT NOT NULL,
  device_name TEXT NOT NULL,
  browser TEXT,
  os TEXT,
  is_trusted BOOLEAN DEFAULT true,
  is_current BOOLEAN DEFAULT false,
  first_seen_at TIMESTAMPTZ DEFAULT now(),
  last_used_at TIMESTAMPTZ DEFAULT now(),
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE support_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) NOT NULL,
  support_user_id UUID NOT NULL,
  granted_by UUID NOT NULL,
  starts_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  revoked_by UUID,
  reason TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### 3.15 Work Schedule Tables

```sql
CREATE TABLE work_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) NOT NULL,
  employee_id UUID REFERENCES employees(id),
  day_of_week INTEGER NOT NULL,
  is_working_day BOOLEAN DEFAULT true,
  expected_start TIME DEFAULT '09:00:00',
  expected_end TIME DEFAULT '17:00:00',
  expected_hours NUMERIC DEFAULT 8,
  break_minutes INTEGER DEFAULT 60,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### 3.16 Trial & Request Tables

```sql
CREATE TABLE trial_extension_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) NOT NULL,
  requested_by UUID NOT NULL,
  requested_days INTEGER DEFAULT 7,
  reason TEXT NOT NULL,
  extension_number INTEGER DEFAULT 1,
  status TEXT DEFAULT 'pending',
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE trial_email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) NOT NULL,
  email_type TEXT NOT NULL,
  recipient_email TEXT NOT NULL,
  days_remaining INTEGER NOT NULL,
  sent_date DATE DEFAULT CURRENT_DATE,
  sent_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE multi_company_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  user_email TEXT NOT NULL,
  user_name TEXT,
  requested_count INTEGER DEFAULT 5,
  reason TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

---

## 4. Datapoint Inventory

### 4.1 Enums

| Enum | Values |
|------|--------|
| `app_role` | super_admin, company_admin, hr_manager, manager, employee |
| `audit_action` | create, read, update, delete, login, logout, export, import |
| `candidate_status` | applied, screening, interviewing, offered, hired, rejected, withdrawn |
| `employment_status` | active, on_leave, terminated, suspended |
| `employment_type` | full_time, part_time, contract, intern, temporary |
| `feedback_recommendation` | strong_hire, hire, neutral, no_hire, strong_no_hire |
| `interview_status` | scheduled, in_progress, completed, cancelled, rescheduled, no_show |
| `interview_type` | phone, video, onsite, panel, technical |
| `job_status` | draft, open, closed, on_hold |
| `leave_status` | pending, approved, rejected, canceled |
| `offer_status` | draft, pending_approval, approved, sent, accepted, declined, negotiating, expired, withdrawn |
| `payroll_status` | draft, processing, completed, failed |
| `permission_action` | read, create, update, delete, approve, process, verify, export, manage |
| `permission_module` | dashboard, employees, departments, leave, time_tracking, documents, recruitment, performance, payroll, expenses, compliance, audit, integrations, settings, users |
| `plan_interval` | monthly, yearly |
| `review_status` | draft, in_progress, completed, acknowledged |
| `screening_status` | pending, in_progress, completed, expired, passed, failed |
| `screening_test_type` | questionnaire, coding, personality, skills |
| `security_event_type` | login_success, login_failure, password_change, mfa_enabled, mfa_disabled, suspicious_activity, permission_denied, data_export |
| `subdomain_request_status` | pending, approved, rejected |
| `subscription_status` | active, past_due, canceled, trialing, trial_expired, paused |
| `document_verification_status` | pending, verified, rejected, expired |

---

### 4.2 Document Module Datapoints

| Datapoint | Type | Source | Sensitivity | Stored In |
|-----------|------|--------|-------------|-----------|
| document_id | UUID | database | internal | employee_documents.id |
| title | string | user_input | internal | employee_documents.title |
| description | string | user_input | internal | employee_documents.description |
| file_name | string | user_input | internal | employee_documents.file_name |
| file_url | string | computed | internal | employee_documents.file_url |
| file_size | number | computed | internal | employee_documents.file_size |
| mime_type | string | computed | internal | employee_documents.mime_type |
| issue_date | date | user_input | pii | employee_documents.issue_date |
| expiry_date | date | user_input | pii | employee_documents.expiry_date |
| verification_status | enum | database | internal | employee_documents.verification_status |
| rejection_reason | string | user_input | internal | employee_documents.rejection_reason |
| version_number | number | computed | internal | employee_documents.version_number |
| is_latest_version | boolean | computed | internal | employee_documents.is_latest_version |
| parent_document_id | UUID | computed | internal | employee_documents.parent_document_id |
| deleted_at | timestamp | database | internal | employee_documents.deleted_at |
| access_count | number | computed | internal | employee_documents.access_count |
| last_accessed_at | timestamp | computed | internal | employee_documents.last_accessed_at |
| access_type | enum | event | internal | document_access_logs.access_type |
| ip_address_masked | string | event | internal | document_access_logs.ip_address_masked |

**Document Lifecycle:**
- Created: On upload via document-upload edge function
- Updated: Verification status changes, metadata updates
- Soft Deleted: deleted_at set, file removed from storage
- Access Logged: Every view/download recorded
- Retention: Configurable per plan, audit logs preserved

## 5. User Roles & Permissions

### 5.1 Role Hierarchy

```
super_admin (5)     - Full access, owns the company
    ↓
company_admin (4)   - Administrative access, can manage users/settings
    ↓
hr_manager (3)      - HR operations, recruitment, payroll access
    ↓
manager (2)         - Team management, approvals, reports
    ↓
employee (1)        - Self-service access only
```

### 5.2 Permission Matrix

| Module | read | create | update | delete | approve | process | verify | export | manage |
|--------|------|--------|--------|--------|---------|---------|--------|--------|--------|
| dashboard | ✓ All | - | - | - | - | - | - | - | - |
| employees | ✓ All | HR+ | HR+ | Admin+ | - | - | - | HR+ | Admin+ |
| departments | ✓ All | Admin+ | Admin+ | Admin+ | - | - | - | - | Admin+ |
| leave | ✓ Self+Manager | ✓ Self | ✓ Self | ✓ Self | Manager+ | - | - | HR+ | HR+ |
| time_tracking | ✓ Self+Manager | ✓ Self | HR+ | HR+ | Manager+ | - | - | HR+ | HR+ |
| documents | ✓ Self+Manager+HR | ✓ Self+HR | HR+ | HR+ | - | - | HR+ | HR+ | Admin+ |
| recruitment | HR+ | HR+ | HR+ | HR+ | HR+ | - | - | HR+ | Admin+ |
| performance | ✓ Self+Manager | Manager+ | Manager+ | Admin+ | - | - | - | HR+ | Admin+ |
| payroll | HR+ | HR+ | HR+ | Admin+ | Admin+ | Admin+ | - | Admin+ | Admin+ |
| expenses | ✓ Self+Manager | ✓ Self | ✓ Self | ✓ Self | Manager+ | - | - | HR+ | HR+ |
| compliance | Admin+ | Admin+ | Admin+ | - | - | - | - | Admin+ | Admin+ |
| audit | Admin+ | - | - | - | - | - | - | Admin+ | Admin+ |
| integrations | Admin+ | Admin+ | Admin+ | Admin+ | - | - | - | - | Admin+ |
| settings | Admin+ | Admin+ | Admin+ | Admin+ | - | - | - | - | Admin+ |
| users | Admin+ | Admin+ | Admin+ | Admin+ | - | - | - | - | Admin+ |

### 5.3 Platform Admin Roles

| Role | Description | Capabilities |
|------|-------------|--------------|
| owner | Platform owner | Full platform access, manage other admins |
| admin | Platform admin | Manage companies, plans, impersonate |
| support | Support agent | View companies, limited impersonation |

---

## 6. Feature Modules

### 6.1 Module Configuration

```typescript
type ModuleId = 
  | 'dashboard'
  | 'employees'
  | 'directory'
  | 'departments'
  | 'leave'
  | 'time_tracking'
  | 'documents'
  | 'recruitment'
  | 'performance'
  | 'payroll'
  | 'compliance'
  | 'audit'
  | 'integrations'
  | 'expenses';
```

### 6.2 Plan-Based Module Access

| Plan | Modules Included |
|------|------------------|
| Free | employees, directory |
| Basic | employees, directory, leave, time_tracking |
| Pro | employees, directory, leave, time_tracking, documents, recruitment, performance |
| Enterprise | all |

---

## 7. Workflows

### 7.1 Authentication Flow

```
User enters credentials
    ↓
supabase.auth.signInWithPassword()
    ↓
Auth state change listener triggers
    ↓
Fetch user context (get_user_context RPC)
    ↓
Set current company and role
    ↓
Log security event (login_success)
    ↓
Check for suspicious login (edge function)
    ↓
Redirect to dashboard or original destination
```

### 7.2 Leave Request Workflow

```
TRIGGER: Employee submits leave request
INPUT: leave_type_id, start_date, end_date, reason, documents

PROCESSING:
1. Validate dates (start <= end)
2. Calculate total_days (excluding half days)
3. Check leave balance availability
4. Insert leave_request with status='pending'
5. Send notification to manager (if configured)

STATUS TRANSITIONS:
pending → approved (by manager/HR)
pending → rejected (by manager/HR with notes)
pending → canceled (by employee before review)
approved → canceled (with approval)

OUTPUT: Leave request record, updated balance (pending_days)
```

### 7.3 Payroll Processing Workflow

```
TRIGGER: HR creates payroll run for period

PROCESSING:
1. Create payroll_run with status='draft'
2. For each active employee:
   a. Get base salary from employee record
   b. Fetch time entries for period
   c. Calculate attendance summary (present, absent, late)
   d. Calculate overtime from time entries
   e. Apply allowances and bonuses
   f. Calculate gross pay
   g. Calculate deductions (tax, PF, benefits)
   h. Calculate net pay
   i. Create payroll_entry record

STATUS TRANSITIONS:
draft → processing (admin starts processing)
processing → completed (all entries processed)
processing → failed (error occurred)

OUTPUT: Payroll run with entries, ready for payslip generation
```

### 7.4 Recruitment Pipeline Workflow

```
STAGES:
applied → screening → interviewing → offered → hired/rejected

SCREENING STAGE:
1. Assign screening test to candidate
2. Generate access token and send email
3. Candidate completes test
4. Evaluator scores and provides notes
5. Move to interviewing or reject

INTERVIEWING STAGE:
1. Schedule interview(s)
2. Add panelists
3. Conduct interview
4. Panelists submit feedback
5. HR reviews aggregate feedback
6. Move to next round, offer, or reject

OFFER STAGE:
1. Create job offer with terms
2. Get internal approvals
3. Send offer to candidate
4. Candidate accepts/declines/negotiates
5. If accepted, convert to employee
```

### 7.5 Company Creation Flow

```
TRIGGER: Platform admin creates company OR user uses creation link

PROCESSING:
1. Validate company name and slug uniqueness
2. Create company record
3. Create company_domain (subdomain)
4. Create or find user (admin email)
5. Create company_users record with role
6. Create company_subscription (with trial or active)
7. Initialize default permissions
8. Send welcome email

OUTPUT: New company ready for use
```

### 7.6 Document Upload Workflow (Hardened)

```
TRIGGER: User uploads a document
INPUT: file, title, description, document_type_id, employee_id, dates

PROCESSING (Edge Function: document-upload):
1. Validate JWT authentication
2. Verify user has documents.create permission
3. Check plan limits (check_document_limits RPC)
4. Validate file:
   - MIME type (PDF, JPEG, PNG, WEBP, DOC, DOCX only)
   - File size (max 50MB)
   - Reject executable content
5. Generate storage path: {company_id}/{employee_id}/{document_id}
6. Create signed upload URL (server-side)
7. Create employee_documents record with status='pending'
8. Log audit event (document_upload_initiated)

CLIENT UPLOAD:
1. Client uploads file to signed URL
2. On success, confirm upload via API

VERSION HANDLING:
- If parentDocumentId provided:
  - Set parent's is_latest_version = false
  - Increment version_number
  - Link via parent_document_id

OUTPUT: documentId, storage path, upload confirmation
```

### 7.7 Document Access Workflow (Audited)

```
TRIGGER: User views or downloads a document
INPUT: documentId, accessType ('view' | 'download')

PROCESSING (Edge Function: document-access):
1. Validate JWT authentication
2. Check can_access_document permission:
   - Own document (employee_id matches)
   - Manager of document owner
   - Has documents.read permission
3. Log access to document_access_logs:
   - accessed_by
   - access_type
   - ip_address_masked
   - user_agent
   - timestamp
4. Update employee_documents:
   - access_count++
   - last_accessed_at
   - last_accessed_by
5. Generate time-limited signed URL:
   - View: 5 minutes
   - Download: 1 minute
6. Log security event (if sensitive document type)

OUTPUT: signedUrl, expiresIn
```

### 7.8 Document Verification Workflow

```
TRIGGER: HR/Admin verifies a document
INPUT: documentId, status, rejectionReason (if rejected)

VERIFICATION STATES:
pending → verified (approved by HR)
pending → rejected (with mandatory reason)
verified → expired (auto-triggered by expiry date)

PROCESSING (RPC: verify_document):
1. Check documents.verify permission
2. Validate status transition:
   - Cannot change verified→pending
   - Rejection requires reason
3. Update employee_documents:
   - verification_status
   - verified_by
   - verified_at
   - rejection_reason (if rejected)
   - is_verified (boolean for backward compat)
4. Log audit event

OUTPUT: Updated document record
```

### 7.9 Document Deletion Workflow (Soft Delete)

```
TRIGGER: User deletes a document
INPUT: documentId

PROCESSING (Edge Function: document-delete):
1. Validate JWT authentication
2. Check documents.delete permission
3. Soft delete in database:
   - deleted_at = now()
   - deleted_by = current employee
4. Delete file from storage bucket
5. Log audit event
6. Note: Access logs preserved for compliance

RETENTION:
- Soft-deleted records visible to admins
- Hard delete after retention period (configurable)
- Storage file removed immediately

OUTPUT: success, deletedAt
```

---

## 8. API & Edge Functions

### 8.1 Edge Functions Inventory

| Function | Auth | Purpose |
|----------|------|---------|
| `create-company` | JWT | Create new company with admin |
| `create-company-admin` | JWT | Create company via admin portal |
| `create-company-link` | JWT | Generate self-service creation link |
| `use-company-link` | No | Consume creation link |
| `invite-user` | JWT | Send user invitation |
| `assign-plan` | JWT | Change company plan |
| `freeze-company` | JWT | Freeze/unfreeze company |
| `check-platform-admin` | No | Verify platform admin status |
| `create-platform-admin` | No | Bootstrap platform admin |
| `send-notification` | No | Send various notifications |
| `send-recruitment-notification` | JWT | Recruitment-specific emails |
| `send-test-email` | No | Test email configuration |
| `check-email-secrets` | No | Verify email provider setup |
| `manage-email-settings` | No | Update company email config |
| `test-company-email` | No | Test company email sending |
| `check-subscription-health` | No | Subscription status checks |
| `send-trial-expiration-emails` | No | Trial reminder emails (cron) |
| `request-trial-extension` | JWT | Request trial extension |
| `request-multi-company` | JWT | Request additional companies |
| `check-subdomain-availability` | No | Validate subdomain uniqueness |
| `check-domain-health` | No | Domain verification status |
| `check-wildcard-health` | No | Wildcard domain status |
| `verify-domain` | No | Verify custom domain ownership |
| `manage-vercel-domain` | No | Manage Vercel domain config |
| `generate-payslip` | JWT | Generate PDF payslip |
| `reactivate-user` | No | Reactivate deactivated user |
| `check-suspicious-login` | No | Detect suspicious login activity |
| `create-employee-user` | No | Create user for employee |
| `document-upload` | JWT | Secure document upload initiation |
| `document-access` | JWT | Logged document view/download |
| `document-delete` | JWT | Soft delete with storage cleanup |

### 8.1.1 Document Edge Functions Detail

**document-upload**
```
Purpose: Secure document upload with server-side validation
Auth: JWT Required

Input:
- companyId: UUID
- employeeId: UUID
- documentTypeId: UUID
- fileName: string
- fileSize: number
- mimeType: string
- title: string
- description?: string
- issueDate?: string
- expiryDate?: string
- parentDocumentId?: UUID (for versioning)

Validations:
1. Permission check: has_permission('documents', 'create')
2. Plan limits: check_document_limits()
3. MIME type: PDF, JPEG, PNG, WEBP, DOC, DOCX only
4. File size: Max 50MB
5. Executable content blocked

Output:
- uploadUrl: Signed upload URL
- uploadToken: Token for upload
- storagePath: Storage path
- documentId: Created document ID

Flow:
1. Validate all inputs
2. Check permissions via RPC
3. Generate signed upload URL from Supabase Storage
4. Create employee_documents record with status 'pending'
5. Log audit event
6. Return upload credentials
```

**document-access**
```
Purpose: Secure document viewing/downloading with audit logging
Auth: JWT Required

Input:
- documentId: UUID
- accessType: 'view' | 'download'

Flow:
1. Validate document exists
2. Check can_access_document permission
3. Log to document_access_logs
4. Update access_count, last_accessed_at
5. Generate time-limited signed URL (1-5 min)
6. Log security event if sensitive

Output:
- signedUrl: Time-limited access URL
- expiresIn: Expiry in seconds
```

**document-delete**
```
Purpose: Soft delete with storage cleanup
Auth: JWT Required

Input:
- documentId: UUID

Flow:
1. Validate document exists
2. Check delete permission
3. Soft delete DB record (deleted_at = now())
4. Delete file from storage bucket
5. Log audit event

Output:
- success: boolean
- deletedAt: timestamp
```

### 8.2 Database Functions (RPC)

| Function | Purpose | Returns |
|----------|---------|---------|
| `get_user_context` | Get complete user context | JSON |
| `set_primary_company` | Switch user's active company | boolean |
| `validate_tenant_access` | Check user access to company | boolean |
| `has_permission` | Check specific permission | boolean |
| `get_user_permissions` | All permissions for user | Table |
| `get_role_permissions` | Permissions for role | Table |
| `set_role_permission` | Grant/revoke role permission | boolean |
| `set_user_permission` | Grant/revoke user permission | boolean |
| `initialize_company_permissions` | Setup default permissions | void |
| `get_trial_info` | Get company trial status | Table |
| `is_trial_expired` | Check if trial expired | boolean |
| `can_write_action` | Check if writes allowed | boolean |
| `company_has_module` | Check module access | boolean |
| `company_can_add_employee` | Check employee limit | boolean |
| `get_company_primary_domain` | Get primary domain URL | Table |
| `get_company_branding_for_domain` | Lookup company by domain | Table |
| `log_audit_event` | Create audit log entry | UUID |
| `log_security_event` | Create security event | UUID |
| `log_billing_event` | Create billing log | UUID |
| `log_application_event` | Create application log | UUID |

---

## 9. Security

### 9.1 Row Level Security (RLS)

All tenant tables have RLS policies ensuring:
- Users can only access data from companies they belong to
- Role-based restrictions on sensitive operations
- Own-record access for employees (leave, time, etc.)

### 9.2 Security Events Tracked

| Event Type | Trigger |
|------------|---------|
| login_success | Successful authentication |
| login_failure | Failed authentication attempt |
| password_change | Password updated |
| mfa_enabled | MFA activated |
| mfa_disabled | MFA deactivated |
| suspicious_activity | Unusual login pattern detected |
| permission_denied | Access denied to resource |
| data_export | Data exported from system |

### 9.3 Audit Trail

All CRUD operations on critical tables are logged to `audit_logs`:
- User who performed action
- Action type (create/update/delete)
- Old and new values
- IP address and user agent
- Timestamp

### 9.4 Impersonation Controls

- Only platform admins can impersonate
- All impersonation sessions logged
- Read-only access during impersonation
- Session automatically ends on logout
- Duration tracked for compliance

---

## 10. Multi-Tenancy

### 10.1 Tenant Isolation

- All tenant data tables have `company_id` foreign key
- RLS policies enforce tenant isolation at database level
- Application layer validates tenant context on all operations
- Cross-tenant data access is impossible

### 10.2 User-Company Relationship

- Users can belong to multiple companies (up to `max_companies`)
- Each user has one primary company (for default login)
- Roles are company-specific (same user can be admin in one, employee in another)
- Company switching via `set_primary_company` RPC

### 10.3 Tenant Context Flow

```typescript
// AuthContext: User authentication
user → is_authenticated, companies[], current_company_id

// TenantContext: Active company state
companyId, role, isFrozen, isTrialing, canWrite, planModules

// PermissionContext: Granular permissions
can(module, action), canAccessModule(module)
```

---

## 11. Subscription & Billing

### 11.1 Subscription States

| Status | Description | Behavior |
|--------|-------------|----------|
| active | Paid subscription | Full access |
| trialing | In trial period | Full access (may have restrictions) |
| trial_expired | Trial ended | Read-only access |
| past_due | Payment failed | Read-only access |
| paused | Manually paused | No access |
| canceled | Subscription ended | No access |

### 11.2 Plan Configuration

```typescript
interface Plan {
  id: string;
  name: string;
  price_monthly: number;
  price_yearly: number;
  max_employees: number | null;
  max_storage_gb: number;
  features: {
    modules: ModuleId[] | 'all';
    support: string;
    sso?: boolean;
    api?: boolean;
    audit?: boolean;
  };
  trial_enabled: boolean;
  trial_default_days: number;
  trial_restrictions: {
    disabled_modules?: string[];
    action_limits?: Record<string, string[]>;
  };
}
```

### 11.3 Trial Management

- Configurable per plan (enable/disable, duration)
- Extension requests via `request-trial-extension`
- Automatic reminder emails at 7, 3, 1 days before expiry
- Grace period handling (trial_expired status)

---

## 12. Email System

### 12.1 Email Providers Supported

| Provider | Configuration Required |
|----------|----------------------|
| Resend | API Key |
| SendGrid | API Key |
| Brevo | API Key |
| Mailersend | API Key |
| AWS SES | Access Key, Secret, Region |
| SMTP | Host, Port, Username, Password |
| Console | (Development only) |

### 12.2 Email Templates

| Template | Trigger | Variables |
|----------|---------|-----------|
| user_invitation | User invited | recipient_name, company_name, invite_link |
| leave_request_submitted | Leave submitted | employee_name, leave_type, dates |
| leave_request_approved | Leave approved | employee_name, leave_type, dates |
| leave_request_rejected | Leave rejected | employee_name, reason |
| payroll_processed | Payroll completed | employee_name, period, net_pay |
| interview_scheduled | Interview booked | candidate_name, date, type |
| offer_sent | Job offer sent | candidate_name, position, salary |
| trial_expiring | Trial reminder | company_name, days_remaining |

### 12.3 Per-Company Email Configuration

Companies can configure their own email provider:
- Stored in `company_email_settings`
- Falls back to platform default if not configured
- Test email functionality before enabling

---

## 13. Frontend Architecture

### 13.1 Route Structure

```
/                       → Root redirect
/auth                   → Login/Register
/setup                  → Initial setup wizard
/onboarding             → Company onboarding

/app                    → Tenant application (AppLayout)
  /dashboard            → Dashboard
  /employees            → Employee management
  /departments          → Department management
  /leave                → Leave management
  /time                 → Time tracking
  /payroll              → Payroll processing
  /expenses             → Expense management
  /recruitment          → Recruitment (jobs, candidates)
  /performance          → Performance reviews
  /documents            → Document management
  /audit                → Audit logs
  /compliance           → Compliance center
  /integrations         → Third-party integrations
  /settings/*           → Company settings
  /profile              → User profile
  /my-*                 → Self-service pages

/platform               → Platform admin (PlatformLayout)
  /dashboard            → Platform overview
  /admins               → Platform admin management
  /companies            → Company management
  /companies/:id        → Company detail
  /users                → All users
  /plans                → Plan management
  /analytics            → Platform analytics
  /webhooks             → Webhook configuration
  /*-logs               → Various log viewers
  /settings             → Platform settings

/careers                → Public job listings
/careers/:slug          → Job detail & application
/screening/:token       → Candidate screening test
```

### 13.2 Key Hooks

| Hook | Purpose |
|------|---------|
| `useAuth` | Authentication state and methods |
| `useTenant` | Current company context |
| `usePermission` | Permission checking |
| `useImpersonation` | Platform admin impersonation |
| `useEmployees` | Employee CRUD operations |
| `useLeave` | Leave request operations |
| `usePayroll` | Payroll operations |
| `useRecruitment` | Recruitment operations |
| `usePerformance` | Performance review operations |
| `useSubscription` | Subscription management |
| `useModuleAccess` | Module availability checks |

### 13.3 Guard Components

| Component | Purpose |
|-----------|---------|
| `ModuleGuard` | Restrict access by module |
| `PermissionGate` | Restrict by permission |
| `WriteGuard` | Block writes when frozen/expired |
| `FrozenGuard` | Show banner when frozen |
| `TrialExpiredGuard` | Handle expired trials |

---

## 14. Rebuild Checklist

### Phase 1: Foundation
- [ ] Setup Supabase project
- [ ] Create base database schema (companies, profiles, company_users)
- [ ] Implement authentication system
- [ ] Setup RLS policies for base tables
- [ ] Create AuthContext and basic routing

### Phase 2: Multi-Tenancy
- [ ] Create TenantContext
- [ ] Implement company switching
- [ ] Setup tenant isolation (RLS)
- [ ] Create ImpersonationContext
- [ ] Build AppLayout and PlatformLayout

### Phase 3: Permission System
- [ ] Create permissions table and seed data
- [ ] Create role_permissions and user_permissions tables
- [ ] Implement permission functions (RPCs)
- [ ] Build PermissionContext
- [ ] Create guard components

### Phase 4: Core HR Modules
- [ ] Employees (CRUD, import, org chart)
- [ ] Departments (hierarchy, managers)
- [ ] Leave (types, requests, balances, approvals)
- [ ] Time Tracking (clock in/out, breaks, attendance)
- [ ] Documents (types, uploads, expiry)

### Phase 5: Advanced Modules
- [ ] Payroll (runs, entries, calculations, payslips)
- [ ] Recruitment (jobs, candidates, interviews, offers)
- [ ] Performance (reviews, ratings, goals)
- [ ] Expenses (categories, claims, approvals)

### Phase 6: Platform Administration
- [ ] Platform admin authentication
- [ ] Company management UI
- [ ] Plan management
- [ ] User management
- [ ] Audit/security logs viewers
- [ ] Webhook configuration

### Phase 7: Subscription & Billing
- [ ] Plans table and configuration
- [ ] Subscription management
- [ ] Trial handling
- [ ] Plan-based module access
- [ ] Freeze/unfreeze functionality

### Phase 8: Communication
- [ ] Email provider abstraction
- [ ] Email templates
- [ ] Company email settings
- [ ] Notification edge functions
- [ ] Email logging

### Phase 9: Security & Compliance
- [ ] Security event logging
- [ ] Audit trail implementation
- [ ] Suspicious login detection
- [ ] MFA support (if needed)
- [ ] Trusted devices

### Phase 10: Domains & Branding
- [ ] Subdomain system
- [ ] Custom domain support
- [ ] Domain verification
- [ ] Company branding

---

## Appendix A: Environment Variables

| Variable | Location | Description |
|----------|----------|-------------|
| SUPABASE_URL | Edge Functions | Supabase project URL |
| SUPABASE_ANON_KEY | Edge Functions | Supabase anon key |
| SUPABASE_SERVICE_ROLE_KEY | Edge Functions | Service role key (privileged) |
| RESEND_API_KEY | Edge Functions | Default email provider key |
| VERCEL_API_TOKEN | Edge Functions | Vercel domain management |

---

## Appendix B: External Dependencies

| Service | Purpose | Configuration |
|---------|---------|---------------|
| Supabase | Backend (DB, Auth, Storage, Functions) | Project ID, Keys |
| Vercel | Hosting, Domain management | API Token, Project ID |
| Resend | Email delivery (default) | API Key |
| Stripe | Payment processing (future) | API Keys |

---

*Document generated for HR SaaS Platform v1.0*
