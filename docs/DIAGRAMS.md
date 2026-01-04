# HRM SaaS Platform - System Diagrams & Visualizations

## System Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    CLIENT APPLICATIONS                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   ┌──────────────┐  ┌──────────────┐  ┌──────────────┐        │
│   │   Web App    │  │  Mobile App  │  │ Public APIs  │        │
│   │  (React/TS)  │  │(React Native)│  │  (REST/GQL)  │        │
│   └──────────────┘  └──────────────┘  └──────────────┘        │
│                                                                  │
└───────────────────────────┬──────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│              API GATEWAY / LOAD BALANCER                         │
│          (Rate Limiting, WAF, SSL Termination)                   │
└───────────────────────────┬──────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
        ▼                   ▼                   ▼
┌──────────────┐    ┌──────────────┐   ┌──────────────┐
│ Auth Service │    │  Core APIs   │   │Module APIs   │
│  (JWT/2FA)   │    │ (Platform,   │   │ (Employees,  │
│              │    │  Companies,  │   │  Leave,      │
│              │    │  Users)      │   │  Payroll...) │
└──────────────┘    └──────────────┘   └──────────────┘
        │                   │                   │
        └───────────────────┼───────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                       DATA LAYER                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   ┌──────────────┐  ┌──────────────┐  ┌──────────────┐        │
│   │ PostgreSQL   │  │ Redis Cache  │  │   S3/Storage │        │
│   │   (RLS)      │  │  (Sessions)  │  │  (Documents) │        │
│   └──────────────┘  └──────────────┘  └──────────────┘        │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│              BACKGROUND JOBS / WORKERS                           │
│  (Email, Reports, Webhooks, Cron Jobs, Payroll Processing)      │
└─────────────────────────────────────────────────────────────────┘
```

---

## Multi-Tenancy Architecture

### Row-Level Security (RLS) Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. User Login                                                    │
│    ├─ Email: user@company-a.com                                 │
│    └─ Password: **********                                      │
└───────────────────────────┬──────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. Generate JWT with Company Context                            │
│    {                                                             │
│      "user_id": "user-123",                                     │
│      "company_id": "company-a-uuid",  ◄── Tenant Identifier    │
│      "role": "hr_manager",                                      │
│      "permissions": ["employees.read", ...]                     │
│    }                                                             │
└───────────────────────────┬──────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. API Request with JWT                                          │
│    GET /api/employees                                            │
│    Headers: { Authorization: "Bearer <jwt>" }                   │
└───────────────────────────┬──────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. Middleware Sets Tenant Context                               │
│    await db.query(                                               │
│      "SET LOCAL app.current_company_id = $1",                   │
│      ["company-a-uuid"]                                          │
│    );                                                            │
└───────────────────────────┬──────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ 5. Execute Query (RLS Auto-Filters)                             │
│                                                                  │
│    User writes:                                                  │
│    SELECT * FROM employees;                                      │
│                                                                  │
│    PostgreSQL RLS automatically adds:                            │
│    SELECT * FROM employees                                       │
│    WHERE company_id = current_setting('app.current_company_id')│
│                                                                  │
│    Result: Only Company A's employees returned                   │
└─────────────────────────────────────────────────────────────────┘
```

### Multi-Company Data Isolation

```
┌────────────────────────────────────────────────────────────┐
│                     employees TABLE                         │
├────────────────────────────────────────────────────────────┤
│ id  │ company_id   │ name         │ email                  │
├─────┼──────────────┼──────────────┼────────────────────────┤
│ 001 │ company-a    │ Alice Smith  │ alice@company-a.com   │ ◄─┐
│ 002 │ company-a    │ Bob Jones    │ bob@company-a.com     │ ◄─┤
│ 003 │ company-b    │ Carol White  │ carol@company-b.com   │   │ Company A
│ 004 │ company-b    │ Dave Brown   │ dave@company-b.com    │   │ can only see
│ 005 │ company-a    │ Eve Green    │ eve@company-a.com     │ ◄─┘ these rows
│ 006 │ company-c    │ Frank Black  │ frank@company-c.com   │
└─────┴──────────────┴──────────────┴────────────────────────┘
                                                  │
                                                  │
                        RLS Policy filters by     │
                        current_company_id        │
                                                  ▼
                        ┌────────────────────────────┐
                        │ Company A User sees:       │
                        ├────────────────────────────┤
                        │ 001 │ Alice Smith         │
                        │ 002 │ Bob Jones           │
                        │ 005 │ Eve Green           │
                        └────────────────────────────┘
```

---

## Authentication Flow

### Complete Authentication Journey

```
┌─────────────────┐
│ User Registration│
└────────┬─────────┘
         │
         ▼
    ┌────────────────────┐
    │ Email Verification │
    └────────┬───────────┘
             │
             ▼
    ┌────────────────┐
    │ Login (Email + │
    │    Password)   │
    └────────┬───────┘
             │
             ▼
    ┌────────────────┐      Yes    ┌──────────────┐
    │ 2FA Enabled?   │─────────────▶│ Enter TOTP   │
    └────────┬───────┘              │    Code      │
             │ No                    └──────┬───────┘
             │                              │
             │◄─────────────────────────────┘
             │
             ▼
    ┌────────────────────────┐
    │ Generate JWT Tokens:   │
    │ - Access Token (15min) │
    │ - Refresh Token (7days)│
    └────────┬───────────────┘
             │
             ▼
    ┌────────────────────┐
    │ Store Refresh Token│
    │ in Database (hashed)│
    └────────┬───────────┘
             │
             ▼
    ┌────────────────────┐
    │ Return to Client   │
    └────────┬───────────┘
             │
         ┌───┴───────────┐
         │               │
         ▼               ▼
┌─────────────────┐  ┌─────────────────┐
│ Access Token    │  │ Refresh Token   │
│ (in memory/     │  │ (httpOnly       │
│  localStorage)  │  │  cookie)        │
└─────────────────┘  └─────────────────┘
         │
         │ Every API request
         ▼
┌────────────────────┐
│ Authorization:     │
│ Bearer <token>     │
└────────────────────┘
         │
         │ Token expires (15min)
         ▼
┌────────────────────┐
│ Use Refresh Token  │
│ to get new Access  │
│ Token              │
└────────────────────┘
```

---

## Permission & Authorization System

### Role Hierarchy

```
                    ┌──────────────────┐
                    │  SUPER ADMIN     │ Level 100
                    │  (Platform)      │
                    └────────┬─────────┘
                             │ Can access all companies
                             │
┌────────────────────────────┴────────────────────────────┐
│                   COMPANY LEVEL                         │
├─────────────────────────────────────────────────────────┤
│                                                          │
│     ┌──────────────────┐                               │
│     │  COMPANY ADMIN   │ Level 100                     │
│     └────────┬─────────┘                               │
│              │                                          │
│              ├───► ┌─────────────────┐                │
│              │     │   HR MANAGER    │ Level 80       │
│              │     └────────┬────────┘                │
│              │              │                          │
│              ├───► ┌────────┴──────────┐              │
│              │     │ FINANCE MANAGER   │ Level 70     │
│              │     └────────┬──────────┘              │
│              │              │                          │
│              ├───► ┌────────┴──────────┐              │
│              │     │ DEPT MANAGER      │ Level 50     │
│              │     └────────┬──────────┘              │
│              │              │                          │
│              ├───► ┌────────┴──────────┐              │
│              │     │   EMPLOYEE        │ Level 10     │
│              │     └────────┬──────────┘              │
│              │              │                          │
│              └───► ┌────────┴──────────┐              │
│                    │    VIEWER         │ Level 5      │
│                    └───────────────────┘              │
│                                                          │
└─────────────────────────────────────────────────────────┘

Inheritance: Higher levels inherit permissions from lower levels
```

### Permission Check Flow

```
┌──────────────────────────────────────────────────────────┐
│                   API REQUEST                             │
│  GET /api/employees/123                                   │
│  Headers: { Authorization: "Bearer <jwt>" }               │
└──────────────────┬───────────────────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────────────────┐
│ Step 1: Authenticate                                      │
│ ├─ Verify JWT signature                                  │
│ ├─ Check token not expired                               │
│ ├─ Check token not revoked                               │
│ └─ Extract user info                                      │
└──────────────────┬───────────────────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────────────────┐
│ Step 2: Check Module Access                              │
│ ├─ Required: "employees.access"                          │
│ ├─ User has: ["employees.access", ...]                   │
│ └─ ✅ PASS                                                │
└──────────────────┬───────────────────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────────────────┐
│ Step 3: Check CRUD Permission                            │
│ ├─ Required: "employees.employee.read"                   │
│ ├─ User has: [..., "employees.employee.read", ...]       │
│ └─ ✅ PASS                                                │
└──────────────────┬───────────────────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────────────────┐
│ Step 4: Check Subscription Plan                          │
│ ├─ Module "employees" in plan? ✅ Yes                     │
│ ├─ Feature gates passed                                  │
│ └─ ✅ PASS                                                │
└──────────────────┬───────────────────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────────────────┐
│ Step 5: Set Tenant Context                               │
│ ├─ SET app.current_company_id = 'company-a'             │
│ └─ RLS will auto-filter queries                          │
└──────────────────┬───────────────────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────────────────┐
│ Step 6: Execute Query                                     │
│ ├─ SELECT * FROM employees WHERE id = '123'              │
│ └─ (RLS adds: AND company_id = 'company-a')             │
└──────────────────┬───────────────────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────────────────┐
│ Step 7: Field-Level Filtering                            │
│ ├─ Check "employees.employee.read_salary"                │
│ ├─ User doesn't have permission                          │
│ └─ Remove salary field from response                     │
└──────────────────┬───────────────────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────────────────┐
│ Step 8: Audit Log (Async)                                │
│ └─ Log: "User X viewed employee 123"                     │
└──────────────────┬───────────────────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────────────────┐
│ Step 9: Return Filtered Response                         │
│ {                                                         │
│   "id": "123",                                            │
│   "name": "Alice Smith",                                  │
│   "email": "alice@company-a.com",                        │
│   // salary field removed                                │
│ }                                                         │
└──────────────────────────────────────────────────────────┘
```

---

## Module Dependencies

### Module Dependency Graph

```
┌────────────────────────────────────────────────────────────┐
│                    PLATFORM LAYER                           │
│  (Authentication, Authorization, Multi-Tenancy)             │
└──────────────────────┬─────────────────────────────────────┘
                       │
                       │ All modules depend on platform
                       │
        ┌──────────────┼──────────────┐
        │              │              │
        ▼              ▼              ▼
┌───────────────┐  ┌──────────┐  ┌──────────────┐
│   EMPLOYEES   │  │ LEARNING │  │ RECRUITMENT  │
│   (Core)      │  │(Independ)│  │ (Independent)│
└───────┬───────┘  └──────────┘  └──────┬───────┘
        │                                │
        │ All HR modules                 │ Converts to
        │ depend on Employee             │ Employee
        │                                │
    ┌───┴────┬────────┬────────┐       │
    │        │        │        │       │
    ▼        ▼        ▼        ▼       ▼
┌──────┐ ┌───────┐ ┌────────┐ ┌────────┐
│LEAVE │ │ATTEND.│ │PERFORM.│ │BENEFITS│
└──┬───┘ └───┬───┘ └────────┘ └────────┘
   │         │
   │         │ Deductions for
   │         │ unpaid leave & absences
   │         │
   └────┬────┘
        │
        ▼
   ┌─────────┐
   │ PAYROLL │
   └─────────┘
```

### Data Flow Between Modules

```
┌─────────────────────────────────────────────────────────────┐
│                     RECRUITMENT MODULE                       │
│  ┌───────────┐    ┌────────────┐    ┌──────────┐          │
│  │ Candidate │───▶│ Application│───▶│  Offer   │          │
│  └───────────┘    └────────────┘    └────┬─────┘          │
└──────────────────────────────────────────┼─────────────────┘
                                            │
                                            │ API Call:
                                            │ POST /api/employees
                                            │ (create employee from offer)
                                            ▼
┌─────────────────────────────────────────────────────────────┐
│                     EMPLOYEE MODULE                          │
│  ┌───────────┐    ┌────────────┐    ┌──────────┐          │
│  │ Employee  │───▶│ Onboarding │───▶│  Active  │          │
│  │ Created   │    │ Checklist  │    │ Employee │          │
│  └───────────┘    └────────────┘    └────┬─────┘          │
└──────────────────────────────────────────┼─────────────────┘
                                            │
                    ┌───────────────────────┼───────────────┐
                    │                       │               │
                    ▼                       ▼               ▼
          ┌──────────────┐        ┌──────────────┐ ┌──────────────┐
          │ LEAVE MODULE │        │ATTENDANCE MOD│ │ PAYROLL MOD  │
          │              │        │              │ │              │
          │ - Leave      │        │ - Clock      │ │ - Salary     │
          │   Requests   │        │   In/Out     │ │   Structure  │
          │ - Balances   │        │ - Records    │ │ - Pay Runs   │
          └──────┬───────┘        └──────┬───────┘ └──────┬───────┘
                 │                       │                │
                 │ Leave deductions      │ Absence         │
                 └───────────────────────┴────────────────┘
                                         │
                                         ▼
                                ┌─────────────────┐
                                │  Payroll Run    │
                                │  Calculation    │
                                │  - Base Salary  │
                                │  - Deductions   │
                                │  - Net Pay      │
                                └─────────────────┘
```

---

## Development Timeline

### 32-Week Gantt Chart (Simplified)

```
Phase 0: Foundation (Weeks 1-2)
████
Phase 1: Platform & Company Mgmt (Weeks 3-6)
    ████████
Phase 2: Layout & Navigation (Weeks 7-9)
            ██████
Phase 3: Core Modules (Weeks 10-16)
                  ██████████████
                  ├─ Employees (10-12)
                  ├─ Leave (13-14)
                  ├─ Attendance (15)
                  └─ Payroll (16)
Phase 4: Advanced Modules (Weeks 17-22)
                                ████████████
                                ├─ Performance (17-18)
                                ├─ Learning (19)
                                ├─ Benefits (20)
                                └─ Recruitment (21-22)
Phase 5: Enterprise Features (Weeks 23-28)
                                            ████████████
                                            ├─ Analytics (24-25)
                                            ├─ Compliance (26)
                                            └─ Integrations (27-28)
Phase 6: Launch Prep (Weeks 29-32)
                                                        ████████
                                                        ├─ Optimization (29)
                                                        ├─ Security (30)
                                                        ├─ Beta Testing (31)
                                                        └─ Launch (32)
│  │  │  │  │  │  │  │  │  │  │  │  │  │  │  │  │  │  │  │  │  │  │  │  │  │  │  │  │  │  │  │  │
0  2  4  6  8  10 12 14 16 18 20 22 24 26 28 30 32 (weeks)
```

---

## Database ER Diagram (Simplified)

```
                    ┌─────────────┐
                    │  companies  │
                    └──────┬──────┘
                           │
                           │ 1:N
                           │
    ┌──────────────────────┼──────────────────────┐
    │                      │                      │
    │                      │                      │
    ▼                      ▼                      ▼
┌──────────────┐   ┌──────────────┐    ┌──────────────┐
│company_users │   │ departments  │    │ locations    │
└──────┬───────┘   └──────┬───────┘    └──────────────┘
       │                  │
       │ N:1              │ 1:N
       │                  │
       ▼                  ▼
┌──────────────┐   ┌──────────────────────────┐
│    users     │   │      employees           │
└──────────────┘   └──────┬───────────────────┘
                           │
                           │ 1:N (core entity)
                           │
        ┌──────────────────┼──────────────────┬──────────────────┐
        │                  │                  │                  │
        ▼                  ▼                  ▼                  ▼
┌──────────────┐   ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│leave_requests│   │attendance_   │  │  payslips    │  │performance_  │
│              │   │  records     │  │              │  │  reviews     │
└──────────────┘   └──────────────┘  └──────────────┘  └──────────────┘
        │                  │                  │
        │                  │                  │
        ▼                  ▼                  ▼
┌──────────────┐   ┌──────────────┐  ┌──────────────┐
│leave_        │   │attendance_   │  │ pay_runs     │
│  approvals   │   │ corrections  │  │              │
└──────────────┘   └──────────────┘  └──────────────┘
```

---

## Deployment Architecture

### Production Environment

```
                        ┌──────────────────┐
                        │   CloudFlare     │
                        │   (CDN + WAF)    │
                        └────────┬─────────┘
                                 │
                                 ▼
                        ┌──────────────────┐
                        │  Load Balancer   │
                        │   (AWS ALB)      │
                        └────────┬─────────┘
                                 │
                ┌────────────────┼────────────────┐
                │                │                │
                ▼                ▼                ▼
        ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
        │  App Server  │ │  App Server  │ │  App Server  │
        │    (1)       │ │    (2)       │ │    (N)       │
        │              │ │              │ │              │
        │ - API        │ │ - API        │ │ - API        │
        │ - Edge Fns   │ │ - Edge Fns   │ │ - Edge Fns   │
        └──────────────┘ └──────────────┘ └──────────────┘
                │                │                │
                └────────────────┼────────────────┘
                                 │
                ┌────────────────┼────────────────┐
                │                │                │
                ▼                ▼                ▼
        ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
        │ PostgreSQL   │ │ Redis        │ │ S3 Storage   │
        │  (Primary)   │ │ (Sessions +  │ │ (Documents + │
        │              │ │  Cache)      │ │  Files)      │
        └──────┬───────┘ └──────────────┘ └──────────────┘
               │
               ├─► Read Replica 1
               ├─► Read Replica 2
               └─► Read Replica N

        ┌──────────────────────────────────────────┐
        │      Background Workers                  │
        │  ┌────────┐ ┌────────┐ ┌────────┐      │
        │  │ Email  │ │Reports │ │Webhooks│      │
        │  │  Jobs  │ │  Jobs  │ │  Jobs  │      │
        │  └────────┘ └────────┘ └────────┘      │
        └──────────────────────────────────────────┘

        ┌──────────────────────────────────────────┐
        │      Monitoring & Logging                │
        │  ┌────────┐ ┌────────┐ ┌────────┐      │
        │  │ Sentry │ │DataDog │ │CloudW. │      │
        │  │(Errors)│ │ (APM)  │ │ (Logs) │      │
        │  └────────┘ └────────┘ └────────┘      │
        └──────────────────────────────────────────┘
```

---

## Security Layers

```
┌─────────────────────────────────────────────────────────────┐
│ Layer 1: Network Security                                    │
│ ├─ WAF (Web Application Firewall)                           │
│ ├─ DDoS Protection                                           │
│ ├─ Rate Limiting (per IP, per user)                         │
│ └─ SSL/TLS 1.3                                               │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ Layer 2: Authentication                                      │
│ ├─ JWT with short expiry (15min)                            │
│ ├─ Refresh token rotation                                   │
│ ├─ 2FA (TOTP)                                                │
│ ├─ Account lockout (5 failed attempts)                      │
│ └─ Password strength requirements                           │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ Layer 3: Authorization                                       │
│ ├─ RBAC (Role-Based Access Control)                         │
│ ├─ Granular permissions (module, CRUD, action, field)       │
│ ├─ Permission checks on every endpoint                      │
│ └─ Feature gating (subscription-based)                      │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ Layer 4: Data Security                                       │
│ ├─ Row-Level Security (RLS) for multi-tenancy              │
│ ├─ Encryption at rest (AES-256)                             │
│ ├─ Encryption in transit (TLS 1.3)                          │
│ ├─ Sensitive data encryption (SSN, bank details)            │
│ └─ Automatic backups (daily, encrypted)                     │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ Layer 5: Application Security                               │
│ ├─ Input validation (Zod schemas)                           │
│ ├─ SQL injection prevention (parameterized queries)         │
│ ├─ XSS prevention (React auto-escaping + CSP)              │
│ ├─ CSRF protection (tokens)                                 │
│ └─ Secure headers (HSTS, X-Frame-Options, etc.)            │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ Layer 6: Monitoring & Audit                                 │
│ ├─ Comprehensive audit logs                                 │
│ ├─ Failed login monitoring & alerts                         │
│ ├─ Error tracking (Sentry)                                  │
│ ├─ Uptime monitoring                                         │
│ └─ Security alerts (unusual activity)                       │
└─────────────────────────────────────────────────────────────┘
```

---

## Subscription Plans & Feature Gates

```
┌─────────────────────────────────────────────────────────────┐
│                        STARTER PLAN                          │
│                      $29/month per 25 employees              │
├─────────────────────────────────────────────────────────────┤
│ ✅ Employee Management                                       │
│ ✅ Leave Management                                          │
│ ✅ Attendance Tracking                                       │
│ ✅ Basic Reports                                             │
│ ✅ Email Support                                             │
│ ❌ Payroll                                                   │
│ ❌ Performance Management                                    │
│ ❌ Integrations                                              │
│ ❌ API Access                                                │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    PROFESSIONAL PLAN                         │
│                   $99/month per 100 employees                │
├─────────────────────────────────────────────────────────────┤
│ ✅ Everything in Starter                                     │
│ ✅ Payroll & Compensation                                    │
│ ✅ Performance Management                                    │
│ ✅ Learning & Development                                    │
│ ✅ Advanced Reports & Analytics                              │
│ ✅ Basic Integrations (Slack, Google)                       │
│ ✅ API Access                                                │
│ ✅ Priority Support                                          │
│ ❌ Custom SSO                                                │
│ ❌ White-Label                                               │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                     ENTERPRISE PLAN                          │
│                   $299/month unlimited employees             │
├─────────────────────────────────────────────────────────────┤
│ ✅ Everything in Professional                                │
│ ✅ Benefits Administration                                   │
│ ✅ Recruitment & ATS                                         │
│ ✅ Advanced Integrations (ADP, QuickBooks, etc.)            │
│ ✅ Custom SSO (SAML, Okta)                                  │
│ ✅ White-Label Branding                                      │
│ ✅ Custom Fields & Workflows                                 │
│ ✅ Dedicated Account Manager                                 │
│ ✅ SLA Guarantee (99.9% uptime)                             │
│ ✅ Audit Logs (7-year retention)                            │
└─────────────────────────────────────────────────────────────┘
```

---

This document provides visual representations of the key architectural concepts. Refer to the detailed documentation for implementation specifics.
