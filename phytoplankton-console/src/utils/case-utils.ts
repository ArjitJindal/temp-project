import { every, some, uniq, map, intersection } from 'lodash';
import { humanizeSnakeCase } from '@flagright/lib/utils/humanize';
import { DEFAULT_TIME_FORMAT } from './dayjs';
import { FLAGRIGHT_SYSTEM_USER, getDisplayedUserInfo } from './user-utils';
import { CASE_STATUSS } from '@/apis/models-custom/CaseStatus';
import { dayjs } from '@/utils/dayjs';
import { neverReturn } from '@/utils/lang';
import {
  Account,
  Alert,
  AlertStatus,
  Assignment,
  Case,
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

export const ALERT_GROUP_PREFIX = 'alert-';

export const statusEscalated = (
  status: CaseStatus | undefined,
): status is 'ESCALATED' | 'ESCALATED_IN_PROGRESS' | 'ESCALATED_ON_HOLD' => {
  return status?.startsWith('ESCALATED') ?? false;
};

export const statusEscalatedL2 = (
  status: CaseStatus | undefined,
): status is 'ESCALATED_L2' | 'ESCALATED_L2_IN_PROGRESS' | 'ESCALATED_L2_ON_HOLD' => {
  return status?.startsWith('ESCALATED_L2') ?? false;
};

export const getAssigneeName = (
  users: {
    [userId: string]: Account;
  },
  assigneeIds: string[] | undefined,
  caseStatus: CaseStatus | undefined,
) => {
  return assigneeIds
    ?.filter((assigneeId) => {
      const isL2Escalated = statusEscalatedL2(caseStatus);
      return isL2Escalated
        ? users[assigneeId]?.escalationLevel === 'L2'
        : users[assigneeId]?.escalationLevel !== 'L2';
    })
    .map((id) => users[id]?.name ?? users[id]?.email ?? id)
    .join(', ');
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

export const canMutateEscalatedCases = (
  cases: Record<string, { reviewAssignments?: Assignment[] }>,
  userId: string,
  isMultiLevelEscalationEnabled: boolean,
): boolean => {
  return isMultiLevelEscalationEnabled ? canReviewCases(cases, userId) : true;
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

export const isEscalatedCases = (
  cases: Record<string, { caseStatus?: CaseStatus; alertStatus?: CaseStatus }>,
  alert?: boolean,
): boolean => {
  return some(cases, (c) => statusEscalated(alert ? c.alertStatus : c.caseStatus));
};

export const isEscalatedL2Cases = (
  cases: Record<string, { caseStatus?: CaseStatus; alertStatus?: CaseStatus }>,
  alert?: boolean,
): boolean => {
  return some(cases, (c) => statusEscalatedL2(alert ? c.alertStatus : c.caseStatus));
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

export const getNextStatus = (
  status: CaseStatus | AlertStatus | undefined,
): CaseStatus | AlertStatus => {
  if (status == null) {
    return 'CLOSED';
  }
  switch (status) {
    case 'REOPENED':
    case 'OPEN':
    case 'ESCALATED':
      return 'CLOSED';
    case 'OPEN_IN_PROGRESS':
    case 'OPEN_ON_HOLD':
      return 'OPEN';
    case 'ESCALATED_IN_PROGRESS':
    case 'ESCALATED_ON_HOLD':
      return 'ESCALATED';
    case 'CLOSED':
      return 'REOPENED';
    case 'IN_REVIEW_OPEN':
      return 'OPEN';
    case 'IN_REVIEW_CLOSED':
      return 'CLOSED';
    case 'IN_REVIEW_REOPENED':
      return 'REOPENED';
    case 'IN_REVIEW_ESCALATED':
      return 'ESCALATED';
    case 'ESCALATED_L2_IN_PROGRESS':
    case 'ESCALATED_L2_ON_HOLD':
      return 'ESCALATED_L2';
    case 'ESCALATED_L2':
      return 'CLOSED';
    default:
      return neverReturn(status, status);
  }
};

export const getNextStatusFromInReview = (status: CaseStatus): CaseStatus => {
  return status.replace('IN_REVIEW_', '') as CaseStatus;
};

export const isOnHoldOrInProgressOrEscalated = (status: CaseStatus | null | undefined): boolean => {
  if (status == null) {
    return false;
  }
  return [
    'OPEN_IN_PROGRESS',
    'OPEN_ON_HOLD',
    'ESCALATED_IN_PROGRESS',
    'ESCALATED_ON_HOLD',
    'ESCALATED',
    'ESCALATED_L2',
    'ESCALATED_L2_IN_PROGRESS',
    'ESCALATED_L2_ON_HOLD',
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
    case 'IN_REVIEW':
    case 'IN_REVIEW_OPEN':
    case 'IN_REVIEW_CLOSED':
    case 'IN_REVIEW_ESCALATED':
    case 'IN_REVIEW_REOPENED':
      return 'IN_REVIEW';
    case 'IN_PROGRESS':
    case 'OPEN_IN_PROGRESS':
    case 'ESCALATED_IN_PROGRESS':
      return 'IN_PROGRESS';
    case 'ON_HOLD':
    case 'OPEN_ON_HOLD':
    case 'ESCALATED_ON_HOLD':
      return 'ON_HOLD';
    case 'ESCALATED_L2':
    case 'ESCALATED_L2_IN_PROGRESS':
    case 'ESCALATED_L2_ON_HOLD':
      return 'ESCALATED_L2';
  }
};

// Explodes derived statuses to all their available statuses, for example "IN_REVIEW" becomes "IN_REVIEW_OPEN", "IN_REVIEW_CLOSED", "IN_REVIEW_ESCALATED"...
export const getStatuses = (
  status?: (DerivedStatus | undefined)[] | null,
): (CaseStatus | AlertStatus)[] => {
  let selectedStatus;

  if (status?.includes('IN_REVIEW')) {
    selectedStatus = [
      ...['IN_REVIEW_OPEN', 'IN_REVIEW_ESCALATED', 'IN_REVIEW_CLOSED', 'IN_REVIEW_REOPENED'],
    ];
  }

  if (status?.includes('IN_PROGRESS')) {
    selectedStatus = [...(selectedStatus ?? []), ...['OPEN_IN_PROGRESS', 'ESCALATED_IN_PROGRESS']];
  }

  if (status?.includes('ON_HOLD')) {
    selectedStatus = [...(selectedStatus ?? []), ...['OPEN_ON_HOLD', 'ESCALATED_ON_HOLD']];
  }

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
            : getDisplayedUserInfo(users?.[comment?.userId ?? '']).name
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
  type?: 'STATUS_CHANGE',
) {
  const filteredComments = comments?.filter((comment) => comment.type === type);
  {
    let commentData = '';
    if (filteredComments?.length) {
      commentData += `${humanizeSnakeCase(type ?? 'OTHER')} comments :\n\n`;
    }
    commentData += commentsToString(filteredComments ?? [], users);
    commentData += '\n\n';

    alerts?.forEach((alert, i) => {
      const filteredAlertComments = alert.comments?.filter((comment) => comment.type === type);
      if (filteredAlertComments?.length) {
        commentData += `\n\nAlert ${alert.alertId}\n\n`;
      }
      commentData += commentsToString(filteredAlertComments ?? [], users);

      if (i < alerts.length - 1) {
        commentData += '\n\n';
      }
    });

    return commentData;
  }
}

export function getAssignmentsToShow(item: Case | Alert): Assignment[] | undefined {
  const status = 'caseStatus' in item ? item.caseStatus : (item as Alert).alertStatus;
  const isStatusEscalatedL2 = statusEscalatedL2(status);
  const isItemEscalated = statusEscalated(status);
  const isItemInReview = statusInReview(status);

  if (isStatusEscalatedL2) {
    return item.reviewAssignments?.filter((assignment) => assignment?.escalationLevel === 'L2');
  }

  if (isItemEscalated || isItemInReview) {
    const l1Assignments = item.reviewAssignments?.filter(
      (assignment) => assignment?.escalationLevel === 'L1',
    );

    if (l1Assignments?.length && isItemEscalated) {
      return l1Assignments;
    }

    return item.reviewAssignments?.filter((assignment) => assignment?.escalationLevel !== 'L2');
  }

  return item.assignments;
}
