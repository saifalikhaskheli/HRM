# Getting Started - HRM SaaS Platform Development Guide

## 📚 Documentation Overview

Welcome to the HRM SaaS Platform development guide. This document provides a roadmap to all documentation and helps you get started quickly.

## Documentation Structure

### 1. **[ROADMAP.md](./ROADMAP.md)** - Strategic Development Plan
**Read this first!**
- 32-week development timeline
- 6 phases from foundation to launch
- Module-by-module breakdown
- Team allocation and success criteria

**Key Sections:**
- Phase 0: Foundation & Setup
- Phase 1: Platform & Company Management
- Phase 2: Core HR Layout & Navigation
- Phase 3: Core Modules (Employee, Leave, Attendance, Payroll)
- Phase 4: Advanced Modules (Performance, Learning, Benefits, Recruitment)
- Phase 5: Enterprise Features (Analytics, Compliance, Integrations)
- Phase 6: Launch Preparation

### 2. **[ARCHITECTURE.md](./ARCHITECTURE.md)** - System Design & Technical Architecture
**For architects and tech leads**
- System architecture diagrams
- Technology stack decisions
- Multi-tenant architecture (RLS strategy)
- Priority-based development order
- Module dependency mapping
- Scalability & performance strategies

**Key Sections:**
- High-level system diagram
- Tech stack justification
- Multi-tenancy with Row-Level Security
- Module isolation principles
- Data flow architecture
- Security architecture layers

### 3. **[DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md)** - Complete Database Design
**For backend developers**
- 50+ table definitions with SQL
- Multi-tenancy isolation (RLS policies)
- All modules: Employees, Leave, Attendance, Payroll, Performance, Learning, Benefits, Recruitment
- ER diagram showing relationships
- Indexes and performance optimizations

**Key Sections:**
- Multi-tenancy strategy
- Core platform tables
- All module tables (detailed schemas)
- RLS policy examples
- Performance indexes

### 4. **[SECURITY_FRAMEWORK.md](./SECURITY_FRAMEWORK.md)** - Security & Permissions
**For all developers - must read!**
- Authentication flow (JWT, 2FA, password reset)
- Authorization (RBAC) with role hierarchy
- Permission system (module, CRUD, action, field-level)
- Subscription-based feature gating
- Complete permission matrix (Role × Module)
- Implementation examples (backend + frontend)

**Key Sections:**
- Authentication system (registration, login, 2FA)
- Multi-tenancy isolation at DB level
- Role definitions and hierarchy
- Permission checking (backend middleware + frontend guards)
- Security best practices (password, rate limiting, encryption)

### 5. **[MODULE_STRUCTURE.md](./MODULE_STRUCTURE.md)** - Module Development Guide
**For all developers**
- Standard module structure (files & folders)
- Isolation principles (how to avoid breaking other modules)
- Integration patterns (API calls, events, shared context)
- Module checklist (data, API, frontend, testing)
- Anti-patterns to avoid

**Key Sections:**
- Bounded context principles
- Standard file structure
- Dependency rules (what you can/cannot import)
- Module integration patterns
- Development workflow

### 6. **[DEVELOPMENT_TASKS.md](./DEVELOPMENT_TASKS.md)** - Task Breakdown & Sequencing
**For project managers and developers**
- 200+ tasks with IDs, sizes, dependencies
- Critical path analysis
- Parallel work opportunities
- Team allocation matrix
- Milestone checklist

**Key Sections:**
- Task list by phase
- Task dependencies
- Parallel development matrix
- Risk mitigation strategies

---

## Quick Start Guide

### For New Developers

#### Day 1: Onboarding
1. ✅ Read this document (GETTING_STARTED.md)
2. ✅ Read ARCHITECTURE.md (sections 1-3)
3. ✅ Read SECURITY_FRAMEWORK.md (sections 1-3)
4. ✅ Clone repository and set up local environment
5. ✅ Run the application locally
6. ✅ Create test account and explore features

#### Day 2-3: Deep Dive
1. ✅ Read ROADMAP.md to understand overall plan
2. ✅ Read DATABASE_SCHEMA.md for your assigned module
3. ✅ Read MODULE_STRUCTURE.md completely
4. ✅ Review existing code in similar module
5. ✅ Set up your development branch

#### Week 1: First Contribution
1. ✅ Pick a starter task from DEVELOPMENT_TASKS.md
2. ✅ Follow module structure guidelines
3. ✅ Write tests for your code
4. ✅ Submit PR for code review
5. ✅ Address feedback and merge

### For Project Managers

1. ✅ Read ROADMAP.md completely
2. ✅ Review DEVELOPMENT_TASKS.md for task breakdown
3. ✅ Set up project board with all tasks
4. ✅ Assign developers to modules
5. ✅ Schedule weekly planning meetings
6. ✅ Track progress against milestones

### For Architects/Tech Leads

1. ✅ Read ARCHITECTURE.md completely
2. ✅ Review DATABASE_SCHEMA.md
3. ✅ Review SECURITY_FRAMEWORK.md
4. ✅ Set up infrastructure (Phase 0)
5. ✅ Review all PRs for architecture compliance
6. ✅ Conduct weekly architecture review

---

## Development Workflow

### 1. Planning (Weekly)
- Review upcoming tasks from DEVELOPMENT_TASKS.md
- Assign tasks to developers
- Identify dependencies and blockers
- Plan integration points between modules

### 2. Development (Daily)
- Follow MODULE_STRUCTURE.md for code organization
- Implement backend API with permission checks
- Implement frontend with permission guards
- Write unit tests (target >80% coverage)
- Document as you go

### 3. Code Review
- Ensure SECURITY_FRAMEWORK guidelines followed
- Check MODULE_STRUCTURE isolation rules
- Verify permission checks on all endpoints
- Test multi-tenant isolation
- Check for performance issues

### 4. Testing
- Unit tests (Jest + Testing Library)
- Integration tests (API endpoints)
- E2E tests (Playwright)
- Permission tests (RBAC)
- Multi-tenant isolation tests

### 5. Deployment
- Merge to develop → Auto-deploy to Dev environment
- Merge to staging → Manual deploy to Staging
- QA testing on Staging
- Merge to main → Manual deploy to Production (with approval)

---

## Architecture Principles to Follow

### 1. Multi-Tenancy First
- Every table MUST have `company_id`
- RLS policies MUST be enabled
- Test isolation between companies
- Never leak data across tenants

### 2. Permissions Everywhere
- Every API endpoint MUST check permissions
- Frontend MUST have permission guards
- Field-level permissions for sensitive data
- Test permission boundaries

### 3. Module Isolation
- NO imports between modules
- Use API calls for cross-module data
- Each module has own tables
- Test modules independently

### 4. Security by Default
- Validate all input (Zod schemas)
- Hash passwords (bcrypt, cost 12)
- Encrypt sensitive data (AES-256-GCM)
- Audit log sensitive actions
- Rate limit all endpoints

### 5. Performance First
- Index all foreign keys
- Cache frequently accessed data (Redis)
- Paginate large lists
- Optimize N+1 queries
- Monitor query performance

---

## Common Development Patterns

### Backend: API Endpoint
```typescript
// src/api/employees/getEmployee.ts
export async function getEmployee(req: Request) {
  // 1. Authenticate (middleware)
  const user = req.user;
  
  // 2. Check permissions
  if (!user.permissions.includes('employees.employee.read')) {
    return unauthorized();
  }
  
  // 3. Set tenant context (middleware)
  await setTenantContext(user.company_id);
  
  // 4. Validate input
  const { id } = GetEmployeeSchema.parse(req.params);
  
  // 5. Query database (RLS auto-filters)
  const employee = await db.employees.findUnique({ where: { id } });
  
  if (!employee) {
    return notFound();
  }
  
  // 6. Field-level filtering
  const filtered = filterSensitiveFields(employee, user);
  
  // 7. Audit log (optional)
  await auditLog('employee.viewed', user, { type: 'employee', id });
  
  // 8. Return response
  return success(filtered);
}
```

### Frontend: Component with Permissions
```tsx
// src/modules/employees/pages/EmployeeDetail.tsx
export function EmployeeDetail() {
  const { id } = useParams();
  const { hasPermission } = usePermissions();
  
  // Fetch data
  const { data: employee, isLoading } = useEmployee(id);
  
  // Permission check
  if (!hasPermission('employees.employee.read')) {
    return <PermissionDenied />;
  }
  
  if (isLoading) return <Skeleton />;
  if (!employee) return <NotFound />;
  
  return (
    <div>
      <h1>{employee.name}</h1>
      
      {/* Conditional rendering based on permission */}
      {hasPermission('employees.employee.read_salary') && (
        <p>Salary: ${employee.salary_amount}</p>
      )}
      
      {/* Conditional actions */}
      {hasPermission('employees.employee.update') && (
        <button>Edit</button>
      )}
    </div>
  );
}
```

---

## Testing Strategy

### Unit Tests (80% coverage target)
```typescript
// src/modules/employees/api.test.ts
describe('employeeApi', () => {
  it('should fetch all employees', async () => {
    const employees = await employeeApi.getAll();
    expect(employees).toBeInstanceOf(Array);
  });
  
  it('should filter by department', async () => {
    const employees = await employeeApi.getAll({ department_id: 'dept-1' });
    expect(employees.every(e => e.department_id === 'dept-1')).toBe(true);
  });
});
```

### Integration Tests
```typescript
// tests/integration/employees.test.ts
describe('Employees API', () => {
  it('should enforce RLS (tenant isolation)', async () => {
    const company1Token = await login(company1Admin);
    const company2Token = await login(company2Admin);
    
    // Create employee in company 1
    const employee = await createEmployee(company1Token, { ... });
    
    // Try to access from company 2 (should fail)
    const response = await getEmployee(company2Token, employee.id);
    expect(response.status).toBe(404); // Not found (due to RLS)
  });
  
  it('should enforce permissions', async () => {
    const employeeToken = await login(regularEmployee);
    
    // Try to create employee (should fail - no permission)
    const response = await createEmployee(employeeToken, { ... });
    expect(response.status).toBe(403); // Forbidden
  });
});
```

### E2E Tests
```typescript
// tests/e2e/employee-crud.spec.ts
test('complete employee CRUD flow', async ({ page }) => {
  // Login
  await page.goto('/login');
  await page.fill('[name="email"]', 'admin@company.com');
  await page.fill('[name="password"]', 'password');
  await page.click('button[type="submit"]');
  
  // Navigate to employees
  await page.click('text=Employees');
  await expect(page).toHaveURL('/app/employees');
  
  // Create employee
  await page.click('text=Add Employee');
  await page.fill('[name="firstName"]', 'John');
  await page.fill('[name="lastName"]', 'Doe');
  await page.fill('[name="email"]', 'john@example.com');
  await page.click('button:has-text("Save")');
  
  // Verify created
  await expect(page.locator('text=John Doe')).toBeVisible();
});
```

---

## Troubleshooting

### Common Issues

#### 1. RLS Policy Not Working
**Symptom**: Can see other company's data  
**Solution**: Ensure `SET app.current_company_id` is called before queries

#### 2. Permission Check Failing
**Symptom**: 403 Forbidden on API calls  
**Solution**: Check JWT contains correct permissions, verify permission slug

#### 3. Cross-Module Import Error
**Symptom**: Build fails with circular dependency  
**Solution**: Remove direct imports, use API calls instead

#### 4. Test Isolation Failing
**Symptom**: Tests pass individually but fail together  
**Solution**: Ensure proper cleanup between tests, mock external dependencies

---

## Resources

### External Documentation
- [PostgreSQL RLS](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [React Query](https://tanstack.com/query/latest/docs/react/overview)
- [Zod Validation](https://zod.dev/)
- [Supabase Docs](https://supabase.com/docs)
- [shadcn/ui](https://ui.shadcn.com/)

### Internal Links
- [API Documentation](./API.md) (generated from OpenAPI)
- [Component Library](./COMPONENTS.md)
- [Testing Guide](./TESTING.md)
- [Deployment Guide](./DEPLOYMENT.md)

---

## Support

### Getting Help
1. **Documentation**: Check relevant docs first
2. **Team Chat**: Ask in #dev-help channel
3. **Tech Lead**: Schedule 1-on-1 for complex issues
4. **Code Review**: Request review early for architectural decisions

### Office Hours
- **Architecture Review**: Tuesdays 2pm
- **Security Review**: Thursdays 10am
- **Code Review Sessions**: Daily 3pm

---

## Next Steps

Based on your role:

### 👩‍💻 **Backend Developer**
1. Read ARCHITECTURE.md + DATABASE_SCHEMA.md
2. Set up local database
3. Pick a module from DEVELOPMENT_TASKS.md
4. Start with API endpoints

### 🎨 **Frontend Developer**
1. Read ARCHITECTURE.md + MODULE_STRUCTURE.md
2. Set up local environment
3. Familiarize with shadcn/ui components
4. Pick a module UI from DEVELOPMENT_TASKS.md

### 🔐 **Security Engineer**
1. Read SECURITY_FRAMEWORK.md completely
2. Review RLS policies in DATABASE_SCHEMA.md
3. Audit existing code for vulnerabilities
4. Set up security testing tools

### 📊 **Project Manager**
1. Read ROADMAP.md + DEVELOPMENT_TASKS.md
2. Set up project board
3. Schedule team kick-off
4. Track progress weekly

### 🏗️ **Architect**
1. Review all documentation
2. Set up infrastructure (Phase 0)
3. Create architecture decision records (ADRs)
4. Conduct architecture reviews

---

## Success Criteria

You're on track when:
- ✅ All tests passing
- ✅ Code review approved
- ✅ Documentation updated
- ✅ No security vulnerabilities
- ✅ Performance benchmarks met
- ✅ Multi-tenant isolation verified

---

**Ready to build? Start with Phase 0 in [ROADMAP.md](./ROADMAP.md)!** 🚀
