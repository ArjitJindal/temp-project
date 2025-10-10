import { hasExactPermission } from './base-permission-filter';
import { CaseStatus, DerivedStatus } from '@/apis';
import { useResources } from '@/components/AppWrapper/Providers/SettingsProvider';

/**
 * Case status specific resource mapping
 */
const CASE_RESOURCE_TO_STATUSES: Record<
  string,
  { caseStatuses: CaseStatus[]; derivedStatuses: DerivedStatus[] }
> = {
  'case-management/case-status/open/*': {
    caseStatuses: ['OPEN'],
    derivedStatuses: ['OPEN'],
  },
  'case-management/case-status/reopened/*': {
    caseStatuses: ['REOPENED'],
    derivedStatuses: ['REOPENED'],
  },
  'case-management/case-status/on-hold/*': {
    caseStatuses: ['OPEN_ON_HOLD', 'ESCALATED_ON_HOLD'],
    derivedStatuses: ['ON_HOLD'],
  },
  'case-management/case-status/escalated-l2/*': {
    caseStatuses: ['ESCALATED_L2', 'ESCALATED_L2_IN_PROGRESS', 'ESCALATED_L2_ON_HOLD'],
    derivedStatuses: ['ESCALATED_L2'],
  },
  'case-management/case-status/escalated/*': {
    caseStatuses: ['ESCALATED', 'ESCALATED_IN_PROGRESS'],
    derivedStatuses: ['ESCALATED'],
  },
  'case-management/case-status/closed/*': {
    caseStatuses: ['CLOSED'],
    derivedStatuses: ['CLOSED'],
  },
  'case-management/case-status/in-review/*': {
    caseStatuses: [
      'IN_REVIEW_OPEN',
      'IN_REVIEW_CLOSED',
      'IN_REVIEW_REOPENED',
      'IN_REVIEW_ESCALATED',
    ],
    derivedStatuses: ['IN_REVIEW'],
  },
  'case-management/case-status/in-progress/*': {
    caseStatuses: ['OPEN_IN_PROGRESS'],
    derivedStatuses: ['IN_PROGRESS'],
  },
};

/**
 * Get allowed case statuses from user permissions
 */
export function getCaseStatusesFromPermissions(statements: any[]): CaseStatus[] {
  const allowedStatuses = new Set<CaseStatus>();

  Object.entries(CASE_RESOURCE_TO_STATUSES).forEach(([resource, { caseStatuses }]) => {
    if (hasExactPermission(statements, resource)) {
      caseStatuses.forEach((status) => allowedStatuses.add(status));
    }
  });

  return Array.from(allowedStatuses);
}

/**
 * Hook to get allowed case statuses from user permissions
 */
export function useCaseStatusesFromPermissions(): CaseStatus[] {
  const { statements } = useResources();
  return getCaseStatusesFromPermissions(statements);
}

/**
 * Get allowed derived statuses from user permissions
 */
export function getDerivedStatusesFromPermissions(statements: any[]): DerivedStatus[] {
  const allowedStatuses = new Set<DerivedStatus>();

  Object.entries(CASE_RESOURCE_TO_STATUSES).forEach(([resource, { derivedStatuses }]) => {
    const hasPermission = hasExactPermission(statements, resource);

    if (hasPermission) {
      derivedStatuses.forEach((status) => allowedStatuses.add(status));
    }
  });

  return Array.from(allowedStatuses);
}

/**
 * Hook to get allowed derived statuses from user permissions
 */
export function useDerivedStatusesFromPermissions(): DerivedStatus[] {
  const { statements } = useResources();
  return getDerivedStatusesFromPermissions(statements);
}

/**
 * Get the first available derived status from user permissions (for fallback/default purposes)
 */
export function getFirstAvailableDerivedStatus(statements: any[]): DerivedStatus | null {
  const allowedStatuses = getDerivedStatusesFromPermissions(statements);
  return allowedStatuses.length > 0 ? allowedStatuses[0] : null;
}

/**
 * Hook to get the first available derived status from user permissions
 */
export function useFirstAvailableDerivedStatus(): DerivedStatus | null {
  const { statements } = useResources();
  return getFirstAvailableDerivedStatus(statements);
}

// Keep the old function for backward compatibility
export function getCaseStatusResource(status: string): string {
  switch (status) {
    case 'OPEN':
    case 'REOPENED':
      return 'case-management/case-status/open/*';

    case 'OPEN_ON_HOLD':
    case 'ESCALATED_ON_HOLD':
      return 'case-management/case-status/on-hold/*';

    case 'ESCALATED_L2':
    case 'ESCALATED_L2_IN_PROGRESS':
    case 'ESCALATED_L2_ON_HOLD':
      return 'case-management/case-status/escalated-l2/*';

    case 'ESCALATED':
    case 'ESCALATED_IN_PROGRESS':
      return 'case-management/case-status/escalated/*';

    case 'CLOSED':
      return 'case-management/case-status/closed/*';

    case 'IN_REVIEW_OPEN':
    case 'IN_REVIEW_CLOSED':
    case 'IN_REVIEW_REOPENED':
    case 'IN_REVIEW_ESCALATED':
      return 'case-management/case-status/in-review/*';

    case 'OPEN_IN_PROGRESS':
      return 'case-management/case-status/in-progress/*';

    default:
      return 'case-management/case-status/open/*';
  }
}
