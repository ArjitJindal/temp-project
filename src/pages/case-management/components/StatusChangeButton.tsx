import React, { useState } from 'react';
import { CaseStatus, FileInfo } from '@/apis';
import Button, { ButtonSize } from '@/components/library/Button';
import { CaseClosingReasons } from '@/apis/models/CaseClosingReasons';
import { neverReturn } from '@/utils/lang';
import { humanizeConstant } from '@/utils/humanize';

export interface RemoveAllFilesRef {
  removeAllFiles: () => void;
}

export const caseStatusToOperationName = (caseStatus: CaseStatus) => {
  switch (caseStatus) {
    case 'OPEN':
      return 'Open';
    case 'CLOSED':
      return 'Close';
    case 'REOPENED':
      return 'Re-Open';
  }
  return neverReturn(caseStatus, humanizeConstant(caseStatus));
};

export const getNextCaseStatus = (caseStatus: CaseStatus | undefined): CaseStatus => {
  if (caseStatus == null) {
    return 'CLOSED';
  }
  switch (caseStatus) {
    case 'REOPENED':
    case 'OPEN':
      return 'CLOSED';
    case 'CLOSED':
      return 'REOPENED';
  }
  return neverReturn(caseStatus, caseStatus);
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
  newCaseStatus: CaseStatus;
}

interface Props {
  ids: string[];
  caseStatus?: CaseStatus;
  buttonProps?: {
    size?: ButtonSize | undefined;
    isBlue?: boolean;
    rounded?: boolean;
  };
  children: (childrenProps: ChildrenProps) => React.ReactNode;
}

export default function StatusChangeButton(props: Props) {
  const { ids, caseStatus, buttonProps = {}, children } = props;
  const [isModalVisible, setModalVisible] = useState(false);
  const newCaseStatus = getNextCaseStatus(caseStatus);
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
          {caseStatusToOperationName(newCaseStatus)}
        </Button>
      )}
      {children({ isVisible: isModalVisible, setVisible: setModalVisible, newCaseStatus })}
    </>
  );
}
