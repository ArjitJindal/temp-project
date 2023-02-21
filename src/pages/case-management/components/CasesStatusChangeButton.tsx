import React, { useState } from 'react';
import { CaseStatus, FileInfo } from '@/apis';
import Button, { ButtonSize } from '@/components/library/Button';
import { CaseClosingReasons } from '@/apis/models/CaseClosingReasons';
import CasesStatusChangeModal from '@/pages/case-management/components/CasesStatusChangeModal';
import { neverReturn } from '@/utils/lang';
import { humanizeConstant } from '@/utils/humanize';

interface Props {
  caseIds: string[];
  caseStatus?: CaseStatus;
  initialValues?: FormValues;
  buttonProps?: {
    size?: ButtonSize | undefined;
    isBlue?: boolean;
    rounded?: boolean;
  };
  onSaved: () => void;
}

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

export default function CasesStatusChangeButton(props: Props) {
  const {
    caseIds,
    onSaved,
    caseStatus,
    initialValues = {
      reasons: [],
      reasonOther: null,
      comment: '',
      files: [],
    },
    buttonProps = {},
  } = props;
  const [isModalVisible, setModalVisible] = useState(false);
  const newCaseStatus = getNextCaseStatus(caseStatus);
  return (
    <>
      <Button
        type="SECONDARY"
        analyticsName="UpdateCaseStatus"
        onClick={() => {
          setModalVisible(true);
        }}
        isDisabled={!caseIds.length}
        size={buttonProps.size}
      >
        {caseStatusToOperationName(newCaseStatus)}
      </Button>
      <CasesStatusChangeModal
        isVisible={isModalVisible}
        caseIds={caseIds}
        newCaseStatus={newCaseStatus}
        onSaved={onSaved}
        initialValues={initialValues}
        onClose={() => {
          setModalVisible(false);
        }}
      />
    </>
  );
}
