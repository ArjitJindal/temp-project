import { hasExactPermission } from './base-permission-filter';
import { AlertStatus, DerivedStatus } from '@/apis';
import { useResources } from '@/components/AppWrapper/Providers/SettingsProvider';

/**
 * Alert status specific resource mapping
 */
const ALERT_RESOURCE_TO_STATUSES: Record<
  string,
  { alertStatuses: AlertStatus[]; derivedStatuses: DerivedStatus[] }
> = {
  'case-management/alert-status/open/*': {
    alertStatuses: ['OPEN'],
    derivedStatuses: ['OPEN'],
  },
  'case-management/alert-status/reopened/*': {
    alertStatuses: ['REOPENED'],
    derivedStatuses: ['REOPENED'],
  },
  'case-management/alert-status/on-hold/*': {
    alertStatuses: ['OPEN_ON_HOLD', 'ESCALATED_ON_HOLD'],
    derivedStatuses: ['ON_HOLD'],
  },
  'case-management/alert-status/escalated-l2/*': {
    alertStatuses: ['ESCALATED_L2', 'ESCALATED_L2_IN_PROGRESS', 'ESCALATED_L2_ON_HOLD'],
    derivedStatuses: ['ESCALATED_L2'],
  },
  'case-management/alert-status/escalated/*': {
    alertStatuses: ['ESCALATED', 'ESCALATED_IN_PROGRESS'],
    derivedStatuses: ['ESCALATED'],
  },
  'case-management/alert-status/closed/*': {
    alertStatuses: ['CLOSED'],
    derivedStatuses: ['CLOSED'],
  },
  'case-management/alert-status/in-review/*': {
    alertStatuses: [
      'IN_REVIEW_OPEN',
      'IN_REVIEW_CLOSED',
      'IN_REVIEW_REOPENED',
      'IN_REVIEW_ESCALATED',
    ],
    derivedStatuses: ['IN_REVIEW'],
  },
  'case-management/alert-status/in-progress/*': {
    alertStatuses: ['OPEN_IN_PROGRESS'],
    derivedStatuses: ['IN_PROGRESS'],
  },
};

/**
 * Get allowed alert statuses from user permissions
 */
export function getAlertStatusesFromPermissions(statements: any[]): AlertStatus[] {
  const allowedStatuses = new Set<AlertStatus>();

  Object.entries(ALERT_RESOURCE_TO_STATUSES).forEach(([resource, { alertStatuses }]) => {
    if (hasExactPermission(statements, resource)) {
      alertStatuses.forEach((status) => allowedStatuses.add(status));
    }
  });
  return Array.from(allowedStatuses);
}

/**
 * Hook to get allowed alert statuses from user permissions
 */
export function useAlertStatusesFromPermissions(): AlertStatus[] {
  const { statements } = useResources();
  return getAlertStatusesFromPermissions(statements);
}

/**
 * Get allowed derived statuses for alerts from user permissions
 */
export function getDerivedAlertStatusesFromPermissions(statements: any[]): DerivedStatus[] {
  const allowedStatuses = new Set<DerivedStatus>();

  Object.entries(ALERT_RESOURCE_TO_STATUSES).forEach(([resource, { derivedStatuses }]) => {
    if (hasExactPermission(statements, resource)) {
      derivedStatuses.forEach((status) => allowedStatuses.add(status));
    }
  });

  return Array.from(allowedStatuses);
}

/**
 * Hook to get allowed derived statuses for alerts from user permissions
 */
export function useDerivedAlertStatusesFromPermissions(): DerivedStatus[] {
  const { statements } = useResources();
  return getDerivedAlertStatusesFromPermissions(statements);
}

/**
 * Get the first available derived alert status from user permissions (for fallback/default purposes)
 */
export function getFirstAvailableDerivedAlertStatus(statements: any[]): DerivedStatus | null {
  const allowedStatuses = getDerivedAlertStatusesFromPermissions(statements);
  return allowedStatuses.length > 0 ? allowedStatuses[0] : null;
}

/**
 * Hook to get the first available derived alert status from user permissions
 */
export function useFirstAvailableDerivedAlertStatus(): DerivedStatus | null {
  const { statements } = useResources();
  return getFirstAvailableDerivedAlertStatus(statements);
}
