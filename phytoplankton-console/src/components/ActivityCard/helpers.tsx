import React, { ReactElement } from 'react';
import { capitalize, has } from 'lodash';
import { getRiskLevelFromScore } from '@flagright/lib/utils';
import { firstLetterUpper, humanizeAuto } from '@flagright/lib/utils/humanize';
import { LogItemData } from './LogCard/LogContainer/LogItem';
import { Assignment, AuditLog, Case, CaseStatus, RiskClassificationScore } from '@/apis';
import { dayjs, DEFAULT_DATE_FORMAT } from '@/utils/dayjs';
import { RISK_LEVEL_LABELS } from '@/utils/risk-levels';
import { formatDuration, getDuration } from '@/utils/time-utils';
import { AnyAccount, getAccountUserName, getDisplayedUserInfo } from '@/utils/user-utils';
import { statusEscalated, statusEscalatedL2 } from '@/utils/case-utils';
import CaseIcon from '@/components/ui/icons/Remix/business/stack-line.react.svg';
import Avatar from '@/components/library/Avatar';

export const isActionUpdate = (log: AuditLog): boolean => {
  return log.action === 'UPDATE';
};

export const isActionCreate = (log: AuditLog): boolean => {
  return log.action === 'CREATE';
};

export const isActionEscalate = (log: AuditLog): boolean => {
  return log.action === 'ESCALATE';
};

export const isActionDelete = (log: AuditLog): boolean => {
  return log.action === 'DELETE';
};

export const getCreateStatement = (
  log: AuditLog,
  users: { [userId: string]: AnyAccount },
  type: 'USER' | 'CASE',
  riskClassificationValues: Array<RiskClassificationScore>,
  riskLevelAlias: Record<string, string> = {},
): ReactElement | null => {
  const user = log.user?.id ? users[log.user?.id] : undefined;
  const userName = user ? (user.role === 'root' ? 'system' : getAccountUserName(user)) : 'system';
  const entityType = log.type;
  const entityId = log.entityId;
  const subtype = extractSubtype(log) as AuditLog['subtype'];
  const assignees = getAssignee(log?.newImage, users) ?? [];
  const { makerUserName, checkerUserName } = getAssignmentDetails({
    defaultUserName: userName,
    users,
    reviewAssignments: log.newImage?.reviewAssignments ?? [],
  });

  const getRiskLevelLabelWithAlias = (riskLevel: string): string => {
    return (
      riskLevelAlias[riskLevel] || RISK_LEVEL_LABELS[riskLevel as keyof typeof RISK_LEVEL_LABELS]
    );
  };

  switch (subtype) {
    case 'COMMENT': {
      let actionStatement: string = '';
      if (log.action === 'CREATE' && log?.newImage) {
        actionStatement = 'added';
      } else if (log.action === 'UPDATE' && log?.newImage) {
        actionStatement = 'edited';
      } else if (log.action === 'DELETE') {
        actionStatement = 'deleted';
      } else {
        actionStatement = '';
      }
      return (log.action === 'CREATE' && log?.newImage) || log.action !== 'CREATE' ? (
        <>
          <b>{firstLetterUpper(userName)}</b> {actionStatement} a comment{' '}
        </>
      ) : null;
    }
    case 'CREATION': {
      const status = log.newImage?.[`${entityType.toLowerCase()}Status`];
      const isAutomaticStatus = status !== 'OPEN';
      const displayStatus = status === 'CLOSED' ? 'closed' : 'on hold';
      return (
        <>
          A new {entityType.toLowerCase()} <b>{entityId}</b> is created by <b>{userName}</b> and
          {isAutomaticStatus && entityType === 'ALERT'
            ? ` was set automatically to ${displayStatus}`
            : ' is unassigned'}
        </>
      );
    }
    case 'MANUAL_CASE_CREATION': {
      const numberOfTransactions = (log.newImage as Case).caseTransactionsIds?.length;
      return (
        <>
          A new case <b>{entityId}</b> is created by <b>{userName}</b> with
          {numberOfTransactions
            ? ` ${numberOfTransactions} transactions with transaction ids ${(
                <b>{log.newImage.caseTransactionsIds?.join(', ')}</b>
              )}`
            : ' no transactions'}
        </>
      );
    }
    case 'MANUAL_CASE_TRANSACTIONS_ADDITION': {
      const oldCaseTransactionsIds = (log.oldImage as Case).caseTransactionsIds;
      const newCaseTransactionsIds = (log.newImage as Case).caseTransactionsIds;

      const addedTransactions = newCaseTransactionsIds?.filter(
        (transactionId) => !oldCaseTransactionsIds?.includes(transactionId),
      );

      return (
        <>
          {addedTransactions?.length
            ? `${addedTransactions.length} transactions with transaction ids ${(
                <b>{addedTransactions.join(', ')}</b>
              )} are added to case ${entityId} by ${userName}`
            : `No transactions are added to case ${entityId} by ${userName}`}
        </>
      );
    }
    case 'ASSIGNMENT': {
      const assigneeUserIds = assignees
        .map((assignee: any) => assignee?.name ?? assignee?.email)
        .filter((name: any) => name != undefined);
      const assignedTo = assigneeUserIds.length ? (
        <>
          assigned to <b>{assigneeUserIds.join(', ')}</b>{' '}
        </>
      ) : (
        `unassigned`
      );
      const reviewText = has(log.newImage, 'reviewAssignments') ? 'for review' : '';
      return (
        <>
          {firstLetterUpper(entityType.toLowerCase())} <b>{entityId}</b> is {assignedTo}{' '}
          {reviewText}
        </>
      );
    }
    case 'STATUS_CHANGE': {
      const entityStatus = log?.newImage[`${entityType.toLowerCase()}Status`];
      const previousStatus = log.oldImage[`${entityType.toLowerCase()}Status`];
      if (!entityStatus || (entityStatus !== 'ESCALATED' && previousStatus === entityStatus)) {
        return null;
      }
      if (entityStatus.includes('ESCALATED') && log.action !== 'ESCALATE') {
        return handleEscalatedStatus(
          entityStatus,
          log,
          makerUserName,
          checkerUserName,
          type,
          users,
        );
      } else if (entityStatus.includes('REOPENED')) {
        return handleReopenedStatus(entityStatus, log, makerUserName, checkerUserName);
      } else if (entityStatus.includes('CLOSED')) {
        return handleClosedStatus(entityStatus, log, makerUserName, checkerUserName);
      } else if (entityStatus.includes('OPEN')) {
        return handleOpenStatus(entityStatus, log, makerUserName, checkerUserName);
      }
      return null;
    }
    case 'DRS_RISK_LEVEL': {
      const riskLevelLockChange = !!log.newImage?.isUpdatable !== !!log.oldImage?.isUpdatable;
      const wasLocked = log.oldImage?.isUpdatable === false;
      const isNowLocked = log.newImage?.isUpdatable === false;
      const newRiskScore = log.newImage?.drsScore;
      const oldRiskScore = log.oldImage?.drsScore;
      const riskScoreChanged = newRiskScore !== oldRiskScore;
      const newRiskLevel =
        newRiskScore != null ? getRiskLevelFromScore(riskClassificationValues, newRiskScore) : null;
      const displayRiskLevel = newRiskLevel ? getRiskLevelLabelWithAlias(newRiskLevel) : null;
      const comment = log.logMetadata?.comment;

      // Check for lock timer information
      const lockExpiresAt = log.newImage?.lockExpiresAt;
      const lockedAt = log.newImage?.lockedAt;
      const oldLockExpiresAt = log.oldImage?.lockExpiresAt;
      const hasTimer = isNowLocked && lockExpiresAt && lockedAt;
      const timerDuration = hasTimer
        ? Math.round((lockExpiresAt - lockedAt) / (1000 * 60 * 60 * 24))
        : null;
      const timerChanged = lockExpiresAt !== oldLockExpiresAt;

      // Determine action type
      if (riskLevelLockChange) {
        const action = isNowLocked ? (wasLocked ? 'updated' : 'locked') : 'unlocked';
        return (
          <>
            Risk level{' '}
            {riskScoreChanged && displayRiskLevel && isNowLocked && (
              <>
                changed to <b>{displayRiskLevel.toLowerCase()}</b> and{' '}
              </>
            )}
            <b>{action}</b> by <b>{userName}</b>
            {hasTimer && timerDuration && (
              <>
                {' '}
                for{' '}
                <b>
                  {timerDuration} {timerDuration === 1 ? 'day' : 'days'}
                </b>
              </>
            )}
            {comment && (
              <>
                {' '}
                • Reason: <i>{comment}</i>
              </>
            )}
          </>
        );
      } else if (isNowLocked && timerChanged) {
        // Lock timer was updated without changing lock status
        return (
          <>
            Risk level lock <b>updated</b> by <b>{userName}</b>
            {hasTimer && timerDuration ? (
              <>
                {' '}
                for{' '}
                <b>
                  {timerDuration} {timerDuration === 1 ? 'day' : 'days'}
                </b>
              </>
            ) : (
              <>
                {' '}
                to <b>perpetual</b>
              </>
            )}
            {comment && (
              <>
                {' '}
                • Reason: <i>{comment}</i>
              </>
            )}
          </>
        );
      } else if (riskScoreChanged && displayRiskLevel) {
        return (
          <>
            Risk level changed to <b>{displayRiskLevel.toLowerCase()}</b> by <b>{userName}</b>
            {comment && (
              <>
                {' '}
                • Reason: <i>{comment}</i>
              </>
            )}
          </>
        );
      }
      return <></>;
    }
    case 'USER_STATUS_CHANGE': {
      const currentUserStatus = log.newImage?.userStateDetails?.state;
      const previousUserStatus = log.oldImage?.userStateDetails?.state;
      return (
        <>
          User status changed{' '}
          {previousUserStatus ? (
            <>
              from <b>{capitalize(previousUserStatus)}</b>
            </>
          ) : (
            ''
          )}{' '}
          to <b>{capitalize(currentUserStatus)}</b> by <b>{userName}</b>{' '}
        </>
      );
    }
    case 'USER_KYC_STATUS_CHANGE': {
      const currentUserKycStatus = log.newImage?.kycStatusDetails?.status;
      const previousUserKycStatus = log.oldImage?.kycStatusDetails?.status;
      return (
        <>
          User status changed from{' '}
          {previousUserKycStatus ? (
            <>
              from <b>{capitalize(previousUserKycStatus)}</b>
            </>
          ) : (
            ''
          )}{' '}
          to <b>{capitalize(currentUserKycStatus)}</b> by <b>{userName}</b>
        </>
      );
    }
    case 'CHECKLIST_QA_STATUS_CHANGE': {
      return (
        <>
          Alert <b>{entityId}</b> is marked as {humanizeAuto(log?.newImage?.qaStatus)} by{' '}
          <b>{userName}</b>
        </>
      );
    }
    case 'API_UPDATE': {
      const updatedProperties = Object.keys(log.newImage)
        .map((key) => humanizeAuto(key))
        .join(', ');
      return (
        <>
          {humanizeAuto(entityType)} <b>{entityId}</b> updated using management API. Properties
          updated: <b>{updatedProperties}</b>
        </>
      );
    }
    case 'API_CREATION': {
      return (
        <>
          A new {entityType.toLowerCase()} <b>{entityId}</b> is created using management API
        </>
      );
    }
    default:
      return null;
  }
};

function getAssignmentDetails({ defaultUserName, users, reviewAssignments }) {
  const checkerUserId = reviewAssignments.length ? reviewAssignments[0].assigneeUserId : undefined;
  const checkerUserName = getDisplayedUserInfo(users[checkerUserId]).name ?? defaultUserName;
  return {
    makerUserName: defaultUserName,
    checkerUserName,
  };
}

export const extractSubtype = (log: AuditLog): string | undefined => {
  if (log.subtype) {
    return log.subtype;
  }
  if (log.logMetadata) {
    const logMetadata = log.logMetadata;
    if (
      isActionUpdate(log) &&
      (has(logMetadata, 'caseAssignment') || has(logMetadata, 'alertAssignment'))
    ) {
      return 'ASSIGNMENT';
    }
    if (isActionCreate(log) && has(logMetadata, 'caseCreationTimestamp')) {
      return 'CREATION';
    }
  }
  return undefined;
};

export const getAssignee = (newImage: any, users: { [userId: string]: AnyAccount }) => {
  const assignments: Assignment[] = has<{
    reviewAssignments?: Assignment[];
    assignments?: Assignment[];
  }>(newImage, 'assignments')
    ? newImage.assignments
    : newImage?.reviewAssignments ?? [];
  const userIds = assignments?.map((assignee: any) => assignee.assigneeUserId);
  return userIds?.map((userId: string) => users[userId]);
};

export const clusteredByDate = (logs: LogItemData[]) => {
  const map = new Map();
  for (const log of logs) {
    const curentTimestamp = log.timestamp;
    const currentDate = dayjs(curentTimestamp).format(DEFAULT_DATE_FORMAT);
    if (map.has(currentDate)) {
      const previous = map.get(currentDate);
      map.set(currentDate, [...previous, log]);
    } else {
      map.set(currentDate, [log]);
    }
  }
  return map;
};

export const handleEscalatedStatus = (
  entityStatus: CaseStatus,
  log: AuditLog,
  makerUserName: string,
  checkerUserName: string,
  type: 'USER' | 'CASE',
  users: { [userId: string]: AnyAccount },
) => {
  const entityType = log.type === 'ALERT' ? checkIfTransactions(log) : log.type;
  const entityId = entityType === 'TRANSACTION' ? getEscalatedTransactions(log) : [log.entityId];
  const files = log?.newImage?.files?.length ? 'with attachments' : '';
  const previousStatus = log.oldImage?.[`${entityType.toLowerCase()}Status`] || '';
  const childCase: string = log?.newImage?.alertCaseId;

  switch (entityStatus) {
    case 'ESCALATED_L2': {
      const assignedTo =
        log?.newImage?.reviewAssignments?.[log?.newImage?.reviewAssignments?.length - 1]
          ?.assigneeUserId;
      const assignedToUser = getDisplayedUserInfo(users[assignedTo]).name ?? checkerUserName;
      if (
        statusEscalatedL2(log?.newImage?.alertStatus) ||
        statusEscalatedL2(log?.newImage?.caseStatus)
      ) {
        return (
          <>
            {escalatedToLogMessage({
              entityType,
              entityId,
              checkerUserName: assignedToUser,
              escalationLevel: 'L2',
            })}
          </>
        );
      }
      return (
        <>
          {firstLetterUpper(entityType.toLowerCase())} <b>{entityId.join(', ')}</b> is escalated{' '}
          {childCase && (
            <>
              to a new child case <b>{childCase}</b>
            </>
          )}{' '}
          by <b>{makerUserName}</b> {files}
        </>
      );
    }

    case 'ESCALATED': {
      const isAlertEscalated = log.type === 'ALERT' && statusEscalated(log?.newImage?.alertStatus);
      if (isAlertEscalated) {
        return (
          <>
            {escalatedToLogMessage({
              entityType,
              entityId,
              checkerUserName,
              escalationLevel: 'L1',
            })}
          </>
        );
      }
      if (entityType === 'CASE' && childCase !== entityId[0]) {
        if (type === 'USER') {
          return null;
        }

        const alertIds = log?.newImage?.updatedAlertIds ?? [entityId];
        const isReviewDeclined =
          previousStatus.includes('IN_REVIEW') && previousStatus !== 'IN_REVIEW_ESCALATED';
        const isReviewApproved = previousStatus === 'IN_REVIEW_ESCALATED';
        if (isReviewDeclined) {
          return getReviewLogMessage({
            approvalStatus: 'declined',
            userName: checkerUserName,
            entiyType: entityType,
            entityId,
            currentStatus: entityStatus,
          });
        }
        if (isReviewApproved) {
          return getReviewLogMessage({
            approvalStatus: 'approved',
            userName: checkerUserName,
            entiyType: entityType,
            entityId,
            currentStatus: entityStatus,
          });
        }
        return (
          <>
            {firstLetterUpper(entityType.toLowerCase())} <b>{alertIds.join(', ')}</b> is escalated{' '}
            {childCase && (
              <>
                to a new child case <b>{childCase}</b>
              </>
            )}{' '}
            by <b>{makerUserName}</b> {files}
          </>
        );
      }
      return (
        <>
          {firstLetterUpper(entityType.toLowerCase())} <b>{entityId.join(', ')}</b> is escalated{' '}
          {childCase && (
            <>
              to a new child case <b>{childCase}</b>
            </>
          )}{' '}
          by <b>{makerUserName}</b> {files}
        </>
      );
    }

    case 'IN_REVIEW_ESCALATED': {
      const showReviewDetails = makerUserName !== checkerUserName;
      return (
        <>
          {firstLetterUpper(entityType.toLowerCase())} <b>{entityId.join(', ')}</b> is escalated by{' '}
          <b>{makerUserName}</b> {files}
          {showReviewDetails && (
            <>
              {' '}
              and is in review for <b>{checkerUserName}</b>
            </>
          )}
        </>
      );
    }

    case 'ESCALATED_L2_IN_PROGRESS': {
      return (
        <>
          {firstLetterUpper(entityType.toLowerCase())} <b>{entityId.join(', ')}</b> is escalated L2
          by <b>{makerUserName}</b> {files} and is in progress
        </>
      );
    }

    case 'ESCALATED_IN_PROGRESS': {
      return (
        <>
          {firstLetterUpper(entityType.toLowerCase())} <b>{entityId.join(', ')}</b> is escalated by{' '}
          <b>{makerUserName}</b> {files} and is in progress
        </>
      );
    }

    case 'ESCALATED_ON_HOLD': {
      return (
        <>
          {firstLetterUpper(entityType.toLowerCase())} <b>{entityId.join(', ')}</b> is escalated by{' '}
          <b>{makerUserName}</b> {files} and is on hold
        </>
      );
    }

    case 'ESCALATED_L2_ON_HOLD': {
      return (
        <>
          {firstLetterUpper(entityType.toLowerCase())} <b>{entityId.join(', ')}</b> is escalated L2
          by <b>{makerUserName}</b> {files} and is on hold
        </>
      );
    }

    default:
      return null;
  }
};

export const handleReopenedStatus = (
  entityStatus: CaseStatus,
  log: AuditLog,
  makerUserName: string,
  checkerUserName: string,
) => {
  const entityType = firstLetterUpper(log.type.toLowerCase());
  const entityId = log.entityId;
  const previousStatus = log.oldImage?.[`${log.type.toLowerCase()}Status`] || '';

  switch (entityStatus) {
    case 'REOPENED': {
      const isReviewDeclined =
        previousStatus.includes('IN_REVIEW') && previousStatus !== 'IN_REVIEW_REOPENED';
      const isApproved = previousStatus === 'IN_REVIEW_REOPENED';

      if (isReviewDeclined) {
        return getReviewLogMessage({
          approvalStatus: 'declined',
          userName: checkerUserName,
          entiyType: entityType,
          entityId,
          currentStatus: entityStatus,
        });
      } else if (isApproved) {
        return getReviewLogMessage({
          approvalStatus: 'approved',
          userName: checkerUserName,
          entiyType: entityType,
          entityId,
          currentStatus: entityStatus,
        });
      } else {
        return (
          <>
            {entityType} <b>{entityId}</b> is reopened by <b>{makerUserName}</b>
          </>
        );
      }
    }

    case 'IN_REVIEW_REOPENED': {
      const showReviewDetails = makerUserName !== checkerUserName;
      return (
        <>
          {entityType} <b>{entityId}</b> is reopened by <b>{makerUserName}</b>
          {showReviewDetails && (
            <>
              {' '}
              and is in review for <b>{checkerUserName}</b>
            </>
          )}
        </>
      );
    }

    default:
      return null;
  }
};

export const handleClosedStatus = (
  entityStatus: CaseStatus,
  log: AuditLog,
  makerUserName: string,
  checkerUserName: string,
) => {
  const entityType = firstLetterUpper(log.type.toLowerCase());
  const entityId = log.entityId;
  const investigationTime = log.newImage['investigationTime']
    ? formatDuration(getDuration(log.newImage['investigationTime']))
    : undefined;
  const files = log?.newImage?.files?.length ? 'with attachments' : '';
  const previousStatus = log.oldImage?.[`${log.type.toLowerCase()}Status`] || '';

  switch (entityStatus) {
    case 'CLOSED': {
      const isApproved = previousStatus === 'IN_REVIEW_CLOSED';
      const isReviewDeclined =
        previousStatus.includes('IN_REVIEW') && previousStatus !== 'IN_REVIEW_CLOSED';

      if (isReviewDeclined) {
        return getReviewLogMessage({
          approvalStatus: 'declined',
          userName: checkerUserName,
          entiyType: entityType,
          entityId,
          currentStatus: entityStatus,
        });
      } else if (isApproved) {
        return getReviewLogMessage({
          approvalStatus: 'approved',
          userName: checkerUserName,
          entiyType: entityType,
          entityId,
          currentStatus: entityStatus,
        });
      } else {
        return (
          <>
            {entityType} <b>{entityId}</b> is closed by <b>{makerUserName}</b> {files}
            {entityType === 'CASE' && investigationTime && (
              <span>{` (Investigation time: ${investigationTime})`}</span>
            )}
          </>
        );
      }
    }

    case 'IN_REVIEW_CLOSED': {
      const showReviewDetails = makerUserName !== checkerUserName;
      return (
        <>
          {entityType} <b>{entityId}</b> is closed by <b>{makerUserName}</b> {files}{' '}
          {showReviewDetails && (
            <>
              and is in review for <b>{checkerUserName}</b>
            </>
          )}
          {entityType === 'CASE' && investigationTime && (
            <span>{` (Investigation time: ${investigationTime})`}</span>
          )}
        </>
      );
    }

    default:
      return null;
  }
};

export const handleOpenStatus = (
  entityStatus: CaseStatus,
  log: AuditLog,
  makerUserName: string,
  checkerUserName: string,
) => {
  const entityType = firstLetterUpper(log.type.toLowerCase());
  const entityId = log.entityId;
  const files = log?.newImage?.files?.length ? 'with attachments' : '';
  const previousStatus = log.oldImage?.[`${log.type.toLowerCase()}Status`] || '';

  switch (entityStatus) {
    case 'OPEN': {
      const isReviewDeclined =
        previousStatus.includes('IN_REVIEW') && previousStatus !== 'IN_REVIEW_OPEN';
      const isReviewAccepted = previousStatus === 'IN_REVIEW_OPEN';

      if (isReviewDeclined) {
        return getReviewLogMessage({
          approvalStatus: 'declined',
          userName: checkerUserName,
          entiyType: entityType,
          entityId,
          currentStatus: entityStatus,
        });
      } else if (isReviewAccepted) {
        return getReviewLogMessage({
          approvalStatus: 'approved',
          userName: checkerUserName,
          entiyType: entityType,
          entityId,
          currentStatus: entityStatus,
        });
      } else {
        return (
          <>
            {entityType} <b>{entityId}</b> is opened by <b>{makerUserName}</b> {files}
          </>
        );
      }
    }
    case 'IN_REVIEW_OPEN': {
      const showReviewDetails = makerUserName !== checkerUserName;
      return (
        <>
          {entityType} <b>{entityId}</b> is opened by <b>{makerUserName}</b> {files}
          {showReviewDetails && (
            <>
              {' '}
              and is in review for <b>{checkerUserName}</b>
            </>
          )}
        </>
      );
    }
    case 'OPEN_IN_PROGRESS': {
      return (
        <>
          {entityType} <b>{entityId}</b> is opened by <b>{makerUserName}</b> {files} and is in
          progress
        </>
      );
    }
    case 'OPEN_ON_HOLD': {
      return (
        <>
          {entityType} <b>{entityId}</b> is opened by <b>{makerUserName}</b> {files} and is on hold
        </>
      );
    }
    default:
      return null;
  }
};

const getReviewLogMessage = ({ approvalStatus, userName, entiyType, entityId, currentStatus }) => {
  return (
    <>
      Review {approvalStatus} by <b>{userName}</b> on {humanizeAuto(entiyType)} <b>{entityId}</b>{' '}
      and status is set to {humanizeAuto(currentStatus)}
    </>
  );
};
const escalatedToLogMessage = ({ entityType, entityId, checkerUserName, escalationLevel }) => {
  return (
    <>
      {firstLetterUpper(entityType.toLowerCase())} <b>{entityId}</b> is escalated
      {escalationLevel === 'L2' ? ' L2' : ''} to <b>{checkerUserName}</b>
    </>
  );
};

export const checkIfTransactions = (log: AuditLog) => {
  const transactions = log?.newImage?.updatedTransactions;
  return transactions && transactions.length ? 'TRANSACTION' : 'ALERT';
};

export const getEscalatedTransactions = (log: AuditLog) => {
  const transactions = log.newImage.updatedTransactions;
  return transactions;
};

export const getLogData = function (
  logs: AuditLog[],
  users: { [userId: string]: AnyAccount },
  type: 'USER' | 'CASE',
  riskClassificationValues: Array<RiskClassificationScore>,
): LogItemData[] {
  const logItemData: LogItemData[] = logs
    .map((log) => {
      let currentUser: AnyAccount | null = null;
      if (log?.user?.id && users[log?.user?.id]) {
        currentUser = users[log?.user?.id];
      }
      const getIcon = (type: string) => {
        return type === 'CASE' ? (
          <CaseIcon width={20} height={20} />
        ) : (
          <Avatar size="small" user={currentUser} />
        );
      };

      const createStatement = getCreateStatement(log, users, type, riskClassificationValues);
      if (isActionUpdate(log)) {
        return createStatement
          ? {
              timestamp: log.timestamp,
              user: log.user,
              icon: getIcon('USER'),
              statement: createStatement,
            }
          : null;
      } else if (isActionCreate(log)) {
        return createStatement
          ? {
              timestamp: log.timestamp,
              user: log.user,
              icon: getIcon(type),
              statement: createStatement,
            }
          : null;
      } else if (isActionEscalate(log)) {
        return createStatement
          ? {
              timestamp: log.timestamp,
              user: log.user,
              icon: getIcon('CASE'),
              statement: createStatement,
            }
          : null;
      } else if (isActionDelete(log)) {
        return createStatement
          ? {
              timestamp: log.timestamp,
              user: log.user,
              icon: getIcon(type),
              statement: createStatement,
            }
          : null;
      }
      return null;
    })
    .filter((log) => log !== null) as LogItemData[];
  return logItemData;
};
