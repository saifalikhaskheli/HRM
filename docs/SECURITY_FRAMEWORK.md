# HRM SaaS Platform - Security & Permissions Framework

## Table of Contents
1. [Overview](#overview)
2. [Authentication System](#authentication-system)
3. [Multi-Tenancy Isolation](#multi-tenancy-isolation)
4. [Role-Based Access Control (RBAC)](#role-based-access-control-rbac)
5. [Permission System Design](#permission-system-design)
6. [Subscription-Based Feature Gating](#subscription-based-feature-gating)
7. [Permission Matrix](#permission-matrix)
8. [Implementation Guide](#implementation-guide)
9. [Security Best Practices](#security-best-practices)
10. [Compliance & Audit](#compliance--audit)

---

## Overview

The security framework is built on **defense in depth** with multiple layers:

```
Layer 1: Network Security (WAF, DDoS, Rate Limiting)
Layer 2: Authentication (JWT, 2FA, Session Management)
Layer 3: Authorization (RBAC, Permissions)
Layer 4: Data Isolation (RLS, Encryption)
Layer 5: Application Security (Input Validation, XSS/CSRF Protection)
Layer 6: Monitoring & Audit (Logs, Alerts, Intrusion Detection)
```

### Security Principles

1. **Zero Trust**: Never trust, always verify
2. **Least Privilege**: Users get minimum permissions needed
3. **Defense in Depth**: Multiple security layers
4. **Secure by Default**: Security on by default, opt-out explicitly
5. **Audit Everything**: Comprehensive logging of sensitive actions

---

## Authentication System

### 1. Registration & Email Verification

```typescript
// User Registration Flow
POST /api/auth/register
{
  "email": "user@example.com",
  "password": "SecurePassword123!",
  "firstName": "John",
  "lastName": "Doe"
}

// Steps:
1. Validate input (email format, password strength)
2. Check if email already exists
3. Hash password with bcrypt (cost factor 12)
4. Create user record (email_verified = false)
5. Generate verification token (UUID, 24hr expiry)
6. Send verification email
7. Return success (don't leak whether email exists)

// Email Verification
GET /api/auth/verify-email?token=<token>
1. Validate token (exists, not expired)
2. Update user (email_verified = true, email_verified_at = NOW())
3. Delete token
4. Redirect to login
```

### 2. Login & JWT Tokens

```typescript
// Login Flow
POST /api/auth/login
{
  "email": "user@example.com",
  "password": "SecurePassword123!"
}

// Steps:
1. Validate input
2. Find user by email
3. Check if account locked (failed attempts >= 5)
4. Verify password (bcrypt.compare)
5. If invalid:
   - Increment failed_login_attempts
   - If attempts >= 5, lock account for 30 minutes
   - Return generic error ("Invalid credentials")
6. If valid:
   - Reset failed_login_attempts to 0
   - Check if 2FA enabled → require 2FA verification
   - Generate Access Token (JWT, 15 min expiry)
   - Generate Refresh Token (UUID, 7 day expiry)
   - Store refresh token in DB (hashed)
   - Log login event
   - Return tokens

// JWT Access Token Payload
{
  "sub": "user-id",
  "email": "user@example.com",
  "company_id": "company-id", // Current company context
  "role": "hr_manager",
  "permissions": ["employees.read", "employees.create", ...],
  "iat": 1234567890,
  "exp": 1234568800 // 15 minutes from iat
}

// Refresh Token (stored in DB)
{
  "id": "token-uuid",
  "user_id": "user-id",
  "token_hash": "bcrypt-hash",
  "expires_at": "2024-02-01T00:00:00Z",
  "revoked_at": null,
  "replaced_by": null
}
```

### 3. Token Refresh

```typescript
POST /api/auth/refresh
{
  "refreshToken": "refresh-token-uuid"
}

// Steps:
1. Validate refresh token exists in DB
2. Check not expired
3. Check not revoked
4. Generate new access token
5. Generate new refresh token (token rotation)
6. Mark old refresh token as revoked (replaced_by = new_token_id)
7. Return new tokens
```

### 4. Two-Factor Authentication (2FA)

```typescript
// Enable 2FA
POST /api/auth/2fa/enable
Headers: { Authorization: "Bearer <access-token>" }

Response:
{
  "secret": "JBSWY3DPEHPK3PXP", // TOTP secret
  "qrCodeUrl": "data:image/png;base64,..."
}

// User scans QR code with authenticator app
// Verify 2FA setup
POST /api/auth/2fa/verify
{
  "code": "123456"
}

// If valid, enable 2FA for user
UPDATE users SET two_factor_enabled = true, two_factor_secret = '<encrypted-secret>';

// Login with 2FA
POST /api/auth/login
→ Returns { "requires2FA": true, "tempToken": "<temp-token>" }

POST /api/auth/2fa/verify-login
{
  "tempToken": "<temp-token>",
  "code": "123456"
}

→ Returns access & refresh tokens
```

### 5. Password Reset

```typescript
// Request Password Reset
POST /api/auth/forgot-password
{
  "email": "user@example.com"
}

// Steps:
1. Find user by email
2. Generate reset token (UUID, 1hr expiry)
3. Store token in password_reset_tokens table
4. Send reset email with link
5. Always return success (don't leak user existence)

// Reset Password
POST /api/auth/reset-password
{
  "token": "reset-token-uuid",
  "newPassword": "NewSecurePassword123!"
}

// Steps:
1. Validate token (exists, not expired, not used)
2. Validate new password (strength requirements)
3. Hash new password
4. Update user password
5. Mark token as used
6. Revoke all existing refresh tokens (force re-login)
7. Send confirmation email
```

### 6. Session Management

```typescript
// Session Timeout: 15 minutes of inactivity
// Warning shown at 13 minutes
// Auto-logout at 15 minutes

// Extend Session (called on user activity)
POST /api/auth/extend-session
Headers: { Authorization: "Bearer <access-token>" }

// Response: New access token (if within refresh window)

// Logout
POST /api/auth/logout
{
  "refreshToken": "refresh-token-uuid"
}

// Steps:
1. Revoke refresh token in DB
2. Add access token to blacklist (Redis, TTL = remaining token life)
3. Clear cookies
4. Log logout event
```

---

## Multi-Tenancy Isolation

### Row-Level Security (RLS) Implementation

Every query must be executed within a tenant context:

```typescript
// Backend Middleware (Express/Fastify)
async function setTenantContext(req, res, next) {
  const user = req.user; // From JWT
  const companyId = user.company_id;
  
  // Set PostgreSQL session variable
  await db.query(`SET LOCAL app.current_company_id = $1`, [companyId]);
  
  next();
}

// All subsequent queries automatically filtered by RLS:
// SELECT * FROM employees; 
// → PostgreSQL automatically adds: WHERE company_id = current_setting('app.current_company_id')::UUID
```

### RLS Policy Examples

```sql
-- Tenant Isolation Policy (applied to all tenant tables)
CREATE POLICY tenant_isolation ON employees
  FOR ALL
  USING (company_id = current_setting('app.current_company_id')::UUID);

-- Platform Admin Bypass (can access all tenants)
CREATE POLICY platform_admin_bypass ON employees
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM platform_admins
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- Additional Record-Level Policy (employees can view own record)
CREATE POLICY employee_view_own ON employees
  FOR SELECT
  USING (
    user_id = auth.uid()
    OR company_id = current_setting('app.current_company_id')::UUID
  );
```

### Company Switching

```typescript
// User belongs to multiple companies
// Switch company context
POST /api/companies/switch
{
  "companyId": "new-company-uuid"
}

// Steps:
1. Verify user has access to company (check company_users table)
2. Generate new access token with new company_id
3. Return new token
4. Frontend stores new token
5. All subsequent requests use new company context
```

---

## Role-Based Access Control (RBAC)

### Role Hierarchy

```
┌─────────────────────────────────────────────────┐
│ Platform Level                                  │
├─────────────────────────────────────────────────┤
│ Super Admin (100) ─── All permissions          │
│ Platform Support (80) ─── View/impersonate     │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│ Company Level                                   │
├─────────────────────────────────────────────────┤
│ Company Admin (100) ───┐                       │
│                        │                        │
│ HR Manager (80) ───────┤                       │
│                        │                        │
│ Finance Manager (70) ──┤                       │
│                        │                        │
│ Dept Manager (50) ─────┤                       │
│                        │                        │
│ Employee (10) ─────────┤                       │
│                        │                        │
│ Viewer (5) ────────────┘                       │
└─────────────────────────────────────────────────┘

Higher level = More permissions (inherit lower level permissions)
```

### System Roles

#### 1. Company Admin
**Level**: 100  
**Description**: Full control over company settings and data  
**Permissions**: ALL

**Access**:
- ✅ All modules
- ✅ Company settings
- ✅ User management
- ✅ Subscription management
- ✅ All employee data
- ✅ Financial data (payroll, benefits)
- ✅ Reports and exports

#### 2. HR Manager
**Level**: 80  
**Description**: Manages HR operations and employee data  
**Permissions**: Most HR modules, limited financial access

**Access**:
- ✅ Employee management (full CRUD)
- ✅ Leave management (view all, approve)
- ✅ Attendance tracking (view all, corrections)
- ✅ Performance reviews (view all, manage cycles)
- ✅ Recruitment (full access)
- ✅ Learning & Development (full access)
- ✅ Benefits (enrollment only)
- ⚠️ Payroll (view only, no edit)
- ❌ Company settings (read-only)
- ❌ Subscription management

#### 3. Finance Manager
**Level**: 70  
**Description**: Manages financial aspects (payroll, expenses)  
**Permissions**: Financial modules, limited HR access

**Access**:
- ✅ Payroll (full access)
- ✅ Employee compensation (full access)
- ✅ Benefits administration (full access)
- ⚠️ Employee directory (view only, no PII)
- ⚠️ Leave requests (view for payroll deductions)
- ⚠️ Attendance (view for payroll calculations)
- ❌ Performance reviews
- ❌ Recruitment
- ❌ Learning

#### 4. Department Manager
**Level**: 50  
**Description**: Manages own department/team  
**Permissions**: Limited to own department

**Access**:
- ⚠️ Employee directory (own department only)
- ⚠️ Leave requests (own department, approve)
- ⚠️ Attendance (own department, view/correct)
- ⚠️ Performance reviews (own department, conduct)
- ⚠️ Time tracking (own department, approve)
- ❌ Payroll
- ❌ Benefits (except own enrollments)
- ❌ Recruitment (unless assigned as hiring manager)

#### 5. Employee
**Level**: 10  
**Description**: Self-service access  
**Permissions**: Own data only

**Access**:
- ⚠️ Own profile (view, limited edit)
- ⚠️ Own leave requests (submit, view)
- ⚠️ Own attendance (clock in/out, view)
- ⚠️ Own payslips (view, download)
- ⚠️ Own performance reviews (self-review, view feedback)
- ⚠️ Own goals (create, track)
- ⚠️ Own learning (enroll, complete courses)
- ⚠️ Own benefits (view, enroll during open period)
- ⚠️ Team directory (view colleagues)
- ❌ Other employees' data
- ❌ Approvals
- ❌ Reports

#### 6. Viewer
**Level**: 5  
**Description**: Read-only access (auditors, executives)  
**Permissions**: View-only, no modifications

**Access**:
- ⚠️ All modules (read-only)
- ❌ Create/Update/Delete
- ❌ Approvals
- ❌ Exports (unless explicitly granted)

---

## Permission System Design

### Permission Structure

Permissions follow a hierarchical slug format:

```
<module>.<resource>.<action>
```

Examples:
- `employees.employee.read`
- `employees.employee.create`
- `employees.employee.update`
- `employees.employee.delete`
- `employees.employee.read_salary`
- `leave.leave_request.approve`
- `payroll.payroll.process`

### Permission Levels

1. **Module Level**: Can access module at all
   - `employees.access`
   - `payroll.access`

2. **CRUD Level**: Basic operations
   - `employees.employee.read`
   - `employees.employee.create`
   - `employees.employee.update`
   - `employees.employee.delete`

3. **Action Level**: Special actions
   - `employees.employee.approve`
   - `employees.employee.export`
   - `leave.leave_request.approve`
   - `payroll.payroll.process`

4. **Field Level**: Sensitive fields
   - `employees.employee.read_salary`
   - `employees.employee.read_ssn`
   - `employees.employee.update_compensation`

### Permission Inheritance

Roles inherit permissions:

```typescript
// Company Admin inherits all permissions
role.level >= 100 → ALL_PERMISSIONS

// HR Manager inherits Employee permissions
if (userRole.level >= targetRole.level) {
  // Can perform actions on users with lower or equal role level
}
```

### Scope-Based Permissions

Permissions can be scoped to:

1. **Global** (all records): `employees.employee.read`
2. **Department** (own department): `employees.employee.read@department`
3. **Own** (only own record): `employees.employee.read@own`

```typescript
// Check scoped permission
function checkPermission(user, permission, resource) {
  const hasGlobal = user.permissions.includes(permission);
  if (hasGlobal) return true;
  
  const hasDepartment = user.permissions.includes(`${permission}@department`);
  if (hasDepartment && resource.department_id === user.department_id) return true;
  
  const hasOwn = user.permissions.includes(`${permission}@own`);
  if (hasOwn && resource.id === user.employee_id) return true;
  
  return false;
}
```

---

## Subscription-Based Feature Gating

### Plan-Based Module Access

```typescript
// Subscription Plans
const PLANS = {
  starter: {
    modules: ['employees', 'leave', 'attendance'],
    maxEmployees: 25,
    maxUsers: 10,
    features: ['basic_reports', 'email_support']
  },
  professional: {
    modules: ['employees', 'leave', 'attendance', 'payroll', 'performance', 'learning'],
    maxEmployees: 100,
    maxUsers: 50,
    features: ['advanced_reports', 'integrations:basic', 'priority_support', 'api_access']
  },
  enterprise: {
    modules: ['*'], // All modules
    maxEmployees: null, // Unlimited
    maxUsers: null,
    features: ['custom_reports', 'integrations:advanced', 'sso', 'white_label', 'dedicated_support', 'sla']
  }
};

// Feature Gate Check
function hasFeature(company, featureSlug) {
  const subscription = company.active_subscription;
  const plan = PLANS[subscription.plan_slug];
  
  // Check module access
  if (featureSlug.startsWith('module:')) {
    const module = featureSlug.split(':')[1];
    return plan.modules.includes('*') || plan.modules.includes(module);
  }
  
  // Check feature access
  return plan.features.includes(featureSlug);
}
```

### Usage Limits

```typescript
// Check employee limit
async function canAddEmployee(companyId) {
  const subscription = await getActiveSubscription(companyId);
  const plan = PLANS[subscription.plan_slug];
  
  if (!plan.maxEmployees) return true; // Unlimited
  
  const currentCount = await db.employees.count({ company_id: companyId });
  return currentCount < plan.maxEmployees;
}

// Enforce limit
if (!await canAddEmployee(companyId)) {
  throw new Error('Employee limit reached. Please upgrade your plan.');
}
```

### Trial Limitations

```typescript
// Trial companies have restricted features
if (company.status === 'trial') {
  // Restrictions:
  - Max 5 employees
  - No integrations
  - No API access
  - No exports
  - Watermarked reports
  - Banner: "Trial mode - X days remaining"
}
```

---

## Permission Matrix

### Complete Role × Module Matrix

| Module | Company Admin | HR Manager | Finance Mgr | Dept Manager | Employee | Viewer |
|--------|---------------|------------|-------------|--------------|----------|--------|
| **Employees** |
| View Directory | ✅ All | ✅ All | ⚠️ No PII | ⚠️ Own Dept | ⚠️ Team | ✅ All |
| View Profile | ✅ All | ✅ All | ⚠️ Limited | ⚠️ Own Dept | ⚠️ Own | ✅ All |
| Create Employee | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Update Employee | ✅ | ✅ | ❌ | ⚠️ Own Dept | ⚠️ Own (limited) | ❌ |
| Delete Employee | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| View Salary | ✅ | ✅ | ✅ | ❌ | ⚠️ Own | ❌ |
| Update Salary | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |
| Export | ✅ | ✅ | ⚠️ Limited | ❌ | ❌ | ❌ |
| **Leave** |
| View Requests | ✅ All | ✅ All | ⚠️ Summary | ⚠️ Own Dept | ⚠️ Own | ✅ All |
| Submit Request | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Approve Request | ✅ | ✅ | ❌ | ⚠️ Own Dept | ❌ | ❌ |
| Configure Policies | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Adjust Balances | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Attendance** |
| Clock In/Out | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| View Records | ✅ All | ✅ All | ⚠️ Summary | ⚠️ Own Dept | ⚠️ Own | ✅ All |
| Correct Records | ✅ | ✅ | ❌ | ⚠️ Own Dept | ⚠️ Request | ❌ |
| Export | ✅ | ✅ | ✅ | ⚠️ Own Dept | ❌ | ❌ |
| **Payroll** |
| View Payroll | ✅ | ⚠️ Read-only | ✅ | ❌ | ❌ | ⚠️ Read-only |
| Create Pay Run | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |
| Process Payroll | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |
| View Payslips (All) | ✅ | ⚠️ Read-only | ✅ | ❌ | ❌ | ❌ |
| View Own Payslip | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Configure Components | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |
| **Performance** |
| View Reviews | ✅ All | ✅ All | ❌ | ⚠️ Own Dept | ⚠️ Own | ⚠️ Read-only |
| Create Review Cycle | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Conduct Review | ✅ | ✅ | ❌ | ⚠️ Own Dept | ⚠️ Self | ❌ |
| View Goals | ✅ All | ✅ All | ❌ | ⚠️ Own Dept | ⚠️ Own | ⚠️ Read-only |
| Create Goal | ✅ | ✅ | ❌ | ⚠️ Own Dept | ✅ Own | ❌ |
| **Recruitment** |
| View Jobs | ✅ | ✅ | ❌ | ⚠️ If hiring mgr | ❌ | ⚠️ Read-only |
| Create Job | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| View Candidates | ✅ | ✅ | ❌ | ⚠️ Own jobs | ❌ | ❌ |
| Schedule Interview | ✅ | ✅ | ❌ | ⚠️ Own jobs | ❌ | ❌ |
| Make Offer | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Learning** |
| View Courses | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Create Course | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Enroll Employee | ✅ | ✅ | ❌ | ⚠️ Own dept | ❌ | ❌ |
| Self-Enroll | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| View Progress (All) | ✅ | ✅ | ❌ | ⚠️ Own dept | ❌ | ⚠️ Read-only |
| **Benefits** |
| View Plans | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Configure Plans | ✅ | ⚠️ Limited | ✅ | ❌ | ❌ | ❌ |
| View Enrollments (All) | ✅ | ⚠️ Summary | ✅ | ❌ | ❌ | ⚠️ Read-only |
| Enroll (Self) | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Reports** |
| View Reports | ✅ All | ✅ HR reports | ✅ Financial | ⚠️ Own dept | ⚠️ Own | ✅ All |
| Create Custom Report | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Schedule Reports | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Export Data | ✅ | ✅ | ✅ | ⚠️ Own dept | ❌ | ❌ |
| **Company Settings** |
| View Settings | ✅ | ⚠️ Read-only | ⚠️ Read-only | ❌ | ❌ | ⚠️ Read-only |
| Update Settings | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Manage Users | ✅ | ⚠️ View only | ❌ | ❌ | ❌ | ❌ |
| Manage Subscription | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Integrations** |
| View Integrations | ✅ | ⚠️ Read-only | ⚠️ Read-only | ❌ | ❌ | ❌ |
| Configure Integration | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| API Access | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |

**Legend**:
- ✅ = Full access
- ⚠️ = Limited/conditional access
- ❌ = No access

---

## Implementation Guide

### Backend: Permission Middleware

```typescript
// middleware/permission.ts
export function requirePermission(permission: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const user = req.user; // From JWT
    
    // Check if user has permission
    if (!user.permissions.includes(permission)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: `Missing permission: ${permission}`
      });
    }
    
    next();
  };
}

// Usage in route
app.get('/api/employees', 
  authenticate, // Verify JWT
  setTenantContext, // Set company_id
  requirePermission('employees.employee.read'),
  async (req, res) => {
    const employees = await db.employees.findMany();
    res.json(employees);
  }
);

// Multiple permissions (OR)
export function requireAnyPermission(...permissions: string[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const user = req.user;
    const hasAny = permissions.some(p => user.permissions.includes(p));
    
    if (!hasAny) {
      return res.status(403).json({
        error: 'Forbidden',
        message: `Missing one of: ${permissions.join(', ')}`
      });
    }
    
    next();
  };
}

// Multiple permissions (AND)
export function requireAllPermissions(...permissions: string[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const user = req.user;
    const hasAll = permissions.every(p => user.permissions.includes(p));
    
    if (!hasAll) {
      return res.status(403).json({
        error: 'Forbidden',
        message: `Missing permissions: ${permissions.join(', ')}`
      });
    }
    
    next();
  };
}
```

### Frontend: Permission Guards

```typescript
// hooks/usePermissions.ts
export function usePermissions() {
  const { user } = useAuth();
  
  const hasPermission = (permission: string): boolean => {
    if (!user) return false;
    return user.permissions.includes(permission);
  };
  
  const hasAnyPermission = (...permissions: string[]): boolean => {
    if (!user) return false;
    return permissions.some(p => user.permissions.includes(p));
  };
  
  const hasAllPermissions = (...permissions: string[]): boolean => {
    if (!user) return false;
    return permissions.every(p => user.permissions.includes(p));
  };
  
  return { hasPermission, hasAnyPermission, hasAllPermissions };
}

// Usage in components
function EmployeeList() {
  const { hasPermission } = usePermissions();
  
  return (
    <div>
      <h1>Employees</h1>
      
      {hasPermission('employees.employee.create') && (
        <button>Add Employee</button>
      )}
      
      {/* List employees */}
    </div>
  );
}
```

```typescript
// components/PermissionGuard.tsx
export function PermissionGuard({ 
  permission, 
  fallback = null,
  children 
}: {
  permission: string;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}) {
  const { hasPermission } = usePermissions();
  
  if (!hasPermission(permission)) {
    return <>{fallback}</>;
  }
  
  return <>{children}</>;
}

// Usage
<PermissionGuard permission="employees.employee.update">
  <button>Edit Employee</button>
</PermissionGuard>
```

### Field-Level Permissions

```typescript
// Backend: Filter sensitive fields
function filterSensitiveFields(employee: Employee, user: User): Partial<Employee> {
  const filtered = { ...employee };
  
  // Remove salary if user doesn't have permission
  if (!user.permissions.includes('employees.employee.read_salary')) {
    delete filtered.salary_amount;
    delete filtered.salary_currency;
  }
  
  // Remove SSN/Tax ID
  if (!user.permissions.includes('employees.employee.read_ssn')) {
    delete filtered.ssn_encrypted;
    delete filtered.tax_id_encrypted;
  }
  
  // Remove bank details
  if (!user.permissions.includes('employees.employee.read_bank_details')) {
    delete filtered.bank_account_encrypted;
  }
  
  return filtered;
}

// Frontend: Conditional rendering
function EmployeeProfile({ employee }) {
  const { hasPermission } = usePermissions();
  
  return (
    <div>
      <h2>{employee.name}</h2>
      <p>Email: {employee.email}</p>
      
      {hasPermission('employees.employee.read_salary') && (
        <p>Salary: ${employee.salary_amount}</p>
      )}
      
      {hasPermission('employees.employee.read_ssn') && (
        <p>SSN: {employee.ssn}</p>
      )}
    </div>
  );
}
```

---

## Security Best Practices

### 1. Password Security

```typescript
// Password Requirements
const PASSWORD_REQUIREMENTS = {
  minLength: 12,
  requireUppercase: true,
  requireLowercase: true,
  requireNumber: true,
  requireSpecialChar: true,
  preventCommon: true, // Check against list of common passwords
  preventUserInfo: true // Prevent password containing email, name
};

// Password Strength Checker
function validatePassword(password: string, user: User): boolean {
  // Length check
  if (password.length < PASSWORD_REQUIREMENTS.minLength) {
    throw new Error(`Password must be at least ${PASSWORD_REQUIREMENTS.minLength} characters`);
  }
  
  // Complexity checks
  if (PASSWORD_REQUIREMENTS.requireUppercase && !/[A-Z]/.test(password)) {
    throw new Error('Password must contain an uppercase letter');
  }
  
  if (PASSWORD_REQUIREMENTS.requireLowercase && !/[a-z]/.test(password)) {
    throw new Error('Password must contain a lowercase letter');
  }
  
  if (PASSWORD_REQUIREMENTS.requireNumber && !/\d/.test(password)) {
    throw new Error('Password must contain a number');
  }
  
  if (PASSWORD_REQUIREMENTS.requireSpecialChar && !/[!@#$%^&*]/.test(password)) {
    throw new Error('Password must contain a special character');
  }
  
  // Check against common passwords
  if (PASSWORD_REQUIREMENTS.preventCommon && isCommonPassword(password)) {
    throw new Error('Password is too common. Please choose a stronger password');
  }
  
  // Prevent user info in password
  if (PASSWORD_REQUIREMENTS.preventUserInfo) {
    const email = user.email.toLowerCase();
    const name = `${user.firstName} ${user.lastName}`.toLowerCase();
    const passwordLower = password.toLowerCase();
    
    if (passwordLower.includes(email.split('@')[0]) || 
        passwordLower.includes(user.firstName.toLowerCase()) ||
        passwordLower.includes(user.lastName.toLowerCase())) {
      throw new Error('Password cannot contain your email or name');
    }
  }
  
  return true;
}

// Password Hashing
import bcrypt from 'bcrypt';

const SALT_ROUNDS = 12;

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
```

### 2. Rate Limiting

```typescript
// Rate Limiting Configuration
const RATE_LIMITS = {
  login: { max: 5, window: '15m' }, // 5 attempts per 15 minutes
  api: { max: 100, window: '1m' }, // 100 requests per minute
  password_reset: { max: 3, window: '1h' }, // 3 resets per hour
  export: { max: 10, window: '1h' } // 10 exports per hour
};

// Implementation (using Redis)
import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';

const loginLimiter = rateLimit({
  store: new RedisStore({ client: redis }),
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  message: 'Too many login attempts. Please try again later.',
  standardHeaders: true,
  legacyHeaders: false
});

app.post('/api/auth/login', loginLimiter, loginHandler);
```

### 3. Input Validation

```typescript
// Use Zod for validation
import { z } from 'zod';

const CreateEmployeeSchema = z.object({
  firstName: z.string().min(1).max(50),
  lastName: z.string().min(1).max(50),
  email: z.string().email(),
  phone: z.string().regex(/^\+?[1-9]\d{1,14}$/).optional(),
  hireDate: z.string().date(),
  jobTitle: z.string().min(1).max(100),
  departmentId: z.string().uuid(),
  salary: z.number().positive().max(10000000)
});

// Validate input
app.post('/api/employees', async (req, res) => {
  try {
    const data = CreateEmployeeSchema.parse(req.body);
    // Proceed with validated data
  } catch (error) {
    return res.status(400).json({ error: 'Invalid input', details: error.errors });
  }
});
```

### 4. Encryption

```typescript
// Encrypt sensitive data at rest
import crypto from 'crypto';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY; // 32 bytes
const ALGORITHM = 'aes-256-gcm';

function encrypt(text: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY), iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  // Return iv:authTag:encrypted
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

function decrypt(encrypted: string): string {
  const [ivHex, authTagHex, encryptedHex] = encrypted.split(':');
  
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY), iv);
  
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

// Usage
const ssnEncrypted = encrypt(employee.ssn);
await db.employees.update({ ssn_encrypted: ssnEncrypted });
```

### 5. Security Headers

```typescript
// Use Helmet.js for security headers
import helmet from 'helmet';

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'", 'https://api.yourapp.com'],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"]
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  frameguard: { action: 'deny' },
  xssFilter: true,
  noSniff: true,
  referrerPolicy: { policy: 'no-referrer' }
}));
```

---

## Compliance & Audit

### Audit Logging

```typescript
// Log all sensitive actions
async function auditLog(action: string, user: User, resource: any, changes?: any) {
  await db.audit_logs.create({
    company_id: user.company_id,
    user_id: user.id,
    user_email: user.email,
    user_name: `${user.firstName} ${user.lastName}`,
    action,
    resource_type: resource.type,
    resource_id: resource.id,
    old_values: changes?.old,
    new_values: changes?.new,
    ip_address: req.ip,
    user_agent: req.headers['user-agent'],
    request_id: req.id,
    status: 'success'
  });
}

// Example usage
await auditLog('employee.updated', user, { type: 'employee', id: employeeId }, {
  old: { salary: 50000 },
  new: { salary: 60000 }
});
```

### GDPR Compliance

```typescript
// Data Export (Right to Access)
async function exportUserData(userId: string): Promise<UserDataExport> {
  const user = await db.users.findUnique({ where: { id: userId } });
  const employee = await db.employees.findFirst({ where: { user_id: userId } });
  const leaves = await db.leave_requests.findMany({ where: { employee_id: employee.id } });
  const attendance = await db.attendance_records.findMany({ where: { employee_id: employee.id } });
  
  return {
    personal_info: {
      email: user.email,
      name: `${employee.firstName} ${employee.lastName}`,
      phone: employee.phone,
      address: employee.address
    },
    employment_info: { /* ... */ },
    leave_history: leaves,
    attendance_history: attendance,
    // ... other data
  };
}

// Data Deletion (Right to Erasure)
async function deleteUserData(userId: string) {
  // Anonymize instead of hard delete (for audit trail)
  await db.users.update({
    where: { id: userId },
    data: {
      email: `deleted-${userId}@anonymized.local`,
      first_name: 'Deleted',
      last_name: 'User',
      phone: null,
      avatar_url: null,
      deleted_at: new Date()
    }
  });
  
  // Cascade anonymization to related records
  await db.employees.updateMany({
    where: { user_id: userId },
    data: {
      personal_email: null,
      phone: null,
      mobile: null,
      address_line1: null,
      ssn_encrypted: null,
      deleted_at: new Date()
    }
  });
}
```

---

## Conclusion

This security framework provides:

1. **Strong Authentication**: JWT + 2FA + Session management
2. **Complete Data Isolation**: RLS ensures zero cross-tenant leakage
3. **Granular Permissions**: Module, CRUD, Action, and Field-level controls
4. **Subscription Enforcement**: Feature gating based on plan
5. **Audit Trail**: Complete logging of sensitive actions
6. **Compliance**: GDPR, HIPAA, SOC 2 readiness

By following these guidelines, the platform maintains enterprise-grade security while remaining developer-friendly and maintainable.
