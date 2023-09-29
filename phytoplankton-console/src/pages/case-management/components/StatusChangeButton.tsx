import React, { useMemo, useState } from 'react';
import { compact } from 'lodash';
import { AlertStatus, CaseStatus, FileInfo, Permission } from '@/apis';
import Button, { ButtonSize } from '@/components/library/Button';
import { CaseReasons } from '@/apis/models/CaseReasons';
import { neverReturn } from '@/utils/lang';
import { humanizeConstant } from '@/utils/humanize';

export const statusToOperationName = (
  status: AlertStatus | CaseStatus | 'IN_REVIEW',
  isPastTense = false,
) => {
  switch (status) {
    case 'OPEN':
      return 'Open';
    case 'CLOSED':
      return 'Close' + (isPastTense ? 'd' : '');
    case 'REOPENED':
      return 'Re-Open' + (isPastTense ? 'ed' : '');
    case 'ESCALATED':
      return 'Escalate' + (isPastTense ? 'd' : '');
    case 'IN_REVIEW_OPEN':
    case 'IN_REVIEW_ESCALATED':
    case 'IN_REVIEW_CLOSED':
    case 'IN_REVIEW_REOPENED':
      return 'In review';
    case 'OPEN_IN_PROGRESS':
    case 'ESCALATED_IN_PROGRESS':
      return 'In progress';
    case 'OPEN_ON_HOLD':
    case 'ESCALATED_ON_HOLD':
      return 'On hold';
    case 'IN_REVIEW':
      return 'In review';
    default:
      return neverReturn(status, humanizeConstant(status));
  }
};

const getNextStatus = (status: CaseStatus | AlertStatus | undefined): CaseStatus | AlertStatus => {
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
    default:
      return neverReturn(status, status);
  }
};

export interface FormValues {
  reasons: CaseReasons[];
  reasonOther: string | null;
  comment: string | null;
  files: FileInfo[];
}

interface ChildrenProps {
  isVisible: boolean;
  setVisible: (newVisible: boolean) => void;
  newStatus: CaseStatus | AlertStatus;
}

interface Props {
  ids: string[];
  status?: CaseStatus | AlertStatus;
  buttonProps?: {
    size?: ButtonSize | undefined;
    isBlue?: boolean;
    rounded?: boolean;
  };
  statusTransitions?: Partial<Record<CaseStatus, { status: CaseStatus; actionLabel: string }>>;
  children: (childrenProps: ChildrenProps) => React.ReactNode;
  isDisabled?: boolean;
  className?: string;
}

export default function StatusChangeButton(props: Props) {
  const {
    ids,
    status,
    buttonProps = {},
    children,
    statusTransitions,
    isDisabled = false,
    className,
  } = props;
  const [isModalVisible, setModalVisible] = useState(false);

  const overridenStatus = status ? statusTransitions?.[status] : null;

  const newStatus = useMemo(
    () => overridenStatus?.status ?? getNextStatus(status),
    [overridenStatus, status],
  );

  const requiredPermissions: Permission[] = useMemo(() => {
    return compact([
      'case-management:case-overview:write',
      status === 'CLOSED' ? 'case-management:case-reopen:write' : undefined,
    ]);
  }, [status]);

  return (
    <>
      {ids.length > 0 && (
        <Button
          type="TETRIARY"
          analyticsName="UpdateStatus"
          onClick={() => {
            setModalVisible(true);
          }}
          isDisabled={isDisabled ? isDisabled : !ids.length}
          size={buttonProps.size}
          style={{ width: 'max-content' }}
          testName="update-status-button"
          requiredPermissions={requiredPermissions}
          className={className}
        >
          {overridenStatus?.actionLabel ?? statusToOperationName(newStatus)}
        </Button>
      )}
      {children({ isVisible: isModalVisible, setVisible: setModalVisible, newStatus })}
    </>
  );
}
