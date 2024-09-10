import { ReactElement } from 'react';
import { capitalize, has } from 'lodash';
import { getRiskLevelFromScore } from '@flagright/lib/utils';
import { firstLetterUpper, humanizeAuto } from '@flagright/lib/utils/humanize';
import { LogItemData } from './LogCard/LogContainer/LogItem';
import { Account, AuditLog, Case, CaseStatus, RiskClassificationScore } from '@/apis';
import { DEFAULT_DATE_FORMAT, dayjs } from '@/utils/dayjs';
import { RISK_LEVEL_LABELS } from '@/utils/risk-levels';
import { statusEscalated } from '@/utils/case-utils';
import { formatDuration, getDuration } from '@/utils/time-utils';

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
  users: { [userId: string]: Account },
  type: 'USER' | 'CASE',
  riskClassificationValues: Array<RiskClassificationScore>,
): ReactElement | null => {
  const user = log.user?.id ? users[log.user?.id] : undefined;
  const userName = user ? (user.role === 'root' ? 'system' : user.name ?? user.email) : 'system';
  const entityType = log.type;
  const entityId = log.entityId;
  const subtype = extractSubtype(log) as AuditLog['subtype'];
  const assignees = getAssignee(log?.newImage, users) ?? [];
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
      return (
        <>
          A new {entityType.toLowerCase()} <b>{entityId}</b> is created by <b>{userName}</b> and is
          unassigned
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
      if (!entityStatus) {
        return null;
      }

      if (statusEscalated(entityStatus)) {
        return handleEscalatedStatus(entityStatus, log, userName, type);
      } else if (entityStatus.includes('REOPENED')) {
        return handleRepoenedStatus(entityStatus, log, userName);
      } else if (entityStatus.includes('CLOSED')) {
        return handleClosedStatus(entityStatus, log, userName);
      } else if (entityStatus.includes('OPEN')) {
        return handleOpenStatus(entityStatus, log, userName);
      }
      return null;
    }
    case 'DRS_RISK_LEVEL': {
      const riskLevelLockChange = !!log.newImage?.isUpdatable !== !!log.oldImage?.isUpdatable;
      const riskLevelUpdatebleStatus = log.newImage?.isUpdatable ? 'unlocked' : 'locked';
      const newRiskScore = log.newImage?.drsScore;
      const newRiskLevel =
        newRiskScore != null ? getRiskLevelFromScore(riskClassificationValues, newRiskScore) : null;
      return riskLevelLockChange ? (
        <>
          Risk level <b>{riskLevelUpdatebleStatus}</b> by <b>{userName}</b>
        </>
      ) : newRiskLevel ? (
        <>
          Risk level changed to <b>{RISK_LEVEL_LABELS[newRiskLevel].toLowerCase()}</b> by{' '}
          <b>{userName}</b>
        </>
      ) : (
        <></>
      );
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

export const getAssignee = (newImage: any, users: { [userId: string]: Account }) => {
  const assignments = has(newImage, 'assignments')
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
  userName: string,
  type: 'USER' | 'CASE',
) => {
  const entityType = log.type === 'ALERT' ? checkIfTransactions(log) : log.type;
  const entityId = entityType === 'TRANSACTION' ? getEscalatedTransactions(log) : [log.entityId];
  const files = log?.newImage?.files && log?.newImage?.files?.length ? 'with attachments' : '';
  switch (entityStatus) {
    case 'ESCALATED': {
      const childCase: string = log?.newImage?.alertCaseId;
      if (entityType === 'CASE' && childCase !== entityId[0]) {
        if (type === 'USER') {
          return null;
        }
        const alertIds = log?.newImage?.updatedAlertIds ?? [];
        return (
          <>
            Alert <b>{alertIds.join(', ')}</b> is escalated{' '}
            {childCase ? (
              <>
                to a new child case <b>{childCase}</b>
              </>
            ) : (
              ''
            )}{' '}
            by <b>{userName}</b> {files}
          </>
        );
      }
      return (
        <>
          {firstLetterUpper(entityType.toLowerCase())} <b>{entityId.join(', ')}</b> is escalated{' '}
          {childCase ? (
            <>
              to a new child case <b>{childCase}</b>
            </>
          ) : (
            ''
          )}{' '}
          by <b>{userName}</b> {files}
        </>
      );
    }
    case 'IN_REVIEW_ESCALATED': {
      return (
        <>
          {firstLetterUpper(entityType.toLowerCase())} <b>{entityId.join(', ')}</b> is escalated by{' '}
          <b>{userName}</b>
          {files} and is in review
        </>
      );
    }
    case 'ESCALATED_IN_PROGRESS': {
      return (
        <>
          {firstLetterUpper(entityType.toLowerCase())} <b>{entityId.join(', ')}</b> is escalated by{' '}
          <b>{userName}</b> {files} and is in progress
        </>
      );
    }
    case 'ESCALATED_ON_HOLD': {
      return (
        <>
          {firstLetterUpper(entityType.toLowerCase())} <b>{entityId.join(', ')}</b> is escalated by{' '}
          <b>{userName}</b> {files} and is on hold
        </>
      );
    }
    default:
      return null;
  }
};

export const handleRepoenedStatus = (entityStatus: CaseStatus, log: AuditLog, userName: string) => {
  const entityType = log.type;
  const entityId = log.entityId;
  switch (entityStatus) {
    case 'REOPENED': {
      return (
        <>
          {firstLetterUpper(entityType.toLowerCase())} <b>{entityId}</b> is reopened by{' '}
          <b>{userName}</b>
        </>
      );
    }
    case 'IN_REVIEW_REOPENED': {
      return (
        <>
          {firstLetterUpper(entityType.toLowerCase())} <b>{entityId}</b> is reopened by{' '}
          <b>{userName}</b> and is in review
        </>
      );
    }
    default:
      return null;
  }
};

export const handleClosedStatus = (entityStatus: CaseStatus, log: AuditLog, userName: string) => {
  const entityType = log.type;
  const entityId = log.entityId;
  const investigationTime = log.newImage['investigationTime']
    ? formatDuration(getDuration(log.newImage['investigationTime']))
    : undefined;
  const files = log?.newImage?.files && log?.newImage?.files?.length ? 'with attachments' : '';
  switch (entityStatus) {
    case 'CLOSED': {
      return (
        <>
          {firstLetterUpper(entityType.toLowerCase())} <b>{entityId}</b> is closed by{' '}
          <b>{userName}</b>
          {files}
          {entityType === 'CASE' && investigationTime !== undefined && (
            <span>{` (Investigation time: ${investigationTime ?? 0})`}</span>
          )}
        </>
      );
    }
    case 'IN_REVIEW_CLOSED': {
      return (
        <>
          {firstLetterUpper(entityType.toLowerCase())} <b>{entityId}</b> is closed by{' '}
          <b>{userName}</b> {files} and is in review{' '}
          {entityType === 'CASE' && investigationTime !== undefined && (
            <span>{`(Investigation time: ${investigationTime ?? 0})`}</span>
          )}
        </>
      );
    }
    default:
      return null;
  }
};

export const handleOpenStatus = (entityStatus: CaseStatus, log: AuditLog, userName: string) => {
  const entityType = log.type;
  const entityId = log.entityId;
  const files = log?.newImage?.files && log?.newImage?.files?.length ? 'with attachments' : '';
  switch (entityStatus) {
    case 'OPEN': {
      return (
        <>
          {firstLetterUpper(entityType.toLowerCase())} <b>{entityId}</b> is opened by{' '}
          <b>{userName}</b> {files}
        </>
      );
    }
    case 'IN_REVIEW_OPEN': {
      return (
        <>
          {firstLetterUpper(entityType.toLowerCase())} <b>{entityId}</b> is opened by{' '}
          <b>{userName}</b> {files} and is in review
        </>
      );
    }
    case 'OPEN_IN_PROGRESS': {
      return (
        <>
          {firstLetterUpper(entityType.toLowerCase())} <b>{entityId}</b> is opened by{' '}
          <b>{userName}</b> {files} and is in progress
        </>
      );
    }
    case 'OPEN_ON_HOLD': {
      return (
        <>
          {firstLetterUpper(entityType.toLowerCase())} <b>{entityId}</b> is opened by{' '}
          <b>{userName}</b> {files} and is on hold
        </>
      );
    }
    default:
      return null;
  }
};

export const checkIfTransactions = (log: AuditLog) => {
  const transactions = log?.newImage?.updatedTransactions;
  return transactions && transactions.length ? 'TRANSACTION' : 'ALERT';
};

export const getEscalatedTransactions = (log: AuditLog) => {
  const transactions = log.newImage.updatedTransactions;
  return transactions;
};
