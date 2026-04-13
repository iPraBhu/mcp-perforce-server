import { SecurityManager } from '../p4/security.js';

export type SanitizeInputType = 'filespec' | 'pattern' | 'path';

export function mergeStringArgs(singular?: string, plural?: string[]): string[] {
  const values: string[] = [];

  if (typeof singular === 'string') {
    values.push(singular);
  }

  if (Array.isArray(plural)) {
    values.push(...plural);
  }

  return Array.from(new Set(values));
}

export function validateStringList(values: string[], label: string): { valid: boolean; error?: string } {
  if (!Array.isArray(values)) {
    return { valid: false, error: `${label} must be an array` };
  }

  if (values.length === 0) {
    return { valid: false, error: `${label} cannot be empty` };
  }

  if (values.length > 1000) {
    return { valid: false, error: `too many ${label} (maximum 1000)` };
  }

  for (const value of values) {
    if (typeof value !== 'string') {
      return { valid: false, error: `all ${label} must be strings` };
    }
    if (value.trim().length === 0) {
      return { valid: false, error: `${label} cannot contain empty strings` };
    }
  }

  return { valid: true };
}

export function sanitizeStringList(
  security: SecurityManager,
  values: string[],
  type: SanitizeInputType,
  label: string
): { valid: boolean; values?: string[]; error?: string } {
  const validation = validateStringList(values, label);
  if (!validation.valid) {
    return { valid: false, error: validation.error };
  }

  const sanitized: string[] = [];
  for (const value of values) {
    const result = security.sanitizeInput(value, type);
    if (!result.valid) {
      return {
        valid: false,
        error: `Invalid ${label}: ${result.warnings.join(', ')}`,
      };
    }
    sanitized.push(result.sanitized);
  }

  return {
    valid: true,
    values: Array.from(new Set(sanitized)),
  };
}
