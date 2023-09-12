import { ReactElement } from 'react';
import { has } from 'lodash';
import { LogItemData } from './LogItem';
import { Account, AuditLog, Case, CaseStatus } from '@/apis';
import { DEFAULT_DATE_FORMAT, TIME_FORMAT_WITHOUT_SECONDS, dayjs } from '@/utils/dayjs';
import { firstLetterUpper } from '@/utils/humanize';

export const useGetLogData = (
  logs: AuditLog[],
  users: { [userId: string]: Account },
  type: 'USER' | 'CASE',
): LogItemData[] => {
  const logItemData: LogItemData[] = logs
    .map((log) => {
      const time = dayjs(log.timestamp).format(TIME_FORMAT_WITHOUT_SECONDS);
      const createStatement = getCreateStatement(log, users, type);
      if (isActionUpdate(log)) {
        return createStatement
          ? {
              time: time,
              user: log.user,
              icon: 'USER',
              statement: createStatement,
            }
          : null;
      } else if (isActionCreate(log)) {
        return createStatement
          ? {
              time: time,
              user: log.user,
              icon: 'CASE',
              statement: createStatement,
            }
          : null;
      } else if (isActionEscalate(log)) {
        return createStatement
          ? {
              time: time,
              user: log.user,
              icon: 'CASE',
              statement: createStatement,
            }
          : null;
      }
      return null;
    })
    .filter((log) => log !== null) as LogItemData[];
  return logItemData;
};

export const isActionUpdate = (log: AuditLog): boolean => {
  return log.action === 'UPDATE';
};

export const isActionCreate = (log: AuditLog): boolean => {
  return log.action === 'CREATE';
};

export const isActionEscalate = (log: AuditLog): boolean => {
  return log.action === 'ESCALATE';
};

export const getCreateStatement = (
  log: AuditLog,
  users: { [userId: string]: Account },
  type: 'USER' | 'CASE',
): ReactElement | null => {
  const user = log.user?.id ? users[log.user?.id] : undefined;
  const userName = user ? (user.role === 'root' ? 'system' : user.name ?? user.email) : 'system';
  const entityType = log.type;
  const entityId = log.entityId;
  const subtype = extractSubtype(log) as AuditLog['subtype'];
  const assignees = getAssignee(log?.newImage, users) ?? [];
  switch (subtype) {
    case 'COMMENT': {
      return log?.newImage?.files && log?.newImage?.files?.length ? (
        <>
          <b>{firstLetterUpper(userName)}</b> attached files
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
      if (entityStatus.includes('ESCALATED')) {
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
    default:
      return null;
  }
};

export const extractSubtype = (log: AuditLog): string | undefined => {
  if (log.subtype) return log.subtype;
  if (log.logMetadata) {
    const logMetadata = log.logMetadata;
    if (
      isActionUpdate(log) &&
      (has(logMetadata, 'caseAssignment') || has(logMetadata, 'alertAssignment'))
    )
      return 'ASSIGNMENT';
    if (isActionCreate(log) && has(logMetadata, 'caseCreationTimestamp')) return 'CREATION';
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

export const clusteredByDate = (logs: AuditLog[]) => {
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
        if (type === 'USER') return null;
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
  const files = log?.newImage?.files && log?.newImage?.files?.length ? 'with attachments' : '';
  switch (entityStatus) {
    case 'CLOSED': {
      return (
        <>
          {firstLetterUpper(entityType.toLowerCase())} <b>{entityId}</b> is closed by{' '}
          <b>{userName}</b> {files}
        </>
      );
    }
    case 'IN_REVIEW_CLOSED': {
      return (
        <>
          {firstLetterUpper(entityType.toLowerCase())} <b>{entityId}</b> is closed by{' '}
          <b>{userName}</b> {files} and is in review
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
