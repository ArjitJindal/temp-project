import React, { useState } from 'react';
import { AlertStatus, CaseStatus, FileInfo, Permission } from '@/apis';
import Button, { ButtonSize } from '@/components/library/Button';
import { CaseClosingReasons } from '@/apis/models/CaseClosingReasons';
import { neverReturn } from '@/utils/lang';
import { humanizeConstant } from '@/utils/humanize';

export const statusToOperationName = (status: AlertStatus | CaseStatus) => {
  switch (status) {
    case 'OPEN':
      return 'Open';
    case 'CLOSED':
      return 'Close';
    case 'REOPENED':
      return 'Re-Open';
    case 'ESCALATED':
      return 'Escalate';
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
    case 'CLOSED':
      return 'REOPENED';
    default:
      return neverReturn(status, status);
  }
};

export interface FormValues {
  reasons: CaseClosingReasons[];
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
  statusTransitions?: Record<CaseStatus, { status: CaseStatus; actionLabel: string }>;
  children: (childrenProps: ChildrenProps) => React.ReactNode;
  isDisabled?: boolean;
}

export default function StatusChangeButton(props: Props) {
  const { ids, status, buttonProps = {}, children, statusTransitions, isDisabled = false } = props;
  const [isModalVisible, setModalVisible] = useState(false);
  const overridenStatus = status ? statusTransitions?.[status] : null;
  const newStatus = overridenStatus?.status ?? getNextStatus(status);
  const requiredPermissions: Permission[] = ['case-management:case-overview:write'];
  if (status === 'CLOSED') requiredPermissions.push('case-management:case-reopen:write');
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
        >
          {overridenStatus?.actionLabel ?? statusToOperationName(newStatus)}
        </Button>
      )}
      {children({ isVisible: isModalVisible, setVisible: setModalVisible, newStatus })}
    </>
  );
}
