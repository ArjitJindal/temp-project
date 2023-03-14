import React, { useState } from 'react';
import { AlertStatus, CaseStatus, FileInfo } from '@/apis';
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
  }
  return neverReturn(status, humanizeConstant(status));
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
      return 'CLOSED';
    case 'CLOSED':
      return 'REOPENED';
  }
  return neverReturn(status, status);
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
  children: (childrenProps: ChildrenProps) => React.ReactNode;
}

export default function StatusChangeButton(props: Props) {
  const { ids, status, buttonProps = {}, children } = props;
  const [isModalVisible, setModalVisible] = useState(false);
  const newStatus = getNextStatus(status);
  return (
    <>
      {ids.length > 0 && (
        <Button
          type="TETRIARY"
          analyticsName="UpdateStatus"
          onClick={() => {
            setModalVisible(true);
          }}
          isDisabled={!ids.length}
          size={buttonProps.size}
        >
          {statusToOperationName(newStatus)}
        </Button>
      )}
      {children({ isVisible: isModalVisible, setVisible: setModalVisible, newStatus })}
    </>
  );
}
