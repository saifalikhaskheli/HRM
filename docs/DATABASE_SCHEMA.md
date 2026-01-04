# HRM SaaS Platform - Database Schema Design

## Table of Contents
1. [Overview](#overview)
2. [Multi-Tenancy Architecture](#multi-tenancy-architecture)
3. [Core Platform Tables](#core-platform-tables)
4. [Company & Tenant Tables](#company--tenant-tables)
5. [User & Authentication Tables](#user--authentication-tables)
6. [Permission & Role Tables](#permission--role-tables)
7. [Employee Module Tables](#employee-module-tables)
8. [Leave Management Tables](#leave-management-tables)
9. [Attendance & Time Tracking Tables](#attendance--time-tracking-tables)
10. [Payroll Tables](#payroll-tables)
11. [Performance Management Tables](#performance-management-tables)
12. [Learning & Development Tables](#learning--development-tables)
13. [Benefits Administration Tables](#benefits-administration-tables)
14. [Recruitment & ATS Tables](#recruitment--ats-tables)
15. [Integration & Webhook Tables](#integration--webhook-tables)
16. [Supporting Tables](#supporting-tables)
17. [ER Diagram](#er-diagram)
18. [Indexes & Performance](#indexes--performance)
19. [Data Retention Policies](#data-retention-policies)

---

## Overview

### Design Principles

1. **Multi-Tenancy**: Row-Level Security (RLS) ensures complete data isolation
2. **Normalization**: 3NF for data integrity, denormalization only where performance critical
3. **Audit Trail**: All mutations tracked with created_at, updated_at, created_by, updated_by
4. **Soft Deletes**: Important entities use `deleted_at` instead of hard deletion
5. **UUID Primary Keys**: Better for distributed systems, harder to enumerate
6. **Foreign Key Constraints**: Enforce referential integrity
7. **JSON Columns**: Flexible metadata without schema changes
8. **Timestamptz**: Always use timezone-aware timestamps

### Database Technology

**PostgreSQL 15+** with extensions:
- `uuid-ossp`: UUID generation
- `pgcrypto`: Encryption functions
- `pg_trgm`: Text search and similarity
- `timescaledb`: Time-series data (optional, for analytics)

---

## Multi-Tenancy Architecture

### Row-Level Security (RLS) Strategy

Every tenant-specific table includes `company_id` and RLS policies to enforce isolation.

#### Base Table Pattern

```sql
CREATE TABLE <table_name> (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  -- other columns
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id),
  deleted_at TIMESTAMPTZ
);

-- Enable RLS
ALTER TABLE <table_name> ENABLE ROW LEVEL SECURITY;

-- Tenant isolation policy
CREATE POLICY tenant_isolation ON <table_name>
  FOR ALL
  USING (company_id = current_setting('app.current_company_id')::UUID);

-- Platform admin bypass policy
CREATE POLICY platform_admin_bypass ON <table_name>
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM platform_admins
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- Indexes
CREATE INDEX idx_<table_name>_company_id ON <table_name>(company_id);
CREATE INDEX idx_<table_name>_deleted_at ON <table_name>(deleted_at) WHERE deleted_at IS NULL;
```

### Setting Tenant Context

Before executing any query, set the current company:

```sql
-- Set tenant context
SET app.current_company_id = '<company-uuid>';

-- Now all queries are automatically filtered
SELECT * FROM employees; -- Only returns employees for this company
```

---

## Core Platform Tables

### `platform_admins`

Platform-level administrators (Super Admins, Support Staff).

```sql
CREATE TABLE platform_admins (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('super_admin', 'support', 'billing_admin')),
  permissions JSONB DEFAULT '[]'::JSONB, -- Additional custom permissions
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id)
);

CREATE INDEX idx_platform_admins_user_id ON platform_admins(user_id);
CREATE INDEX idx_platform_admins_is_active ON platform_admins(is_active);
```

### `platform_settings`

Global platform configuration.

```sql
CREATE TABLE platform_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  description TEXT,
  is_public BOOLEAN NOT NULL DEFAULT false, -- Can be exposed to frontend
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES users(id)
);

-- Example settings:
-- key='maintenance_mode', value='{"enabled": false, "message": "..."}'
-- key='trial_duration_days', value='30'
-- key='max_users_per_company', value='{"starter": 10, "professional": 50, "enterprise": 1000}'
```

---

## Company & Tenant Tables

### `companies`

The core tenant entity.

```sql
CREATE TABLE companies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE, -- URL-friendly identifier (e.g., 'acme-corp')
  legal_name TEXT,
  industry TEXT,
  company_size TEXT CHECK (company_size IN ('1-10', '11-50', '51-200', '201-500', '501-1000', '1000+')),
  
  -- Branding
  logo_url TEXT,
  primary_color TEXT,
  
  -- Contact
  email TEXT,
  phone TEXT,
  website TEXT,
  
  -- Address
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT,
  state TEXT,
  postal_code TEXT,
  country TEXT,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'trial' CHECK (status IN ('trial', 'active', 'suspended', 'frozen', 'canceled')),
  trial_ends_at TIMESTAMPTZ,
  
  -- Onboarding
  onboarding_completed BOOLEAN NOT NULL DEFAULT false,
  onboarding_step INTEGER DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_companies_slug ON companies(slug);
CREATE INDEX idx_companies_status ON companies(status);
CREATE INDEX idx_companies_deleted_at ON companies(deleted_at) WHERE deleted_at IS NULL;

-- Unique constraint: active companies cannot have duplicate slugs
CREATE UNIQUE INDEX idx_companies_slug_unique ON companies(slug) WHERE deleted_at IS NULL;
```

### `company_settings`

Per-company configuration.

```sql
CREATE TABLE company_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  
  -- Localization
  timezone TEXT NOT NULL DEFAULT 'UTC',
  language TEXT NOT NULL DEFAULT 'en',
  currency TEXT NOT NULL DEFAULT 'USD',
  date_format TEXT NOT NULL DEFAULT 'MM/DD/YYYY',
  time_format TEXT NOT NULL DEFAULT '12h', -- '12h' or '24h'
  
  -- Working Days & Hours
  working_days JSONB NOT NULL DEFAULT '["monday", "tuesday", "wednesday", "thursday", "friday"]'::JSONB,
  work_hours_start TIME NOT NULL DEFAULT '09:00:00',
  work_hours_end TIME NOT NULL DEFAULT '17:00:00',
  
  -- Fiscal Year
  fiscal_year_start_month INTEGER NOT NULL DEFAULT 1 CHECK (fiscal_year_start_month BETWEEN 1 AND 12),
  fiscal_year_start_day INTEGER NOT NULL DEFAULT 1 CHECK (fiscal_year_start_day BETWEEN 1 AND 31),
  
  -- Notifications
  email_notifications_enabled BOOLEAN NOT NULL DEFAULT true,
  slack_notifications_enabled BOOLEAN NOT NULL DEFAULT false,
  
  -- Custom Fields (for extensibility)
  custom_settings JSONB DEFAULT '{}'::JSONB,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_company_settings_company_id ON company_settings(company_id);

-- Enable RLS
ALTER TABLE company_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON company_settings FOR ALL USING (company_id = current_setting('app.current_company_id')::UUID);
```

### `company_locations`

Physical locations/branches of a company.

```sql
CREATE TABLE company_locations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT, -- Short code (e.g., 'HQ', 'NYC', 'SF')
  
  -- Address
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT,
  state TEXT,
  postal_code TEXT,
  country TEXT,
  
  -- Contact
  phone TEXT,
  email TEXT,
  
  -- Location Type
  type TEXT CHECK (type IN ('headquarters', 'branch', 'remote', 'warehouse')),
  
  -- Working Hours (can override company settings)
  working_days JSONB,
  work_hours_start TIME,
  work_hours_end TIME,
  timezone TEXT,
  
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_company_locations_company_id ON company_locations(company_id);
CREATE INDEX idx_company_locations_is_active ON company_locations(is_active);
CREATE INDEX idx_company_locations_deleted_at ON company_locations(deleted_at) WHERE deleted_at IS NULL;

-- Enable RLS
ALTER TABLE company_locations ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON company_locations FOR ALL USING (company_id = current_setting('app.current_company_id')::UUID);
```

### `company_domains`

Custom domain mapping for white-label deployments.

```sql
CREATE TABLE company_domains (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  domain TEXT NOT NULL UNIQUE,
  is_verified BOOLEAN NOT NULL DEFAULT false,
  verification_token TEXT,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  verified_at TIMESTAMPTZ
);

CREATE INDEX idx_company_domains_company_id ON company_domains(company_id);
CREATE INDEX idx_company_domains_domain ON company_domains(domain);
```

---

## User & Authentication Tables

### `users`

Platform-wide user accounts (shared across companies for single sign-on).

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT NOT NULL UNIQUE,
  email_verified BOOLEAN NOT NULL DEFAULT false,
  email_verified_at TIMESTAMPTZ,
  
  -- Authentication
  password_hash TEXT, -- NULL if SSO-only user
  password_changed_at TIMESTAMPTZ,
  
  -- Profile
  first_name TEXT,
  last_name TEXT,
  avatar_url TEXT,
  phone TEXT,
  
  -- Security
  two_factor_enabled BOOLEAN NOT NULL DEFAULT false,
  two_factor_secret TEXT,
  failed_login_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ,
  
  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_login_at TIMESTAMPTZ,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_is_active ON users(is_active);
CREATE INDEX idx_users_deleted_at ON users(deleted_at) WHERE deleted_at IS NULL;

-- Note: This table is NOT tenant-isolated (users can belong to multiple companies)
```

### `refresh_tokens`

Refresh tokens for JWT authentication.

```sql
CREATE TABLE refresh_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE, -- Store bcrypt hash, not plaintext
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  replaced_by UUID REFERENCES refresh_tokens(id), -- Token rotation
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Device info (for security)
  user_agent TEXT,
  ip_address INET
);

CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_token_hash ON refresh_tokens(token_hash);
CREATE INDEX idx_refresh_tokens_expires_at ON refresh_tokens(expires_at);

-- Auto-delete expired tokens (run daily)
-- DELETE FROM refresh_tokens WHERE expires_at < NOW() - INTERVAL '7 days';
```

### `password_reset_tokens`

Tokens for password reset flow.

```sql
CREATE TABLE password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_password_reset_tokens_user_id ON password_reset_tokens(user_id);
CREATE INDEX idx_password_reset_tokens_token_hash ON password_reset_tokens(token_hash);
CREATE INDEX idx_password_reset_tokens_expires_at ON password_reset_tokens(expires_at);
```

---

## Permission & Role Tables

### `company_users`

Mapping of users to companies (many-to-many).

```sql
CREATE TABLE company_users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('invited', 'active', 'inactive')),
  invited_by UUID REFERENCES users(id),
  invited_at TIMESTAMPTZ,
  joined_at TIMESTAMPTZ,
  
  -- User-specific settings per company
  is_default_company BOOLEAN NOT NULL DEFAULT false, -- Primary company for this user
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(company_id, user_id)
);

CREATE INDEX idx_company_users_company_id ON company_users(company_id);
CREATE INDEX idx_company_users_user_id ON company_users(user_id);
CREATE INDEX idx_company_users_status ON company_users(status);

-- Enable RLS
ALTER TABLE company_users ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON company_users FOR ALL USING (company_id = current_setting('app.current_company_id')::UUID);
```

### `roles`

Role definitions (both system-defined and custom).

```sql
CREATE TABLE roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE, -- NULL for system roles
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  
  -- Role Type
  is_system_role BOOLEAN NOT NULL DEFAULT false, -- System roles cannot be deleted
  is_custom BOOLEAN NOT NULL DEFAULT false,
  
  -- Hierarchy
  level INTEGER NOT NULL DEFAULT 0, -- Higher number = more permissions
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(company_id, slug)
);

CREATE INDEX idx_roles_company_id ON roles(company_id);
CREATE INDEX idx_roles_slug ON roles(slug);

-- Enable RLS (system roles have company_id = NULL, accessible to all)
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON roles FOR ALL USING (
  company_id IS NULL OR company_id = current_setting('app.current_company_id')::UUID
);

-- Seed system roles
INSERT INTO roles (id, name, slug, is_system_role, level) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Company Admin', 'company_admin', true, 100),
  ('00000000-0000-0000-0000-000000000002', 'HR Manager', 'hr_manager', true, 80),
  ('00000000-0000-0000-0000-000000000003', 'Finance Manager', 'finance_manager', true, 70),
  ('00000000-0000-0000-0000-000000000004', 'Department Manager', 'department_manager', true, 50),
  ('00000000-0000-0000-0000-000000000005', 'Employee', 'employee', true, 10),
  ('00000000-0000-0000-0000-000000000006', 'Viewer', 'viewer', true, 5);
```

### `permissions`

Permission definitions.

```sql
CREATE TABLE permissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  module TEXT NOT NULL, -- 'employees', 'leave', 'payroll', etc.
  resource TEXT NOT NULL, -- 'employee', 'leave_request', 'payslip'
  action TEXT NOT NULL, -- 'create', 'read', 'update', 'delete', 'approve', 'export'
  slug TEXT NOT NULL UNIQUE, -- 'employees.employee.read'
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_permissions_module ON permissions(module);
CREATE INDEX idx_permissions_slug ON permissions(slug);

-- Seed permissions (examples)
INSERT INTO permissions (module, resource, action, slug, description) VALUES
  -- Employees
  ('employees', 'employee', 'read', 'employees.employee.read', 'View employees'),
  ('employees', 'employee', 'create', 'employees.employee.create', 'Create employees'),
  ('employees', 'employee', 'update', 'employees.employee.update', 'Update employees'),
  ('employees', 'employee', 'delete', 'employees.employee.delete', 'Delete employees'),
  ('employees', 'employee', 'export', 'employees.employee.export', 'Export employee list'),
  ('employees', 'employee', 'read_salary', 'employees.employee.read_salary', 'View salary information'),
  
  -- Leave
  ('leave', 'leave_request', 'read', 'leave.leave_request.read', 'View leave requests'),
  ('leave', 'leave_request', 'create', 'leave.leave_request.create', 'Create leave requests'),
  ('leave', 'leave_request', 'update', 'leave.leave_request.update', 'Update leave requests'),
  ('leave', 'leave_request', 'delete', 'leave.leave_request.delete', 'Delete leave requests'),
  ('leave', 'leave_request', 'approve', 'leave.leave_request.approve', 'Approve leave requests'),
  
  -- Payroll
  ('payroll', 'payroll', 'read', 'payroll.payroll.read', 'View payroll'),
  ('payroll', 'payroll', 'create', 'payroll.payroll.create', 'Create payroll runs'),
  ('payroll', 'payroll', 'process', 'payroll.payroll.process', 'Process payroll'),
  ('payroll', 'payslip', 'read_own', 'payroll.payslip.read_own', 'View own payslips'),
  ('payroll', 'payslip', 'read_all', 'payroll.payslip.read_all', 'View all payslips');
```

### `role_permissions`

Mapping of roles to permissions.

```sql
CREATE TABLE role_permissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(role_id, permission_id)
);

CREATE INDEX idx_role_permissions_role_id ON role_permissions(role_id);
CREATE INDEX idx_role_permissions_permission_id ON role_permissions(permission_id);
```

### `user_roles`

Assign roles to users (within a company).

```sql
CREATE TABLE user_roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  
  -- Scope (optional: limit role to specific department or location)
  department_id UUID REFERENCES departments(id) ON DELETE CASCADE,
  location_id UUID REFERENCES company_locations(id) ON DELETE CASCADE,
  
  assigned_by UUID REFERENCES users(id),
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ, -- Optional: temporary role assignment
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(company_id, user_id, role_id, department_id, location_id)
);

CREATE INDEX idx_user_roles_company_id ON user_roles(company_id);
CREATE INDEX idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX idx_user_roles_role_id ON user_roles(role_id);

-- Enable RLS
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON user_roles FOR ALL USING (company_id = current_setting('app.current_company_id')::UUID);
```

---

## Employee Module Tables

### `departments`

Organizational departments.

```sql
CREATE TABLE departments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT, -- Short code (e.g., 'ENG', 'HR', 'FIN')
  description TEXT,
  
  -- Hierarchy
  parent_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  
  -- Department Head
  head_id UUID REFERENCES employees(id) ON DELETE SET NULL,
  
  -- Location
  location_id UUID REFERENCES company_locations(id) ON DELETE SET NULL,
  
  -- Cost Center (for financial reporting)
  cost_center TEXT,
  
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_departments_company_id ON departments(company_id);
CREATE INDEX idx_departments_parent_id ON departments(parent_id);
CREATE INDEX idx_departments_head_id ON departments(head_id);
CREATE INDEX idx_departments_deleted_at ON departments(deleted_at) WHERE deleted_at IS NULL;

-- Enable RLS
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON departments FOR ALL USING (company_id = current_setting('app.current_company_id')::UUID);
```

### `employees`

Core employee records.

```sql
CREATE TABLE employees (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL, -- Link to user account (optional)
  
  -- Personal Information
  employee_id TEXT, -- Company-specific employee number
  first_name TEXT NOT NULL,
  middle_name TEXT,
  last_name TEXT NOT NULL,
  preferred_name TEXT,
  date_of_birth DATE,
  gender TEXT CHECK (gender IN ('male', 'female', 'non_binary', 'other', 'prefer_not_to_say')),
  marital_status TEXT CHECK (marital_status IN ('single', 'married', 'divorced', 'widowed', 'other')),
  nationality TEXT,
  
  -- Contact Information
  email TEXT NOT NULL,
  personal_email TEXT,
  phone TEXT,
  mobile TEXT,
  
  -- Address
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT,
  state TEXT,
  postal_code TEXT,
  country TEXT,
  
  -- Employment Information
  hire_date DATE NOT NULL,
  employment_type TEXT NOT NULL CHECK (employment_type IN ('full_time', 'part_time', 'contract', 'intern', 'temporary')),
  employment_status TEXT NOT NULL DEFAULT 'active' CHECK (
    employment_status IN ('active', 'probation', 'on_leave', 'suspended', 'terminated', 'resigned')
  ),
  probation_end_date DATE,
  termination_date DATE,
  termination_reason TEXT,
  
  -- Job Details
  job_title TEXT NOT NULL,
  department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  location_id UUID REFERENCES company_locations(id) ON DELETE SET NULL,
  manager_id UUID REFERENCES employees(id) ON DELETE SET NULL,
  
  -- Work Schedule
  work_schedule TEXT DEFAULT 'standard', -- 'standard', 'flexible', 'shift', 'remote'
  weekly_hours DECIMAL(5, 2) DEFAULT 40.00,
  
  -- Compensation (encrypted or stored separately)
  salary_amount DECIMAL(15, 2),
  salary_currency TEXT DEFAULT 'USD',
  salary_frequency TEXT CHECK (salary_frequency IN ('hourly', 'daily', 'weekly', 'bi_weekly', 'monthly', 'annually')),
  
  -- Profile
  avatar_url TEXT,
  bio TEXT,
  
  -- Social Security / Tax IDs (encrypted)
  ssn_encrypted TEXT,
  tax_id_encrypted TEXT,
  
  -- Bank Details (encrypted)
  bank_account_encrypted TEXT, -- Store as JSON: {account_number, routing_number, bank_name}
  
  -- Custom Fields
  custom_fields JSONB DEFAULT '{}'::JSONB,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id),
  deleted_at TIMESTAMPTZ,
  
  UNIQUE(company_id, employee_id),
  UNIQUE(company_id, email)
);

CREATE INDEX idx_employees_company_id ON employees(company_id);
CREATE INDEX idx_employees_user_id ON employees(user_id);
CREATE INDEX idx_employees_department_id ON employees(department_id);
CREATE INDEX idx_employees_location_id ON employees(location_id);
CREATE INDEX idx_employees_manager_id ON employees(manager_id);
CREATE INDEX idx_employees_employment_status ON employees(employment_status);
CREATE INDEX idx_employees_email ON employees(email);
CREATE INDEX idx_employees_deleted_at ON employees(deleted_at) WHERE deleted_at IS NULL;

-- Full-text search index
CREATE INDEX idx_employees_search ON employees USING gin(
  to_tsvector('english', coalesce(first_name, '') || ' ' || coalesce(last_name, '') || ' ' || coalesce(email, ''))
);

-- Enable RLS
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON employees FOR ALL USING (company_id = current_setting('app.current_company_id')::UUID);
```

### `employee_contacts`

Emergency contacts for employees.

```sql
CREATE TABLE employee_contacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  
  -- Contact Information
  name TEXT NOT NULL,
  relationship TEXT, -- 'spouse', 'parent', 'sibling', 'friend', etc.
  phone TEXT NOT NULL,
  email TEXT,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  
  -- Address
  address_line1 TEXT,
  city TEXT,
  country TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_employee_contacts_company_id ON employee_contacts(company_id);
CREATE INDEX idx_employee_contacts_employee_id ON employee_contacts(employee_id);

-- Enable RLS
ALTER TABLE employee_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON employee_contacts FOR ALL USING (company_id = current_setting('app.current_company_id')::UUID);
```

### `employee_documents`

Document vault for employee files.

```sql
CREATE TABLE employee_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  
  -- Document Info
  name TEXT NOT NULL,
  description TEXT,
  document_type TEXT NOT NULL, -- 'id', 'passport', 'license', 'certificate', 'contract', 'other'
  file_url TEXT NOT NULL,
  file_size INTEGER, -- bytes
  mime_type TEXT,
  
  -- Expiry Tracking
  issue_date DATE,
  expiry_date DATE,
  is_expired BOOLEAN GENERATED ALWAYS AS (expiry_date < CURRENT_DATE) STORED,
  
  -- Access Control
  is_confidential BOOLEAN NOT NULL DEFAULT false,
  
  uploaded_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_employee_documents_company_id ON employee_documents(company_id);
CREATE INDEX idx_employee_documents_employee_id ON employee_documents(employee_id);
CREATE INDEX idx_employee_documents_expiry_date ON employee_documents(expiry_date);
CREATE INDEX idx_employee_documents_deleted_at ON employee_documents(deleted_at) WHERE deleted_at IS NULL;

-- Enable RLS
ALTER TABLE employee_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON employee_documents FOR ALL USING (company_id = current_setting('app.current_company_id')::UUID);
```

### `employee_lifecycle_events`

Track employee lifecycle events (transfers, promotions, terminations).

```sql
CREATE TABLE employee_lifecycle_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  
  -- Event Type
  event_type TEXT NOT NULL CHECK (event_type IN (
    'hire', 'promotion', 'transfer', 'department_change', 'location_change',
    'manager_change', 'salary_change', 'termination', 'resignation', 'retirement'
  )),
  
  -- Event Details
  effective_date DATE NOT NULL,
  reason TEXT,
  notes TEXT,
  
  -- Changes (store as JSON for flexibility)
  changes JSONB, -- e.g., {"from": {"title": "Junior Dev"}, "to": {"title": "Senior Dev"}}
  
  -- Old Values (before change)
  previous_job_title TEXT,
  previous_department_id UUID REFERENCES departments(id),
  previous_location_id UUID REFERENCES company_locations(id),
  previous_manager_id UUID REFERENCES employees(id),
  previous_salary_amount DECIMAL(15, 2),
  
  -- New Values (after change)
  new_job_title TEXT,
  new_department_id UUID REFERENCES departments(id),
  new_location_id UUID REFERENCES company_locations(id),
  new_manager_id UUID REFERENCES employees(id),
  new_salary_amount DECIMAL(15, 2),
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id)
);

CREATE INDEX idx_employee_lifecycle_events_company_id ON employee_lifecycle_events(company_id);
CREATE INDEX idx_employee_lifecycle_events_employee_id ON employee_lifecycle_events(employee_id);
CREATE INDEX idx_employee_lifecycle_events_event_type ON employee_lifecycle_events(event_type);
CREATE INDEX idx_employee_lifecycle_events_effective_date ON employee_lifecycle_events(effective_date);

-- Enable RLS
ALTER TABLE employee_lifecycle_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON employee_lifecycle_events FOR ALL USING (company_id = current_setting('app.current_company_id')::UUID);
```

---

## Leave Management Tables

### `leave_types`

Leave type definitions (vacation, sick, etc.).

```sql
CREATE TABLE leave_types (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT, -- Short code (e.g., 'VAC', 'SICK')
  description TEXT,
  
  -- Leave Category
  category TEXT NOT NULL CHECK (category IN ('paid', 'unpaid', 'half_paid')),
  
  -- Accrual
  is_accrued BOOLEAN NOT NULL DEFAULT true,
  accrual_frequency TEXT CHECK (accrual_frequency IN ('monthly', 'quarterly', 'yearly', 'none')),
  accrual_amount DECIMAL(5, 2), -- Days accrued per period
  
  -- Balance
  max_balance DECIMAL(6, 2), -- Maximum days that can be accumulated
  allow_negative_balance BOOLEAN NOT NULL DEFAULT false,
  max_negative_balance DECIMAL(5, 2),
  
  -- Carry Forward
  allow_carry_forward BOOLEAN NOT NULL DEFAULT false,
  max_carry_forward_days DECIMAL(5, 2),
  carry_forward_expiry_months INTEGER, -- Months before carried days expire
  
  -- Requesting
  min_days_per_request DECIMAL(4, 2) DEFAULT 0.5,
  max_days_per_request DECIMAL(5, 2),
  requires_approval BOOLEAN NOT NULL DEFAULT true,
  requires_document BOOLEAN NOT NULL DEFAULT false, -- e.g., medical certificate for sick leave
  
  -- Eligibility
  eligible_after_probation BOOLEAN NOT NULL DEFAULT true,
  eligible_after_days INTEGER DEFAULT 90, -- Days after joining
  
  -- Color (for calendar)
  color TEXT DEFAULT '#3b82f6',
  
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_leave_types_company_id ON leave_types(company_id);
CREATE INDEX idx_leave_types_is_active ON leave_types(is_active);
CREATE INDEX idx_leave_types_deleted_at ON leave_types(deleted_at) WHERE deleted_at IS NULL;

-- Enable RLS
ALTER TABLE leave_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON leave_types FOR ALL USING (company_id = current_setting('app.current_company_id')::UUID);
```

### `employee_leave_balances`

Current leave balances per employee.

```sql
CREATE TABLE employee_leave_balances (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  leave_type_id UUID NOT NULL REFERENCES leave_types(id) ON DELETE CASCADE,
  
  -- Balance
  total_balance DECIMAL(6, 2) NOT NULL DEFAULT 0.00,
  used_balance DECIMAL(6, 2) NOT NULL DEFAULT 0.00,
  pending_balance DECIMAL(6, 2) NOT NULL DEFAULT 0.00, -- Requested but not approved
  available_balance DECIMAL(6, 2) GENERATED ALWAYS AS (total_balance - used_balance - pending_balance) STORED,
  
  -- Carry Forward
  carried_forward_balance DECIMAL(5, 2) DEFAULT 0.00,
  carried_forward_expiry_date DATE,
  
  -- Fiscal Year
  fiscal_year INTEGER NOT NULL,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(company_id, employee_id, leave_type_id, fiscal_year)
);

CREATE INDEX idx_employee_leave_balances_company_id ON employee_leave_balances(company_id);
CREATE INDEX idx_employee_leave_balances_employee_id ON employee_leave_balances(employee_id);
CREATE INDEX idx_employee_leave_balances_leave_type_id ON employee_leave_balances(leave_type_id);

-- Enable RLS
ALTER TABLE employee_leave_balances ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON employee_leave_balances FOR ALL USING (company_id = current_setting('app.current_company_id')::UUID);
```

### `leave_balance_transactions`

Audit trail for leave balance changes.

```sql
CREATE TABLE leave_balance_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  leave_type_id UUID NOT NULL REFERENCES leave_types(id) ON DELETE CASCADE,
  
  -- Transaction
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('accrual', 'deduction', 'adjustment', 'carry_forward', 'expiry')),
  amount DECIMAL(6, 2) NOT NULL, -- Positive for credit, negative for debit
  balance_before DECIMAL(6, 2) NOT NULL,
  balance_after DECIMAL(6, 2) NOT NULL,
  
  -- Reference
  reference_type TEXT, -- 'leave_request', 'manual_adjustment'
  reference_id UUID, -- ID of related leave_request or adjustment
  
  reason TEXT,
  notes TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id)
);

CREATE INDEX idx_leave_balance_transactions_company_id ON leave_balance_transactions(company_id);
CREATE INDEX idx_leave_balance_transactions_employee_id ON leave_balance_transactions(employee_id);
CREATE INDEX idx_leave_balance_transactions_leave_type_id ON leave_balance_transactions(leave_type_id);
CREATE INDEX idx_leave_balance_transactions_created_at ON leave_balance_transactions(created_at);

-- Enable RLS
ALTER TABLE leave_balance_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON leave_balance_transactions FOR ALL USING (company_id = current_setting('app.current_company_id')::UUID);
```

### `leave_requests`

Leave request submissions.

```sql
CREATE TABLE leave_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  leave_type_id UUID NOT NULL REFERENCES leave_types(id) ON DELETE CASCADE,
  
  -- Request Details
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  total_days DECIMAL(4, 2) NOT NULL, -- Can be fractional (0.5 for half day)
  
  -- Day Type
  start_day_type TEXT DEFAULT 'full' CHECK (start_day_type IN ('full', 'first_half', 'second_half')),
  end_day_type TEXT DEFAULT 'full' CHECK (end_day_type IN ('full', 'first_half', 'second_half')),
  
  -- Reason
  reason TEXT NOT NULL,
  notes TEXT,
  
  -- Attachments (e.g., medical certificate)
  attachment_urls JSONB, -- Array of URLs
  
  -- Status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'draft', 'pending', 'approved', 'rejected', 'canceled', 'expired'
  )),
  
  -- Approval
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  rejected_by UUID REFERENCES users(id),
  rejected_at TIMESTAMPTZ,
  rejection_reason TEXT,
  
  canceled_at TIMESTAMPTZ,
  cancellation_reason TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  
  CHECK (end_date >= start_date)
);

CREATE INDEX idx_leave_requests_company_id ON leave_requests(company_id);
CREATE INDEX idx_leave_requests_employee_id ON leave_requests(employee_id);
CREATE INDEX idx_leave_requests_leave_type_id ON leave_requests(leave_type_id);
CREATE INDEX idx_leave_requests_status ON leave_requests(status);
CREATE INDEX idx_leave_requests_start_date ON leave_requests(start_date);
CREATE INDEX idx_leave_requests_end_date ON leave_requests(end_date);

-- Enable RLS
ALTER TABLE leave_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON leave_requests FOR ALL USING (company_id = current_setting('app.current_company_id')::UUID);
```

### `leave_approvals`

Multi-level approval workflow for leave requests.

```sql
CREATE TABLE leave_approvals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  leave_request_id UUID NOT NULL REFERENCES leave_requests(id) ON DELETE CASCADE,
  
  -- Approval Level
  approval_level INTEGER NOT NULL, -- 1 = manager, 2 = HR, 3 = finance, etc.
  approver_id UUID NOT NULL REFERENCES users(id),
  
  -- Status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'skipped')),
  
  -- Response
  approved_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  comments TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_leave_approvals_company_id ON leave_approvals(company_id);
CREATE INDEX idx_leave_approvals_leave_request_id ON leave_approvals(leave_request_id);
CREATE INDEX idx_leave_approvals_approver_id ON leave_approvals(approver_id);
CREATE INDEX idx_leave_approvals_status ON leave_approvals(status);

-- Enable RLS
ALTER TABLE leave_approvals ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON leave_approvals FOR ALL USING (company_id = current_setting('app.current_company_id')::UUID);
```

---

## Attendance & Time Tracking Tables

### `attendance_records`

Daily attendance records.

```sql
CREATE TABLE attendance_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  
  -- Date
  date DATE NOT NULL,
  
  -- Clock In/Out
  clock_in TIMESTAMPTZ,
  clock_in_location JSONB, -- {latitude, longitude, address}
  clock_in_ip INET,
  clock_in_device TEXT,
  
  clock_out TIMESTAMPTZ,
  clock_out_location JSONB,
  clock_out_ip INET,
  clock_out_device TEXT,
  
  -- Calculated Hours
  total_hours DECIMAL(5, 2), -- Auto-calculated from clock_in/clock_out
  regular_hours DECIMAL(5, 2),
  overtime_hours DECIMAL(5, 2),
  
  -- Status
  status TEXT NOT NULL CHECK (status IN (
    'present', 'absent', 'late', 'half_day', 'on_leave', 'holiday', 'weekend', 'work_from_home'
  )),
  
  -- Late/Early Departure
  is_late BOOLEAN DEFAULT false,
  late_by_minutes INTEGER,
  is_early_departure BOOLEAN DEFAULT false,
  early_by_minutes INTEGER,
  
  -- Notes
  notes TEXT,
  
  -- Approval (for corrections)
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(company_id, employee_id, date)
);

CREATE INDEX idx_attendance_records_company_id ON attendance_records(company_id);
CREATE INDEX idx_attendance_records_employee_id ON attendance_records(employee_id);
CREATE INDEX idx_attendance_records_date ON attendance_records(date);
CREATE INDEX idx_attendance_records_status ON attendance_records(status);

-- Enable RLS
ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON attendance_records FOR ALL USING (company_id = current_setting('app.current_company_id')::UUID);
```

### `attendance_corrections`

Correction requests for attendance.

```sql
CREATE TABLE attendance_corrections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  attendance_record_id UUID NOT NULL REFERENCES attendance_records(id) ON DELETE CASCADE,
  
  -- Correction Details
  field_to_correct TEXT NOT NULL, -- 'clock_in', 'clock_out', 'status'
  old_value TEXT,
  new_value TEXT,
  reason TEXT NOT NULL,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  rejected_by UUID REFERENCES users(id),
  rejected_at TIMESTAMPTZ,
  rejection_reason TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id)
);

CREATE INDEX idx_attendance_corrections_company_id ON attendance_corrections(company_id);
CREATE INDEX idx_attendance_corrections_employee_id ON attendance_corrections(employee_id);
CREATE INDEX idx_attendance_corrections_attendance_record_id ON attendance_corrections(attendance_record_id);
CREATE INDEX idx_attendance_corrections_status ON attendance_corrections(status);

-- Enable RLS
ALTER TABLE attendance_corrections ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON attendance_corrections FOR ALL USING (company_id = current_setting('app.current_company_id')::UUID);
```

### `time_entries`

Time tracking for projects/tasks.

```sql
CREATE TABLE time_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  
  -- Time
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ,
  duration_minutes INTEGER, -- Auto-calculated or manual entry
  
  -- Project/Task (optional)
  project_name TEXT,
  task_name TEXT,
  description TEXT,
  
  -- Billable
  is_billable BOOLEAN NOT NULL DEFAULT false,
  billing_rate DECIMAL(10, 2),
  
  -- Status
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'stopped', 'submitted', 'approved')),
  
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_time_entries_company_id ON time_entries(company_id);
CREATE INDEX idx_time_entries_employee_id ON time_entries(employee_id);
CREATE INDEX idx_time_entries_start_time ON time_entries(start_time);
CREATE INDEX idx_time_entries_status ON time_entries(status);

-- Enable RLS
ALTER TABLE time_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON time_entries FOR ALL USING (company_id = current_setting('app.current_company_id')::UUID);
```

---

## Payroll Tables

### `salary_components`

Salary component definitions (basic, HRA, allowances, deductions).

```sql
CREATE TABLE salary_components (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT, -- Short code (e.g., 'BASIC', 'HRA', 'TAX')
  description TEXT,
  
  -- Component Type
  component_type TEXT NOT NULL CHECK (component_type IN ('earning', 'deduction', 'benefit')),
  calculation_type TEXT NOT NULL CHECK (calculation_type IN ('fixed', 'percentage', 'formula')),
  
  -- Calculation
  default_amount DECIMAL(15, 2),
  percentage_of TEXT, -- Reference to another component (e.g., 'BASIC')
  percentage_value DECIMAL(5, 2),
  formula TEXT, -- Custom formula (e.g., '(BASIC * 0.4)')
  
  -- Tax
  is_taxable BOOLEAN NOT NULL DEFAULT true,
  is_statutory BOOLEAN NOT NULL DEFAULT false, -- Required by law (e.g., Social Security)
  
  -- Display
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_salary_components_company_id ON salary_components(company_id);
CREATE INDEX idx_salary_components_component_type ON salary_components(component_type);
CREATE INDEX idx_salary_components_deleted_at ON salary_components(deleted_at) WHERE deleted_at IS NULL;

-- Enable RLS
ALTER TABLE salary_components ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON salary_components FOR ALL USING (company_id = current_setting('app.current_company_id')::UUID);
```

### `employee_compensation`

Employee salary structure.

```sql
CREATE TABLE employee_compensation (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  salary_component_id UUID NOT NULL REFERENCES salary_components(id) ON DELETE CASCADE,
  
  -- Amount
  amount DECIMAL(15, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  
  -- Effective Period
  effective_from DATE NOT NULL,
  effective_to DATE,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id)
);

CREATE INDEX idx_employee_compensation_company_id ON employee_compensation(company_id);
CREATE INDEX idx_employee_compensation_employee_id ON employee_compensation(employee_id);
CREATE INDEX idx_employee_compensation_salary_component_id ON employee_compensation(salary_component_id);
CREATE INDEX idx_employee_compensation_effective_from ON employee_compensation(effective_from);

-- Enable RLS
ALTER TABLE employee_compensation ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON employee_compensation FOR ALL USING (company_id = current_setting('app.current_company_id')::UUID);
```

### `pay_runs`

Payroll processing runs.

```sql
CREATE TABLE pay_runs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  
  -- Pay Period
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  pay_date DATE NOT NULL,
  
  -- Run Details
  name TEXT NOT NULL, -- e.g., 'Payroll - January 2024'
  description TEXT,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft', 'processing', 'pending_approval', 'approved', 'finalized', 'paid', 'failed'
  )),
  
  -- Financials
  total_gross DECIMAL(15, 2),
  total_deductions DECIMAL(15, 2),
  total_net DECIMAL(15, 2),
  total_tax DECIMAL(15, 2),
  total_employees INTEGER,
  
  -- Processing
  processed_at TIMESTAMPTZ,
  processed_by UUID REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES users(id),
  finalized_at TIMESTAMPTZ,
  finalized_by UUID REFERENCES users(id),
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id)
);

CREATE INDEX idx_pay_runs_company_id ON pay_runs(company_id);
CREATE INDEX idx_pay_runs_period_start ON pay_runs(period_start);
CREATE INDEX idx_pay_runs_status ON pay_runs(status);

-- Enable RLS
ALTER TABLE pay_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON pay_runs FOR ALL USING (company_id = current_setting('app.current_company_id')::UUID);
```

### `payslips`

Generated payslips for employees.

```sql
CREATE TABLE payslips (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  pay_run_id UUID NOT NULL REFERENCES pay_runs(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  
  -- Period
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  pay_date DATE NOT NULL,
  
  -- Financial Summary
  gross_pay DECIMAL(15, 2) NOT NULL,
  total_deductions DECIMAL(15, 2) NOT NULL,
  net_pay DECIMAL(15, 2) NOT NULL,
  
  -- Attendance-based
  days_worked DECIMAL(4, 1),
  days_absent DECIMAL(4, 1),
  days_on_leave DECIMAL(4, 1),
  overtime_hours DECIMAL(5, 2),
  
  -- Line Items (earnings and deductions)
  line_items JSONB NOT NULL, -- Array of {component_id, component_name, amount, type}
  
  -- Generated PDF
  pdf_url TEXT,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'generated', 'sent', 'viewed')),
  sent_at TIMESTAMPTZ,
  viewed_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_payslips_company_id ON payslips(company_id);
CREATE INDEX idx_payslips_pay_run_id ON payslips(pay_run_id);
CREATE INDEX idx_payslips_employee_id ON payslips(employee_id);
CREATE INDEX idx_payslips_period_start ON payslips(period_start);
CREATE INDEX idx_payslips_status ON payslips(status);

-- Enable RLS
ALTER TABLE payslips ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON payslips FOR ALL USING (company_id = current_setting('app.current_company_id')::UUID);

-- Additional policy: Employees can only view their own payslips
CREATE POLICY employee_own_payslips ON payslips FOR SELECT USING (
  employee_id = (SELECT id FROM employees WHERE user_id = auth.uid())
);
```

---

## Performance Management Tables

### `review_cycles`

Performance review periods.

```sql
CREATE TABLE review_cycles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  
  -- Period
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  
  -- Review Type
  review_type TEXT NOT NULL CHECK (review_type IN ('annual', 'semi_annual', 'quarterly', 'probation', 'project_based')),
  
  -- Settings
  enable_self_review BOOLEAN NOT NULL DEFAULT true,
  enable_manager_review BOOLEAN NOT NULL DEFAULT true,
  enable_peer_review BOOLEAN NOT NULL DEFAULT false,
  number_of_peers INTEGER DEFAULT 0,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'completed', 'canceled')),
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id)
);

CREATE INDEX idx_review_cycles_company_id ON review_cycles(company_id);
CREATE INDEX idx_review_cycles_status ON review_cycles(status);

-- Enable RLS
ALTER TABLE review_cycles ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON review_cycles FOR ALL USING (company_id = current_setting('app.current_company_id')::UUID);
```

### `performance_reviews`

Individual performance review instances.

```sql
CREATE TABLE performance_reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  review_cycle_id UUID NOT NULL REFERENCES review_cycles(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  reviewer_id UUID REFERENCES employees(id), -- Manager or peer
  
  -- Review Type
  review_type TEXT NOT NULL CHECK (review_type IN ('self', 'manager', 'peer', '360')),
  
  -- Status
  status TEXT NOT NULL DEFAULT 'not_started' CHECK (status IN (
    'not_started', 'in_progress', 'submitted', 'completed'
  )),
  
  -- Ratings
  overall_rating DECIMAL(3, 1), -- e.g., 4.5 out of 5
  rating_scale INTEGER DEFAULT 5, -- 5-point, 10-point scale
  
  -- Responses (Q&A format)
  responses JSONB, -- Array of {question_id, question, answer}
  
  -- Competencies
  competency_ratings JSONB, -- Array of {competency_id, rating, comments}
  
  -- Comments
  strengths TEXT,
  areas_for_improvement TEXT,
  additional_comments TEXT,
  
  -- Dates
  submitted_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_performance_reviews_company_id ON performance_reviews(company_id);
CREATE INDEX idx_performance_reviews_review_cycle_id ON performance_reviews(review_cycle_id);
CREATE INDEX idx_performance_reviews_employee_id ON performance_reviews(employee_id);
CREATE INDEX idx_performance_reviews_reviewer_id ON performance_reviews(reviewer_id);
CREATE INDEX idx_performance_reviews_status ON performance_reviews(status);

-- Enable RLS
ALTER TABLE performance_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON performance_reviews FOR ALL USING (company_id = current_setting('app.current_company_id')::UUID);
```

### `goals`

Employee goals and objectives.

```sql
CREATE TABLE goals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  
  -- Goal Details
  title TEXT NOT NULL,
  description TEXT,
  
  -- Goal Type
  goal_type TEXT NOT NULL CHECK (goal_type IN ('individual', 'team', 'company', 'development')),
  category TEXT, -- 'sales', 'productivity', 'learning', 'project'
  
  -- SMART Goal
  is_specific BOOLEAN DEFAULT false,
  is_measurable BOOLEAN DEFAULT false,
  is_achievable BOOLEAN DEFAULT false,
  is_relevant BOOLEAN DEFAULT false,
  is_time_bound BOOLEAN DEFAULT false,
  
  -- Metrics
  target_value DECIMAL(15, 2),
  current_value DECIMAL(15, 2),
  unit TEXT, -- 'dollars', 'units', 'hours', 'percent'
  
  -- Timeline
  start_date DATE NOT NULL,
  due_date DATE NOT NULL,
  
  -- Progress
  progress_percentage INTEGER DEFAULT 0 CHECK (progress_percentage BETWEEN 0 AND 100),
  status TEXT NOT NULL DEFAULT 'not_started' CHECK (status IN (
    'not_started', 'on_track', 'at_risk', 'blocked', 'completed', 'canceled'
  )),
  
  -- Alignment
  parent_goal_id UUID REFERENCES goals(id) ON DELETE SET NULL,
  aligned_to TEXT, -- 'company_goal_id' or 'department_goal_id'
  
  -- Review
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  completion_notes TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id)
);

CREATE INDEX idx_goals_company_id ON goals(company_id);
CREATE INDEX idx_goals_employee_id ON goals(employee_id);
CREATE INDEX idx_goals_status ON goals(status);
CREATE INDEX idx_goals_due_date ON goals(due_date);

-- Enable RLS
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON goals FOR ALL USING (company_id = current_setting('app.current_company_id')::UUID);
```

---

## Learning & Development Tables

### `courses`

Learning course catalog.

```sql
CREATE TABLE courses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE, -- NULL for platform-wide courses
  
  -- Course Details
  title TEXT NOT NULL,
  description TEXT,
  category TEXT, -- 'technical', 'soft_skills', 'compliance', 'leadership'
  level TEXT CHECK (level IN ('beginner', 'intermediate', 'advanced')),
  
  -- Content
  content_type TEXT CHECK (content_type IN ('video', 'document', 'scorm', 'external_link', 'in_person')),
  content_url TEXT,
  duration_minutes INTEGER,
  
  -- External Course
  is_external BOOLEAN NOT NULL DEFAULT false,
  external_provider TEXT, -- 'Udemy', 'Coursera', 'LinkedIn Learning'
  external_url TEXT,
  
  -- Requirements
  prerequisites JSONB, -- Array of prerequisite course IDs
  
  -- Assessment
  has_quiz BOOLEAN NOT NULL DEFAULT false,
  passing_score INTEGER, -- Minimum score to pass (0-100)
  
  -- Certificate
  issues_certificate BOOLEAN NOT NULL DEFAULT false,
  certificate_template_url TEXT,
  
  -- Compliance
  is_mandatory BOOLEAN NOT NULL DEFAULT false,
  renewal_period_days INTEGER, -- Re-take course every X days
  
  -- Visibility
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_published BOOLEAN NOT NULL DEFAULT true,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_courses_company_id ON courses(company_id);
CREATE INDEX idx_courses_category ON courses(category);
CREATE INDEX idx_courses_is_active ON courses(is_active);
CREATE INDEX idx_courses_deleted_at ON courses(deleted_at) WHERE deleted_at IS NULL;

-- Enable RLS
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON courses FOR ALL USING (
  company_id IS NULL OR company_id = current_setting('app.current_company_id')::UUID
);
```

### `course_enrollments`

Employee course enrollments.

```sql
CREATE TABLE course_enrollments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  
  -- Enrollment
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  enrolled_by UUID REFERENCES users(id),
  is_mandatory BOOLEAN NOT NULL DEFAULT false,
  due_date DATE,
  
  -- Progress
  status TEXT NOT NULL DEFAULT 'not_started' CHECK (status IN (
    'not_started', 'in_progress', 'completed', 'failed', 'expired'
  )),
  progress_percentage INTEGER DEFAULT 0 CHECK (progress_percentage BETWEEN 0 AND 100),
  
  -- Completion
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  time_spent_minutes INTEGER DEFAULT 0,
  
  -- Assessment
  quiz_score INTEGER, -- 0-100
  passed BOOLEAN,
  attempts_count INTEGER DEFAULT 0,
  
  -- Certificate
  certificate_issued BOOLEAN NOT NULL DEFAULT false,
  certificate_url TEXT,
  certificate_issued_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(company_id, employee_id, course_id)
);

CREATE INDEX idx_course_enrollments_company_id ON course_enrollments(company_id);
CREATE INDEX idx_course_enrollments_employee_id ON course_enrollments(employee_id);
CREATE INDEX idx_course_enrollments_course_id ON course_enrollments(course_id);
CREATE INDEX idx_course_enrollments_status ON course_enrollments(status);

-- Enable RLS
ALTER TABLE course_enrollments ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON course_enrollments FOR ALL USING (company_id = current_setting('app.current_company_id')::UUID);
```

---

## Benefits Administration Tables

### `benefit_plans`

Benefit plan definitions.

```sql
CREATE TABLE benefit_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  
  -- Plan Details
  name TEXT NOT NULL,
  description TEXT,
  plan_type TEXT NOT NULL CHECK (plan_type IN (
    'health_insurance', 'dental_insurance', 'vision_insurance', 'life_insurance',
    'retirement_401k', 'hsa', 'fsa', 'wellness', 'other'
  )),
  
  -- Provider
  provider_name TEXT,
  provider_contact TEXT,
  policy_number TEXT,
  
  -- Coverage
  coverage_level JSONB, -- {employee: amount, spouse: amount, family: amount}
  
  -- Cost
  employer_contribution DECIMAL(10, 2),
  employee_contribution DECIMAL(10, 2),
  contribution_type TEXT CHECK (contribution_type IN ('fixed', 'percentage', 'tiered')),
  
  -- Eligibility
  eligibility_rules JSONB, -- {employment_type: ['full_time'], min_tenure_days: 90}
  waiting_period_days INTEGER DEFAULT 0,
  
  -- Enrollment
  enrollment_type TEXT CHECK (enrollment_type IN ('open_enrollment', 'new_hire', 'life_event', 'anytime')),
  open_enrollment_start DATE,
  open_enrollment_end DATE,
  
  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,
  effective_date DATE NOT NULL,
  termination_date DATE,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_benefit_plans_company_id ON benefit_plans(company_id);
CREATE INDEX idx_benefit_plans_plan_type ON benefit_plans(plan_type);
CREATE INDEX idx_benefit_plans_is_active ON benefit_plans(is_active);
CREATE INDEX idx_benefit_plans_deleted_at ON benefit_plans(deleted_at) WHERE deleted_at IS NULL;

-- Enable RLS
ALTER TABLE benefit_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON benefit_plans FOR ALL USING (company_id = current_setting('app.current_company_id')::UUID);
```

### `benefit_enrollments`

Employee benefit enrollments.

```sql
CREATE TABLE benefit_enrollments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  benefit_plan_id UUID NOT NULL REFERENCES benefit_plans(id) ON DELETE CASCADE,
  
  -- Enrollment Details
  coverage_level TEXT NOT NULL, -- 'employee_only', 'employee_spouse', 'employee_children', 'family'
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  enrollment_reason TEXT, -- 'new_hire', 'open_enrollment', 'life_event'
  
  -- Coverage Period
  coverage_start_date DATE NOT NULL,
  coverage_end_date DATE,
  
  -- Cost
  employee_contribution DECIMAL(10, 2) NOT NULL,
  employer_contribution DECIMAL(10, 2) NOT NULL,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('pending', 'active', 'canceled', 'expired')),
  
  -- Dependents
  dependents JSONB, -- Array of {name, relationship, dob}
  
  -- Cancellation
  canceled_at TIMESTAMPTZ,
  cancellation_reason TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id)
);

CREATE INDEX idx_benefit_enrollments_company_id ON benefit_enrollments(company_id);
CREATE INDEX idx_benefit_enrollments_employee_id ON benefit_enrollments(employee_id);
CREATE INDEX idx_benefit_enrollments_benefit_plan_id ON benefit_enrollments(benefit_plan_id);
CREATE INDEX idx_benefit_enrollments_status ON benefit_enrollments(status);

-- Enable RLS
ALTER TABLE benefit_enrollments ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON benefit_enrollments FOR ALL USING (company_id = current_setting('app.current_company_id')::UUID);
```

---

## Recruitment & ATS Tables

### `job_requisitions`

Job opening requisitions.

```sql
CREATE TABLE job_requisitions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  
  -- Job Details
  job_title TEXT NOT NULL,
  department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  location_id UUID REFERENCES company_locations(id) ON DELETE SET NULL,
  employment_type TEXT NOT NULL CHECK (employment_type IN ('full_time', 'part_time', 'contract', 'intern', 'temporary')),
  
  -- Openings
  number_of_openings INTEGER NOT NULL DEFAULT 1,
  
  -- Job Description
  description TEXT NOT NULL,
  responsibilities TEXT[],
  requirements TEXT[],
  qualifications TEXT[],
  
  -- Compensation
  salary_min DECIMAL(15, 2),
  salary_max DECIMAL(15, 2),
  salary_currency TEXT DEFAULT 'USD',
  
  -- Hiring Manager
  hiring_manager_id UUID REFERENCES employees(id) ON DELETE SET NULL,
  recruiter_id UUID REFERENCES employees(id) ON DELETE SET NULL,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending_approval', 'approved', 'open', 'on_hold', 'closed', 'canceled')),
  
  -- Approval
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  
  -- Posting
  posted_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_job_requisitions_company_id ON job_requisitions(company_id);
CREATE INDEX idx_job_requisitions_department_id ON job_requisitions(department_id);
CREATE INDEX idx_job_requisitions_status ON job_requisitions(status);
CREATE INDEX idx_job_requisitions_deleted_at ON job_requisitions(deleted_at) WHERE deleted_at IS NULL;

-- Enable RLS
ALTER TABLE job_requisitions ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON job_requisitions FOR ALL USING (company_id = current_setting('app.current_company_id')::UUID);
```

### `candidates`

Job applicants.

```sql
CREATE TABLE candidates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  
  -- Personal Info
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  
  -- Location
  city TEXT,
  state TEXT,
  country TEXT,
  
  -- Professional Info
  current_job_title TEXT,
  current_company TEXT,
  years_of_experience DECIMAL(4, 1),
  education_level TEXT,
  
  -- Resume
  resume_url TEXT,
  resume_parsed_data JSONB, -- Extracted data from resume (via OCR/parsing)
  
  -- LinkedIn
  linkedin_url TEXT,
  
  -- Source
  source TEXT, -- 'job_board', 'referral', 'career_site', 'linkedin', 'agency', 'other'
  referred_by UUID REFERENCES employees(id),
  
  -- Tags
  tags TEXT[],
  
  -- Overall Rating
  overall_rating DECIMAL(3, 1), -- Average rating from all interviews
  
  -- Status
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'active', 'hired', 'rejected', 'withdrawn')),
  
  -- Notes
  notes TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  
  UNIQUE(company_id, email)
);

CREATE INDEX idx_candidates_company_id ON candidates(company_id);
CREATE INDEX idx_candidates_email ON candidates(email);
CREATE INDEX idx_candidates_status ON candidates(status);
CREATE INDEX idx_candidates_deleted_at ON candidates(deleted_at) WHERE deleted_at IS NULL;

-- Full-text search
CREATE INDEX idx_candidates_search ON candidates USING gin(
  to_tsvector('english', coalesce(first_name, '') || ' ' || coalesce(last_name, '') || ' ' || coalesce(email, ''))
);

-- Enable RLS
ALTER TABLE candidates ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON candidates FOR ALL USING (company_id = current_setting('app.current_company_id')::UUID);
```

### `applications`

Job applications (candidate-to-job mapping).

```sql
CREATE TABLE applications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  job_requisition_id UUID NOT NULL REFERENCES job_requisitions(id) ON DELETE CASCADE,
  
  -- Application
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  cover_letter TEXT,
  application_answers JSONB, -- Answers to application questions
  
  -- Pipeline Stage
  current_stage TEXT NOT NULL DEFAULT 'applied',
  
  -- Status
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'hired', 'rejected', 'withdrawn')),
  
  -- Rejection
  rejected_at TIMESTAMPTZ,
  rejected_by UUID REFERENCES users(id),
  rejection_reason TEXT,
  
  -- Hire
  hired_at TIMESTAMPTZ,
  hired_by UUID REFERENCES users(id),
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(company_id, candidate_id, job_requisition_id)
);

CREATE INDEX idx_applications_company_id ON applications(company_id);
CREATE INDEX idx_applications_candidate_id ON applications(candidate_id);
CREATE INDEX idx_applications_job_requisition_id ON applications(job_requisition_id);
CREATE INDEX idx_applications_status ON applications(status);
CREATE INDEX idx_applications_current_stage ON applications(current_stage);

-- Enable RLS
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON applications FOR ALL USING (company_id = current_setting('app.current_company_id')::UUID);
```

### `interviews`

Interview scheduling and feedback.

```sql
CREATE TABLE interviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  
  -- Interview Details
  interview_type TEXT NOT NULL CHECK (interview_type IN ('phone_screen', 'video', 'in_person', 'technical', 'panel', 'final')),
  scheduled_at TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER DEFAULT 60,
  
  -- Location
  location TEXT, -- Physical address or video meeting URL
  meeting_link TEXT,
  
  -- Interviewers
  interviewer_ids UUID[], -- Array of employee IDs
  
  -- Status
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'canceled', 'no_show')),
  
  -- Feedback
  feedback JSONB, -- Array of {interviewer_id, rating, comments, recommendation}
  overall_rating DECIMAL(3, 1),
  recommendation TEXT CHECK (recommendation IN ('strong_yes', 'yes', 'maybe', 'no', 'strong_no')),
  
  -- Notes
  notes TEXT,
  
  -- Completion
  completed_at TIMESTAMPTZ,
  canceled_at TIMESTAMPTZ,
  cancellation_reason TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id)
);

CREATE INDEX idx_interviews_company_id ON interviews(company_id);
CREATE INDEX idx_interviews_application_id ON interviews(application_id);
CREATE INDEX idx_interviews_scheduled_at ON interviews(scheduled_at);
CREATE INDEX idx_interviews_status ON interviews(status);

-- Enable RLS
ALTER TABLE interviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON interviews FOR ALL USING (company_id = current_setting('app.current_company_id')::UUID);
```

---

## Integration & Webhook Tables

### `integrations`

Enabled integrations per company.

```sql
CREATE TABLE integrations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  
  -- Integration Details
  integration_type TEXT NOT NULL, -- 'slack', 'google_workspace', 'quickbooks', 'adp', 'okta', etc.
  name TEXT NOT NULL,
  description TEXT,
  
  -- Configuration
  config JSONB, -- Integration-specific configuration
  
  -- Credentials (encrypted)
  credentials_encrypted TEXT, -- API keys, OAuth tokens
  
  -- Status
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'error', 'disabled')),
  last_sync_at TIMESTAMPTZ,
  last_error TEXT,
  
  -- OAuth (if applicable)
  oauth_access_token_encrypted TEXT,
  oauth_refresh_token_encrypted TEXT,
  oauth_expires_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  
  UNIQUE(company_id, integration_type)
);

CREATE INDEX idx_integrations_company_id ON integrations(company_id);
CREATE INDEX idx_integrations_integration_type ON integrations(integration_type);
CREATE INDEX idx_integrations_is_enabled ON integrations(is_enabled);

-- Enable RLS
ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON integrations FOR ALL USING (company_id = current_setting('app.current_company_id')::UUID);
```

### `webhooks`

Webhook subscriptions.

```sql
CREATE TABLE webhooks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  
  -- Webhook Details
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  secret TEXT NOT NULL, -- For signature verification
  
  -- Events
  subscribed_events TEXT[] NOT NULL, -- ['employee.created', 'leave.approved', etc.]
  
  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,
  
  -- Delivery Settings
  max_retries INTEGER DEFAULT 3,
  retry_delay_seconds INTEGER DEFAULT 60,
  
  -- Statistics
  total_deliveries INTEGER DEFAULT 0,
  successful_deliveries INTEGER DEFAULT 0,
  failed_deliveries INTEGER DEFAULT 0,
  last_delivery_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id)
);

CREATE INDEX idx_webhooks_company_id ON webhooks(company_id);
CREATE INDEX idx_webhooks_is_active ON webhooks(is_active);

-- Enable RLS
ALTER TABLE webhooks ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON webhooks FOR ALL USING (company_id = current_setting('app.current_company_id')::UUID);
```

### `webhook_deliveries`

Webhook delivery logs.

```sql
CREATE TABLE webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  webhook_id UUID NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
  
  -- Event
  event_type TEXT NOT NULL,
  event_data JSONB NOT NULL,
  
  -- Delivery
  status TEXT NOT NULL CHECK (status IN ('pending', 'success', 'failed', 'retrying')),
  attempt_count INTEGER NOT NULL DEFAULT 0,
  
  -- Response
  response_status_code INTEGER,
  response_body TEXT,
  response_headers JSONB,
  
  -- Timing
  delivered_at TIMESTAMPTZ,
  next_retry_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_webhook_deliveries_company_id ON webhook_deliveries(company_id);
CREATE INDEX idx_webhook_deliveries_webhook_id ON webhook_deliveries(webhook_id);
CREATE INDEX idx_webhook_deliveries_status ON webhook_deliveries(status);
CREATE INDEX idx_webhook_deliveries_created_at ON webhook_deliveries(created_at);

-- Enable RLS
ALTER TABLE webhook_deliveries ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON webhook_deliveries FOR ALL USING (company_id = current_setting('app.current_company_id')::UUID);

-- Auto-delete old deliveries (keep 90 days)
-- DELETE FROM webhook_deliveries WHERE created_at < NOW() - INTERVAL '90 days';
```

### `api_keys`

API keys for third-party access.

```sql
CREATE TABLE api_keys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  
  -- Key Details
  name TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE, -- Store bcrypt hash, not plaintext
  key_prefix TEXT NOT NULL, -- First 8 chars for identification (e.g., 'pk_live_...')
  
  -- Permissions
  scopes TEXT[] NOT NULL, -- ['employees:read', 'leave:write', etc.]
  
  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,
  expires_at TIMESTAMPTZ,
  
  -- Usage
  last_used_at TIMESTAMPTZ,
  usage_count INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  revoked_at TIMESTAMPTZ,
  revoked_by UUID REFERENCES users(id)
);

CREATE INDEX idx_api_keys_company_id ON api_keys(company_id);
CREATE INDEX idx_api_keys_key_hash ON api_keys(key_hash);
CREATE INDEX idx_api_keys_is_active ON api_keys(is_active);

-- Enable RLS
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON api_keys FOR ALL USING (company_id = current_setting('app.current_company_id')::UUID);
```

---

## Supporting Tables

### `audit_logs`

Comprehensive audit trail.

```sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE, -- NULL for platform-level actions
  
  -- Actor
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  user_email TEXT,
  user_name TEXT,
  
  -- Action
  action TEXT NOT NULL, -- 'employee.created', 'leave.approved', 'payroll.processed'
  resource_type TEXT NOT NULL, -- 'employee', 'leave_request', 'payslip'
  resource_id UUID,
  
  -- Changes
  old_values JSONB,
  new_values JSONB,
  
  -- Request Context
  ip_address INET,
  user_agent TEXT,
  request_id TEXT,
  
  -- Result
  status TEXT CHECK (status IN ('success', 'failure')),
  error_message TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_company_id ON audit_logs(company_id);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_resource_type ON audit_logs(resource_type);
CREATE INDEX idx_audit_logs_resource_id ON audit_logs(resource_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);

-- Partition by month for performance (optional, for large-scale deployments)
-- CREATE TABLE audit_logs_2024_01 PARTITION OF audit_logs FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');

-- Enable RLS
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON audit_logs FOR ALL USING (
  company_id IS NULL OR company_id = current_setting('app.current_company_id')::UUID
);
```

### `notifications`

In-app notifications.

```sql
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE, -- NULL for platform-wide notifications
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Notification Details
  type TEXT NOT NULL, -- 'leave_approved', 'payslip_ready', 'document_expiring', etc.
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  
  -- Action (optional)
  action_url TEXT,
  action_label TEXT,
  
  -- Related Resource
  resource_type TEXT,
  resource_id UUID,
  
  -- Status
  is_read BOOLEAN NOT NULL DEFAULT false,
  read_at TIMESTAMPTZ,
  
  -- Delivery
  sent_via TEXT[] DEFAULT ARRAY['in_app'], -- 'in_app', 'email', 'push'
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

CREATE INDEX idx_notifications_company_id ON notifications(company_id);
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_is_read ON notifications(is_read);
CREATE INDEX idx_notifications_created_at ON notifications(created_at);

-- Enable RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY user_own_notifications ON notifications FOR ALL USING (user_id = auth.uid());
```

### `subscription_plans`

Subscription plan definitions.

```sql
CREATE TABLE subscription_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  
  -- Pricing
  price_monthly DECIMAL(10, 2) NOT NULL,
  price_yearly DECIMAL(10, 2),
  currency TEXT NOT NULL DEFAULT 'USD',
  
  -- Limits
  max_employees INTEGER,
  max_users INTEGER,
  max_locations INTEGER,
  
  -- Features (JSON array of feature slugs)
  features JSONB NOT NULL, -- ['employees', 'leave', 'payroll', 'recruitment']
  
  -- Display
  display_order INTEGER DEFAULT 0,
  is_popular BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed plans
INSERT INTO subscription_plans (name, slug, price_monthly, price_yearly, max_employees, features) VALUES
  ('Starter', 'starter', 29.00, 290.00, 25, '["employees", "leave", "attendance"]'::JSONB),
  ('Professional', 'professional', 99.00, 990.00, 100, '["employees", "leave", "attendance", "payroll", "performance"]'::JSONB),
  ('Enterprise', 'enterprise', 299.00, 2990.00, NULL, '["employees", "leave", "attendance", "payroll", "performance", "recruitment", "benefits", "learning", "integrations"]'::JSONB);
```

### `company_subscriptions`

Company subscription records.

```sql
CREATE TABLE company_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  subscription_plan_id UUID NOT NULL REFERENCES subscription_plans(id) ON DELETE RESTRICT,
  
  -- Billing
  billing_cycle TEXT NOT NULL CHECK (billing_cycle IN ('monthly', 'yearly')),
  amount DECIMAL(10, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  
  -- Period
  current_period_start DATE NOT NULL,
  current_period_end DATE NOT NULL,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('trial', 'active', 'past_due', 'canceled', 'paused')),
  
  -- Trial
  trial_ends_at TIMESTAMPTZ,
  
  -- Payment
  stripe_subscription_id TEXT,
  stripe_customer_id TEXT,
  
  -- Cancellation
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
  canceled_at TIMESTAMPTZ,
  cancellation_reason TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_company_subscriptions_company_id ON company_subscriptions(company_id);
CREATE INDEX idx_company_subscriptions_subscription_plan_id ON company_subscriptions(subscription_plan_id);
CREATE INDEX idx_company_subscriptions_status ON company_subscriptions(status);

-- Enable RLS
ALTER TABLE company_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON company_subscriptions FOR ALL USING (company_id = current_setting('app.current_company_id')::UUID);
```

---

## ER Diagram

```
┌─────────────────┐
│  companies      │──┐
│  (tenants)      │  │
└─────────────────┘  │
         │           │
         │ has many  │
         ▼           │
┌─────────────────┐  │
│ company_users   │  │ All tables below are tenant-isolated
└─────────────────┘  │ (contain company_id + RLS policies)
         │           │
         │           ▼
         ▼     ┌─────────────────────────────────────┐
┌─────────────────┐                                  │
│ users           │                                  │
│ (platform-wide) │                                  │
└─────────────────┘                                  │
                                                     │
┌──────────────────────────────────────────────────┘
│
├─► departments ─────► employees ──┬─► employee_contacts
│                         │         ├─► employee_documents
│                         │         └─► employee_lifecycle_events
│                         │
│                         ├─► leave_requests ─► leave_approvals
│                         ├─► employee_leave_balances ─► leave_balance_transactions
│                         │
│                         ├─► attendance_records ─► attendance_corrections
│                         ├─► time_entries
│                         │
│                         ├─► employee_compensation ─────────┐
│                         ├─► payslips ◄─── pay_runs         │
│                         │                                   ▼
│                         │                          salary_components
│                         │
│                         ├─► performance_reviews ◄─── review_cycles
│                         ├─► goals
│                         │
│                         ├─► course_enrollments ◄─── courses
│                         │
│                         ├─► benefit_enrollments ◄─── benefit_plans
│                         │
│                         └─► applications ◄─── job_requisitions
│                                   │              candidates
│                                   └─► interviews
│
├─► integrations
├─► webhooks ─► webhook_deliveries
├─► api_keys
├─► audit_logs
├─► notifications
└─► company_subscriptions ◄─── subscription_plans
```

---

## Indexes & Performance

### Critical Indexes

Every tenant-isolated table MUST have:
1. `company_id` index (for RLS filtering)
2. Primary key index (auto-created)
3. Foreign key indexes (for joins)

### Additional Indexes

- **Full-text search**: employees, candidates
- **Date range queries**: leave_requests (start_date, end_date), attendance_records (date)
- **Status filtering**: All tables with `status` column
- **Soft deletes**: `deleted_at` (partial index: `WHERE deleted_at IS NULL`)

### Query Optimization

```sql
-- Example: Fetch employees with their departments and managers
EXPLAIN ANALYZE
SELECT 
  e.*, 
  d.name AS department_name,
  m.first_name AS manager_first_name
FROM employees e
LEFT JOIN departments d ON e.department_id = d.id
LEFT JOIN employees m ON e.manager_id = m.id
WHERE e.company_id = '<company-id>'
  AND e.deleted_at IS NULL
ORDER BY e.last_name;

-- Should use: idx_employees_company_id, idx_employees_deleted_at
```

---

## Data Retention Policies

### Audit Logs
- **Retention**: 7 years (for compliance)
- **Archival**: Move to cold storage after 2 years

### Webhook Deliveries
- **Retention**: 90 days
- **Cleanup**: Daily cron job

### Refresh Tokens
- **Retention**: 7 days after expiry
- **Cleanup**: Daily cron job

### Password Reset Tokens
- **Retention**: 1 hour expiry, delete after 24 hours
- **Cleanup**: Hourly cron job

### Notifications
- **Retention**: 90 days
- **Cleanup**: Weekly cron job

---

## Conclusion

This database schema provides:

1. **Complete Multi-Tenancy**: RLS ensures data isolation
2. **Comprehensive HR Coverage**: All major HR modules supported
3. **Audit Trail**: Every action tracked for compliance
4. **Performance**: Proper indexing for fast queries
5. **Flexibility**: JSONB columns for extensibility
6. **Security**: Encrypted sensitive data, RLS policies

The schema is designed to scale to thousands of companies and millions of employee records while maintaining strong data integrity and security.
