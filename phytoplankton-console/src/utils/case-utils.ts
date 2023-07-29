import { every, some, uniq, map } from 'lodash';
import { Assignment, CaseStatus, CaseStatusChange } from '@/apis';

export const statusInReview = (
  status: CaseStatus | undefined,
): status is
  | 'IN_REVIEW_OPEN'
  | 'IN_REVIEW_CLOSED'
  | 'IN_REVIEW_REOPENED'
  | 'IN_REVIEW_ESCALATED' => {
  return status?.startsWith('IN_REVIEW_') ?? false;
};

export const findLastStatusForInReview = (statusChanges: CaseStatusChange[]): CaseStatus => {
  const latestStatus = statusChanges
    .filter((statusChange) => !statusInReview(statusChange.caseStatus))
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
