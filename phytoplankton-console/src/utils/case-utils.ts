import { every, some, uniq, map, intersection } from 'lodash';
import { DEFAULT_TIME_FORMAT } from './dayjs';
import { getAccountUserName } from './account';
import { FLAGRIGHT_SYSTEM_USER } from './user-utils';
import { CASE_STATUSS } from '@/apis/models-custom/CaseStatus';
import { dayjs } from '@/utils/dayjs';
import {
  Account,
  Alert,
  AlertStatus,
  Assignment,
  CaseStatus,
  CaseStatusChange,
  Comment,
  DerivedStatus,
} from '@/apis';

export const statusInReview = (
  status: CaseStatus | undefined | DerivedStatus,
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
    .filter((statusChanges) => statusChanges?.caseStatus)
    .filter(
      (statusChange) =>
        !(
          statusInReview(statusChange.caseStatus) ||
          statusInProgressOrOnHold(statusChange.caseStatus)
        ),
    )
    .sort((a, b) => {
      return b?.timestamp - a?.timestamp;
    })[0];

  return latestStatus?.caseStatus ?? 'OPEN';
};

export const statusInProgressOrOnHold = (status: CaseStatus | undefined): boolean => {
  return (status?.endsWith('IN_PROGRESS') || status?.endsWith('ON_HOLD')) ?? false;
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

export const getDerivedStatus = (s: CaseStatus | AlertStatus | DerivedStatus): DerivedStatus => {
  switch (s) {
    case 'OPEN':
      return 'OPEN';
    case 'CLOSED':
      return 'CLOSED';
    case 'REOPENED':
      return 'REOPENED';
    case 'ESCALATED':
      return 'ESCALATED';
    case 'IN_REVIEW_OPEN':
    case 'IN_REVIEW_CLOSED':
    case 'IN_REVIEW_ESCALATED':
    case 'IN_REVIEW_REOPENED':
      return 'IN_REVIEW';
    case 'OPEN_IN_PROGRESS':
    case 'ESCALATED_IN_PROGRESS':
      return 'IN_PROGRESS';
    case 'OPEN_ON_HOLD':
    case 'ESCALATED_ON_HOLD':
      return 'ON_HOLD';
  }
  return s;
};

// Explodes derived statuses to all their available statuses, for example "IN_REVIEW" becomes "IN_REVIEW_OPEN", "IN_REVIEW_CLOSED", "IN_REVIEW_ESCALATED"...
export const getStatuses = (
  status?: (DerivedStatus | undefined)[],
): (CaseStatus | AlertStatus)[] => {
  let selectedStatus;

  if (status?.includes('IN_REVIEW'))
    selectedStatus = [
      ...['IN_REVIEW_OPEN', 'IN_REVIEW_ESCALATED', 'IN_REVIEW_CLOSED', 'IN_REVIEW_REOPENED'],
    ];

  if (status?.includes('IN_PROGRESS'))
    selectedStatus = [...(selectedStatus ?? []), ...['OPEN_IN_PROGRESS', 'ESCALATED_IN_PROGRESS']];

  if (status?.includes('ON_HOLD'))
    selectedStatus = [...(selectedStatus ?? []), ...['OPEN_ON_HOLD', 'ESCALATED_ON_HOLD']];

  selectedStatus = [...(selectedStatus ?? []), ...intersection(status, CASE_STATUSS)]; // Get the status which are as we store

  return selectedStatus;
};

export function commentsToString(comments: Comment[], users: { [userId: string]: Account }) {
  return comments?.reduce((commentData, comment, currentIndex) => {
    commentData += `${comment.body}`;
    commentData += comment.createdAt
      ? `\n\nAdded on: ${dayjs(comment.createdAt).format(DEFAULT_TIME_FORMAT)}`
      : '';
    commentData += comment.userId
      ? `${comment.createdAt ? ' ' : '\n'}Added by: ${
          comment.userId === FLAGRIGHT_SYSTEM_USER
            ? FLAGRIGHT_SYSTEM_USER
            : getAccountUserName(users?.[comment?.userId ?? ''])
        }`
      : '';
    commentData += comment.files?.length ? `\n\n${comment.files.length} attachment(s) added` : '';

    return commentData && currentIndex < comments.length - 1 ? `${commentData}\n\n\n` : commentData;
  }, '');
}

export function casesCommentsGenerator(
  comments: Comment[],
  alerts: Alert[],
  users: { [userId: string]: Account },
) {
  {
    let commentData = '';

    if (comments?.length) {
      commentData += 'Other comments\n\n';
    }

    commentData += commentsToString(comments ?? [], users);
    commentData += '\n\n';

    alerts?.forEach((alert, i) => {
      if (alert.comments?.length) {
        commentData += `\n\nAlert ${alert.alertId}\n\n`;
      }

      commentData += commentsToString(alert.comments ?? [], users);

      if (i < alerts.length - 1) {
        commentData += '\n\n';
      }
    });

    return commentData;
  }
}
