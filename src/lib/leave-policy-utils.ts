import { format } from 'date-fns';
import { downloadFile } from './export-utils';

export interface LeavePolicyExport {
  version: string;
  exportedAt: string;
  sourceCompany?: string;
  leaveTypes: LeavePolicyItem[];
}

export interface LeavePolicyItem {
  name: string;
  code: string;
  description?: string;
  color?: string;
  default_days?: number;
  is_paid?: boolean;
  requires_approval?: boolean;
  requires_document?: boolean;
  max_consecutive_days?: number;
  min_notice_days?: number;
  accrual_rate?: number;
  carry_over_limit?: number;
}

export interface ImportResult {
  created: number;
  updated: number;
  skipped: number;
  errors: Array<{ code: string; message: string }>;
}

/**
 * Export leave types to JSON file
 */
export function exportLeavePolicies(
  leaveTypes: Array<{
    name: string;
    code: string;
    description?: string | null;
    color?: string | null;
    default_days?: number | null;
    is_paid?: boolean | null;
    requires_approval?: boolean | null;
    requires_document?: boolean | null;
    max_consecutive_days?: number | null;
    min_notice_days?: number | null;
    accrual_rate?: number | null;
    carry_over_limit?: number | null;
  }>,
  companyName?: string
): void {
  const exportData: LeavePolicyExport = {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    sourceCompany: companyName,
    leaveTypes: leaveTypes.map((lt) => ({
      name: lt.name,
      code: lt.code,
      description: lt.description || undefined,
      color: lt.color || undefined,
      default_days: lt.default_days ?? undefined,
      is_paid: lt.is_paid ?? undefined,
      requires_approval: lt.requires_approval ?? undefined,
      requires_document: lt.requires_document ?? undefined,
      max_consecutive_days: lt.max_consecutive_days ?? undefined,
      min_notice_days: lt.min_notice_days ?? undefined,
      accrual_rate: lt.accrual_rate ?? undefined,
      carry_over_limit: lt.carry_over_limit ?? undefined,
    })),
  };

  const jsonContent = JSON.stringify(exportData, null, 2);
  const filename = `leave-policies-${format(new Date(), 'yyyy-MM-dd')}.json`;
  downloadFile(jsonContent, filename, 'application/json');
}

/**
 * Parse and validate leave policy JSON file
 */
export async function parseLeavePolicyFile(file: File): Promise<LeavePolicyExport> {
  const text = await file.text();
  
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('Invalid JSON format. Please upload a valid JSON file.');
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Invalid file format. Expected a JSON object.');
  }

  const data = parsed as Record<string, unknown>;

  // Check for version
  if (!data.version || typeof data.version !== 'string') {
    throw new Error('Missing or invalid version field.');
  }

  // Check for leaveTypes array
  if (!Array.isArray(data.leaveTypes)) {
    throw new Error('Missing or invalid leaveTypes array.');
  }

  // Validate each leave type
  const validatedTypes: LeavePolicyItem[] = [];
  const errors: string[] = [];

  data.leaveTypes.forEach((item: unknown, index: number) => {
    if (!item || typeof item !== 'object') {
      errors.push(`Item ${index + 1}: Invalid format`);
      return;
    }

    const lt = item as Record<string, unknown>;

    // Required fields
    if (!lt.name || typeof lt.name !== 'string') {
      errors.push(`Item ${index + 1}: Missing or invalid 'name' field`);
      return;
    }

    if (!lt.code || typeof lt.code !== 'string') {
      errors.push(`Item ${index + 1}: Missing or invalid 'code' field`);
      return;
    }

    if (lt.code.length > 10) {
      errors.push(`Item ${index + 1}: Code '${lt.code}' exceeds 10 characters`);
      return;
    }

    // Validate optional fields
    const validatedItem: LeavePolicyItem = {
      name: lt.name,
      code: lt.code,
    };

    if (lt.description !== undefined) {
      if (typeof lt.description !== 'string') {
        errors.push(`Item ${index + 1}: Invalid 'description' type`);
        return;
      }
      validatedItem.description = lt.description;
    }

    if (lt.color !== undefined) {
      if (typeof lt.color !== 'string' || !/^#[0-9A-Fa-f]{6}$/i.test(lt.color)) {
        errors.push(`Item ${index + 1}: Invalid 'color' format (expected #XXXXXX)`);
        return;
      }
      validatedItem.color = lt.color;
    }

    if (lt.default_days !== undefined) {
      if (typeof lt.default_days !== 'number' || lt.default_days < 0) {
        errors.push(`Item ${index + 1}: Invalid 'default_days' (must be >= 0)`);
        return;
      }
      validatedItem.default_days = lt.default_days;
    }

    if (lt.is_paid !== undefined) {
      if (typeof lt.is_paid !== 'boolean') {
        errors.push(`Item ${index + 1}: Invalid 'is_paid' (must be boolean)`);
        return;
      }
      validatedItem.is_paid = lt.is_paid;
    }

    if (lt.requires_approval !== undefined) {
      if (typeof lt.requires_approval !== 'boolean') {
        errors.push(`Item ${index + 1}: Invalid 'requires_approval' (must be boolean)`);
        return;
      }
      validatedItem.requires_approval = lt.requires_approval;
    }

    if (lt.requires_document !== undefined) {
      if (typeof lt.requires_document !== 'boolean') {
        errors.push(`Item ${index + 1}: Invalid 'requires_document' (must be boolean)`);
        return;
      }
      validatedItem.requires_document = lt.requires_document;
    }

    if (lt.max_consecutive_days !== undefined) {
      if (typeof lt.max_consecutive_days !== 'number' || lt.max_consecutive_days < 0) {
        errors.push(`Item ${index + 1}: Invalid 'max_consecutive_days' (must be >= 0)`);
        return;
      }
      validatedItem.max_consecutive_days = lt.max_consecutive_days;
    }

    if (lt.min_notice_days !== undefined) {
      if (typeof lt.min_notice_days !== 'number' || lt.min_notice_days < 0) {
        errors.push(`Item ${index + 1}: Invalid 'min_notice_days' (must be >= 0)`);
        return;
      }
      validatedItem.min_notice_days = lt.min_notice_days;
    }

    if (lt.accrual_rate !== undefined) {
      if (typeof lt.accrual_rate !== 'number') {
        errors.push(`Item ${index + 1}: Invalid 'accrual_rate' (must be number)`);
        return;
      }
      validatedItem.accrual_rate = lt.accrual_rate;
    }

    if (lt.carry_over_limit !== undefined) {
      if (typeof lt.carry_over_limit !== 'number' || lt.carry_over_limit < 0) {
        errors.push(`Item ${index + 1}: Invalid 'carry_over_limit' (must be >= 0)`);
        return;
      }
      validatedItem.carry_over_limit = lt.carry_over_limit;
    }

    validatedTypes.push(validatedItem);
  });

  if (errors.length > 0) {
    throw new Error(`Validation errors:\n${errors.join('\n')}`);
  }

  if (validatedTypes.length === 0) {
    throw new Error('No valid leave types found in the file.');
  }

  return {
    version: data.version as string,
    exportedAt: (data.exportedAt as string) || '',
    sourceCompany: data.sourceCompany as string | undefined,
    leaveTypes: validatedTypes,
  };
}

/**
 * Download sample leave policy template
 */
export function downloadLeavePolicyTemplate(): void {
  const template: LeavePolicyExport = {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    sourceCompany: 'Sample Company',
    leaveTypes: [
      {
        name: 'Annual Leave',
        code: 'AL',
        description: 'Paid annual vacation leave',
        color: '#3B82F6',
        default_days: 20,
        is_paid: true,
        requires_approval: true,
        max_consecutive_days: 10,
        min_notice_days: 7,
        carry_over_limit: 5,
      },
      {
        name: 'Sick Leave',
        code: 'SL',
        description: 'Medical leave for illness',
        color: '#EF4444',
        default_days: 10,
        is_paid: true,
        requires_approval: false,
        requires_document: true,
      },
    ],
  };

  const jsonContent = JSON.stringify(template, null, 2);
  downloadFile(jsonContent, 'leave-policy-template.json', 'application/json');
}
