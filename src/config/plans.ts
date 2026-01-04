import { ModuleId } from './modules';

export interface PlanFeatures {
  modules: ModuleId[] | 'all';
  maxEmployees: number | null;
  maxStorageGb: number;
  support: 'community' | 'email' | 'priority' | 'dedicated';
  sso: boolean;
  api: boolean;
  audit: boolean;
}

export interface Plan {
  id: string;
  name: string;
  features: PlanFeatures;
}

export const PLAN_MODULES: Record<string, ModuleId[]> = {
  Free: ['employees', 'directory'],
  Basic: ['employees', 'directory', 'leave', 'time_tracking'],
  Pro: ['employees', 'directory', 'leave', 'time_tracking', 'documents', 'recruitment', 'performance'],
  Enterprise: ['employees', 'directory', 'leave', 'time_tracking', 'documents', 'recruitment', 'performance', 'payroll', 'compliance', 'audit', 'integrations'], // Or uses 'all'
};

export const hasModuleAccess = (
  planFeatures: PlanFeatures | null,
  moduleId: ModuleId
): boolean => {
  if (!planFeatures) return false;
  if (planFeatures.modules === 'all') return true;
  return planFeatures.modules.includes(moduleId);
};

export const isEnterpriseFeature = (feature: 'sso' | 'api' | 'audit'): boolean => {
  return true; // These are enterprise-only features
};
