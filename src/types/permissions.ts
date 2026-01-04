// Permission system types

export type PermissionModule = 
  | 'dashboard'
  | 'employees'
  | 'departments'
  | 'leave'
  | 'time_tracking'
  | 'documents'
  | 'recruitment'
  | 'performance'
  | 'payroll'
  | 'expenses'
  | 'compliance'
  | 'audit'
  | 'integrations'
  | 'settings'
  | 'users'
  | 'shifts'
  | 'attendance'
  | 'my_team';

export type PermissionAction = 
  | 'read'
  | 'create'
  | 'update'
  | 'delete'
  | 'approve'
  | 'process'
  | 'verify'
  | 'export'
  | 'manage'
  | 'lock';

export interface Permission {
  id: string;
  module: PermissionModule;
  action: PermissionAction;
  name: string;
  description: string | null;
}

export interface UserPermission {
  permission_id: string;
  module: PermissionModule;
  action: PermissionAction;
  name: string;
  has_permission: boolean;
  source: 'explicit_allow' | 'explicit_deny' | 'role' | 'super_admin' | 'none';
}

export interface RolePermission {
  permission_id: string;
  module: PermissionModule;
  action: PermissionAction;
  name: string;
  is_granted: boolean;
}

// Module display names for UI
export const MODULE_LABELS: Record<PermissionModule, string> = {
  dashboard: 'Dashboard',
  employees: 'Employees',
  departments: 'Departments',
  leave: 'Leave Management',
  time_tracking: 'Time Tracking',
  documents: 'Documents',
  recruitment: 'Recruitment',
  performance: 'Performance',
  payroll: 'Payroll',
  expenses: 'Expenses',
  compliance: 'Compliance',
  audit: 'Audit Logs',
  integrations: 'Integrations',
  settings: 'Settings',
  users: 'Users',
  shifts: 'Shift Management',
  attendance: 'Attendance',
  my_team: 'My Team',
};

// Action display names for UI
export const ACTION_LABELS: Record<PermissionAction, string> = {
  read: 'View',
  create: 'Create',
  update: 'Edit',
  delete: 'Delete',
  approve: 'Approve',
  process: 'Process',
  verify: 'Verify',
  export: 'Export',
  manage: 'Manage',
  lock: 'Lock',
};

// Action icons for UI (using lucide icon names)
export const ACTION_ICONS: Record<PermissionAction, string> = {
  read: 'Eye',
  create: 'Plus',
  update: 'Pencil',
  delete: 'Trash2',
  approve: 'CheckCircle',
  process: 'Play',
  verify: 'ShieldCheck',
  export: 'Download',
  manage: 'Settings',
  lock: 'Lock',
};
