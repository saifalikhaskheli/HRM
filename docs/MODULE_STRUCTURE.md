# Module Structure & Isolation

## Overview

Each module in the HRM platform is designed as an **independent bounded context** that can be developed, tested, and deployed without disrupting other modules.

## Core Principles

### 1. Bounded Context
Each module owns its:
- Data tables (no shared tables between modules)
- Business logic (domain-specific rules)
- API endpoints (prefixed by module name)
- UI components (in dedicated directory)
- Tests (module-level test suites)

### 2. Minimal Coupling
Modules should ONLY depend on:
- ✅ Core utilities (auth, API client, permissions)
- ✅ Shared UI components (buttons, forms, modals)
- ✅ Shared types (User, Company, Permission)
- ❌ Other module code (NO direct imports)
- ❌ Other module tables (NO direct queries)

### 3. Integration via APIs
If Module A needs data from Module B:
- ✅ Call Module B's API endpoint
- ✅ Subscribe to Module B's events (webhooks)
- ✅ Pass data through user actions
- ❌ Direct database queries
- ❌ Direct code imports

## Standard Module Structure

```
src/modules/<module-name>/
├── pages/                           # Route pages
│   ├── ListPage.tsx                 # /app/<module>
│   ├── DetailPage.tsx               # /app/<module>/:id
│   ├── CreatePage.tsx               # /app/<module>/new
│   └── EditPage.tsx                 # /app/<module>/:id/edit
├── components/                      # Module-specific components
│   ├── <Module>List.tsx             # List/table component
│   ├── <Module>Card.tsx             # Card component
│   ├── <Module>Form.tsx             # Form component
│   ├── <Module>Filters.tsx          # Filter component
│   ├── <Module>Modal.tsx            # Modal dialogs
│   └── <Module>Header.tsx           # Page header
├── hooks/                           # React Query hooks
│   ├── use<Module>s.ts              # useEmployees() - fetch list
│   ├── use<Module>.ts               # useEmployee(id) - fetch single
│   ├── useCreate<Module>.ts         # useCreateEmployee() - create mutation
│   ├── useUpdate<Module>.ts         # useUpdateEmployee() - update mutation
│   ├── useDelete<Module>.ts         # useDeleteEmployee() - delete mutation
│   └── use<Module>Stats.ts          # useEmployeeStats() - analytics
├── types/                           # TypeScript types
│   └── index.ts                     # Employee, CreateEmployeeInput, etc.
├── utils/                           # Module-specific utilities
│   ├── helpers.ts                   # Helper functions
│   └── validators.ts                # Validation logic
├── api.ts                           # API client functions
├── constants.ts                     # Module constants
├── routes.ts                        # Route definitions
└── README.md                        # Module documentation
```

## Example: Employee Module

### File Structure
```
src/modules/employees/
├── pages/
│   ├── EmployeeList.tsx
│   ├── EmployeeDetail.tsx
│   ├── CreateEmployee.tsx
│   └── EditEmployee.tsx
├── components/
│   ├── EmployeeList.tsx
│   ├── EmployeeCard.tsx
│   ├── EmployeeForm.tsx
│   ├── EmployeeFilters.tsx
│   ├── EmployeeAvatar.tsx
│   └── EmployeeStatusBadge.tsx
├── hooks/
│   ├── useEmployees.ts
│   ├── useEmployee.ts
│   ├── useCreateEmployee.ts
│   ├── useUpdateEmployee.ts
│   ├── useDeleteEmployee.ts
│   └── useEmployeeStats.ts
├── types/
│   └── index.ts
├── utils/
│   ├── helpers.ts
│   └── validators.ts
├── api.ts
├── constants.ts
└── routes.ts
```

### types/index.ts
```typescript
export interface Employee {
  id: string;
  company_id: string;
  employee_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  job_title: string;
  department_id: string;
  location_id?: string;
  manager_id?: string;
  hire_date: string;
  employment_type: 'full_time' | 'part_time' | 'contract' | 'intern';
  employment_status: 'active' | 'probation' | 'on_leave' | 'terminated';
  salary_amount?: number;
  salary_currency?: string;
  avatar_url?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateEmployeeInput {
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  job_title: string;
  department_id: string;
  location_id?: string;
  manager_id?: string;
  hire_date: string;
  employment_type: 'full_time' | 'part_time' | 'contract' | 'intern';
  salary_amount?: number;
}

export interface UpdateEmployeeInput extends Partial<CreateEmployeeInput> {
  id: string;
}

export interface EmployeeFilters {
  search?: string;
  department_id?: string;
  location_id?: string;
  employment_status?: string;
  employment_type?: string;
}
```

### api.ts
```typescript
import { apiClient } from '@/lib/api';
import type { Employee, CreateEmployeeInput, UpdateEmployeeInput, EmployeeFilters } from './types';

const BASE_URL = '/api/employees';

export const employeeApi = {
  getAll: async (filters?: EmployeeFilters) => {
    const { data } = await apiClient.get<Employee[]>(BASE_URL, { params: filters });
    return data;
  },

  getById: async (id: string) => {
    const { data } = await apiClient.get<Employee>(`${BASE_URL}/${id}`);
    return data;
  },

  create: async (input: CreateEmployeeInput) => {
    const { data } = await apiClient.post<Employee>(BASE_URL, input);
    return data;
  },

  update: async (input: UpdateEmployeeInput) => {
    const { data } = await apiClient.put<Employee>(`${BASE_URL}/${input.id}`, input);
    return data;
  },

  delete: async (id: string) => {
    await apiClient.delete(`${BASE_URL}/${id}`);
  },

  export: async (filters?: EmployeeFilters) => {
    const { data } = await apiClient.get(`${BASE_URL}/export`, { 
      params: filters,
      responseType: 'blob'
    });
    return data;
  }
};
```

### hooks/useEmployees.ts
```typescript
import { useQuery } from '@tanstack/react-query';
import { employeeApi } from '../api';
import type { EmployeeFilters } from '../types';

export function useEmployees(filters?: EmployeeFilters) {
  return useQuery({
    queryKey: ['employees', filters],
    queryFn: () => employeeApi.getAll(filters),
    staleTime: 5 * 60 * 1000 // 5 minutes
  });
}
```

### hooks/useCreateEmployee.ts
```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { employeeApi } from '../api';
import type { CreateEmployeeInput } from '../types';
import { toast } from 'sonner';

export function useCreateEmployee() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateEmployeeInput) => employeeApi.create(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      toast.success('Employee created successfully');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to create employee');
    }
  });
}
```

## Module Integration Patterns

### Pattern 1: API Calls (Synchronous)

**Scenario**: Payroll module needs employee data

❌ **BAD** - Direct import:
```typescript
// payroll/PayrollService.ts
import { getEmployee } from '../../employees/api'; // ❌ Tight coupling
const employee = await getEmployee(employeeId);
```

✅ **GOOD** - API call:
```typescript
// payroll/PayrollService.ts
import { apiClient } from '@/lib/api';
const employee = await apiClient.get(`/api/employees/${employeeId}`);
```

### Pattern 2: Events/Webhooks (Asynchronous)

**Scenario**: Recruitment module converts candidate to employee

✅ **GOOD** - Create employee via API:
```typescript
// recruitment/services/candidateService.ts
async function hireCandidate(candidateId: string, offerDetails: OfferDetails) {
  // 1. Get candidate data
  const candidate = await candidateApi.getById(candidateId);
  
  // 2. Call Employee API to create employee
  const employee = await apiClient.post('/api/employees', {
    first_name: candidate.first_name,
    last_name: candidate.last_name,
    email: candidate.email,
    phone: candidate.phone,
    job_title: offerDetails.job_title,
    department_id: offerDetails.department_id,
    hire_date: offerDetails.start_date,
    employment_type: offerDetails.employment_type,
    salary_amount: offerDetails.salary
  });
  
  // 3. Update application status
  await applicationApi.markAsHired(candidateId, employee.id);
  
  // 4. Trigger onboarding workflow (via webhook)
  await webhookService.trigger('employee.hired', { employee_id: employee.id });
}
```

### Pattern 3: Shared Data via Context

**Scenario**: Multiple modules need current user/company

✅ **GOOD** - Use Context API:
```typescript
// contexts/TenantContext.tsx
export const TenantContext = createContext<TenantContextType | null>(null);

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const [company, setCompany] = useState<Company | null>(null);
  const [employee, setEmployee] = useState<Employee | null>(null);
  
  // Fetch company and employee on mount
  useEffect(() => {
    fetchCompanyAndEmployee();
  }, []);
  
  return (
    <TenantContext.Provider value={{ company, employee, setCompany }}>
      {children}
    </TenantContext.Provider>
  );
}

// Usage in any module
function PayrollPage() {
  const { company } = useTenant();
  // Use company settings for payroll calculations
}
```

## Module Checklist

Before marking a module as complete, verify:

### Data Layer
- [ ] All tables have `company_id` for multi-tenancy
- [ ] RLS policies enabled
- [ ] Indexes created on foreign keys
- [ ] Migrations tested (up and down)
- [ ] Sample seed data created

### API Layer
- [ ] All CRUD endpoints implemented
- [ ] Permission checks on every endpoint
- [ ] Input validation (Zod schemas)
- [ ] Error handling (consistent format)
- [ ] API documentation (Swagger/OpenAPI)

### Frontend Layer
- [ ] All pages implemented (list, detail, create, edit)
- [ ] React Query hooks created
- [ ] Forms with validation (React Hook Form + Zod)
- [ ] Loading states handled
- [ ] Error states handled
- [ ] Empty states handled
- [ ] Permission guards on UI elements

### Business Logic
- [ ] Business rules implemented
- [ ] Edge cases handled
- [ ] Audit logging for sensitive actions
- [ ] Notifications sent (email, in-app)
- [ ] Integration points documented

### Testing
- [ ] Unit tests (>80% coverage)
- [ ] Integration tests (API endpoints)
- [ ] E2E tests (critical user flows)
- [ ] Permission tests (RBAC)
- [ ] Multi-tenant isolation tests

### Documentation
- [ ] Module README with overview
- [ ] API endpoint documentation
- [ ] User guide (how to use features)
- [ ] Developer guide (how to extend)

## Module Development Workflow

### Step 1: Design
1. Define module scope and boundaries
2. Design database schema
3. Define API endpoints
4. Create user flows
5. Design UI mockups

### Step 2: Backend Development
1. Create database migrations
2. Implement API endpoints
3. Add permission checks
4. Write unit tests
5. Write API documentation

### Step 3: Frontend Development
1. Create types (from API)
2. Create API client functions
3. Create React Query hooks
4. Create components
5. Create pages
6. Add permission guards

### Step 4: Integration
1. Test with other modules (if dependencies)
2. Test permissions end-to-end
3. Test multi-tenant isolation
4. Test error scenarios

### Step 5: Documentation & Deployment
1. Write user documentation
2. Write developer documentation
3. Deploy to staging
4. QA testing
5. Deploy to production

## Anti-Patterns to Avoid

### ❌ Cross-Module Imports
```typescript
// ❌ DON'T DO THIS
import { getEmployee } from '@/modules/employees/api';
import { EmployeeCard } from '@/modules/employees/components/EmployeeCard';
```

### ❌ Shared Database Tables
```sql
-- ❌ DON'T DO THIS
-- Creating a shared "assignments" table used by multiple modules
CREATE TABLE assignments (
  id UUID PRIMARY KEY,
  company_id UUID NOT NULL,
  resource_type TEXT, -- 'employee', 'candidate', 'course'
  resource_id UUID,
  assigned_to UUID,
  ...
);
-- This creates tight coupling between modules
```

### ❌ Global State for Module Data
```typescript
// ❌ DON'T DO THIS
// Using global Redux/Zustand store for module-specific data
const useGlobalStore = create((set) => ({
  employees: [],
  candidates: [],
  courses: [],
  ...
}));
```

## Module Dependencies

### Allowed Dependencies

```
Module
  ├─► Core Utilities (required)
  │   ├─ @/lib/api (API client)
  │   ├─ @/lib/auth (auth helpers)
  │   ├─ @/lib/permissions (permission checks)
  │   └─ @/lib/utils (general utilities)
  │
  ├─► Shared Components (required)
  │   ├─ @/components/ui (shadcn/ui components)
  │   ├─ @/components/forms (form components)
  │   └─ @/components/layout (layout components)
  │
  ├─► Shared Contexts (required)
  │   ├─ @/contexts/AuthContext
  │   ├─ @/contexts/TenantContext
  │   └─ @/contexts/PermissionContext
  │
  └─► Shared Types (required)
      ├─ @/types/user.ts
      ├─ @/types/company.ts
      └─ @/types/common.ts
```

### Forbidden Dependencies

```
Module
  ❌ Other Modules
      ├─ @/modules/employees/*
      ├─ @/modules/payroll/*
      └─ @/modules/*
```

## Conclusion

By following these module isolation principles:

1. **Parallel Development**: Teams can work on different modules without conflicts
2. **Easier Testing**: Modules can be tested in isolation
3. **Better Maintainability**: Changes to one module don't break others
4. **Flexible Deployment**: Modules can be deployed independently (future: microservices)
5. **Clear Boundaries**: Each team owns their module's domain

This architecture scales from a small team working on all modules to multiple teams each owning specific modules.
