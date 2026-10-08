export type ValidationSeverity = 'error' | 'warning' | 'info';

export interface ValidationIssue {
  id: string;
  ruleId: string;
  severity: ValidationSeverity;
  message: string;
  objectRefs: string[]; // IDs of components or connections involved
  suggestion?: string;
}
