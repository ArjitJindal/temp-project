import { every, some, uniq, map } from 'lodash';
import { neverReturn } from './lang';
import { AlertStatus, Assignment, CaseStatus, CaseStatusChange } from '@/apis';

export const statusInReview = (
  status: CaseStatus | undefined,
): status is
  | 'IN_REVIEW_OPEN'
  | 'IN_REVIEW_CLOSED'
  | 'IN_REVIEW_REOPENED'
  | 'IN_REVIEW_ESCALATED' => {
  return status?.startsWith('IN_REVIEW') ?? false;
};

export const statusEscalated = (
  status: CaseStatus | undefined,
): status is 'ESCALATED' | 'ESCALATED_IN_PROGRESS' | 'ESCALATED_ON_HOLD' => {
  return status?.startsWith('ESCALATED') ?? false;
};

export const findLastStatusForInReview = (statusChanges: CaseStatusChange[]): CaseStatus => {
  const latestStatus = statusChanges
    .filter(
      (statusChange) =>
        !(
          statusInReview(statusChange.caseStatus) ||
          [
            'OPEN_IN_PROGRESS',
            'OPEN_ON_HOLD',
            'ESCALATED_IN_PROGRESS',
            'ESCALATED_ON_HOLD',
          ].includes(statusChange.caseStatus ?? '')
        ),
    )
    .sort((a, b) => {
      return b.timestamp - a.timestamp;
    })[0];

  return latestStatus?.caseStatus ?? 'OPEN';
};

export const canReviewCases = (
  cases: Record<string, { reviewAssignments?: Assignment[] }>,
  userId: string,
): boolean => {
  return every(cases, (c) => some(c.reviewAssignments, (r) => r.assigneeUserId === userId));
};

export const isInReviewCases = (
  cases: Record<string, { caseStatus?: CaseStatus; alertStatus?: CaseStatus }>,
  alert?: boolean,
): boolean => {
  return some(cases, (c) => statusInReview(alert ? c.alertStatus : c.caseStatus));
};

export const getSingleCaseStatusCurrent = (
  cases: Record<string, { caseStatus?: CaseStatus; alertStatus?: CaseStatus }>,
  alert?: boolean,
): [CaseStatus, boolean] => {
  const caseStatuses = uniq(map(cases, `${alert ? 'alertStatus' : 'caseStatus'}`));
  const isSingleCaseStatus = caseStatuses.length <= 1;
  const caseStatus = caseStatuses[0] ?? 'OPEN';

  return [caseStatus, isSingleCaseStatus];
};

export const getSingleCaseStatusPreviousForInReview = (
  cases: Record<string, { statusChanges?: CaseStatusChange[] }>,
): [CaseStatus, boolean] => {
  const caseStatuses = uniq(map(cases, (c) => findLastStatusForInReview(c.statusChanges ?? [])));
  const isSingleCaseStatus = caseStatuses.length <= 1;
  const caseStatus = caseStatuses[0] ?? 'OPEN';

  return [caseStatus, isSingleCaseStatus];
};

export const getNextStatusFromInReview = (status: CaseStatus): CaseStatus => {
  return status.replace('IN_REVIEW_', '') as CaseStatus;
};

export const isOnHoldOrInProgress = (status: CaseStatus): boolean => {
  return [
    'OPEN_IN_PROGRESS',
    'OPEN_ON_HOLD',
    'ESCALATED_IN_PROGRESS',
    'ESCALATED_ON_HOLD',
  ].includes(status);
};

export const getStatuses = (
  status: CaseStatus | AlertStatus | 'IN_REVIEW' | 'ON_HOLD' | 'IN_PROGRESS' | undefined,
): (CaseStatus | AlertStatus)[] => {
  switch (status) {
    case undefined:
      return [];
    case 'OPEN':
    case 'REOPENED':
      return ['OPEN', 'REOPENED'];
    case 'IN_REVIEW':
      return ['IN_REVIEW_OPEN', 'IN_REVIEW_ESCALATED', 'IN_REVIEW_CLOSED', 'IN_REVIEW_REOPENED'];
    case 'IN_REVIEW_OPEN':
    case 'IN_REVIEW_ESCALATED':
    case 'IN_REVIEW_CLOSED':
    case 'IN_REVIEW_REOPENED':
    case 'OPEN_IN_PROGRESS':
    case 'OPEN_ON_HOLD':
    case 'ESCALATED_IN_PROGRESS':
    case 'ESCALATED_ON_HOLD':
    case 'CLOSED':
    case 'ESCALATED':
      return [status];
    case 'IN_PROGRESS':
      return ['OPEN_IN_PROGRESS', 'ESCALATED_IN_PROGRESS'];
    case 'ON_HOLD':
      return ['OPEN_ON_HOLD', 'ESCALATED_ON_HOLD'];
    default:
      return neverReturn<CaseStatus[]>(status, []);
  }
};
