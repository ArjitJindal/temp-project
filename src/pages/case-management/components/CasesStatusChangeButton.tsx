import React, { useState } from 'react';
import { SizeType } from 'antd/es/config-provider/SizeContext';
import { CaseStatus, FileInfo } from '@/apis';
import Button from '@/components/ui/Button';
import { CaseClosingReasons } from '@/apis/models/CaseClosingReasons';
import COLORS from '@/components/ui/colors';
import CasesStatusChangeModal from '@/pages/case-management/components/CasesStatusChangeModal';

interface Props {
  caseIds: string[];
  newCaseStatus: CaseStatus;
  initialValues?: FormValues;
  buttonProps?: {
    size?: SizeType | undefined;
    isBlue?: boolean;
    rounded?: boolean;
  };
  onSaved: () => void;
}

export interface RemoveAllFilesRef {
  removeAllFiles: () => void;
}

export const caseStatusToOperationName = (caseStatus: CaseStatus) => {
  if (caseStatus === 'REOPENED') {
    return 'Re-Open';
  } else if (caseStatus === 'CLOSED') {
    return 'Close';
  }
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
    newCaseStatus,
    initialValues = {
      reasons: [],
      reasonOther: null,
      comment: '',
      files: [],
    },
    buttonProps = {},
  } = props;
  const [isModalVisible, setModalVisible] = useState(false);

  return (
    <>
      <Button
        analyticsName="UpdateCaseStatus"
        style={{
          ...(caseIds.length
            ? {
                background: buttonProps.isBlue ? COLORS.brandBlue.base : 'white',
                color: buttonProps.isBlue ? 'white' : 'black',
              }
            : {}),
          borderRadius: buttonProps.rounded ? '0.5rem' : '0',
        }}
        onClick={() => {
          setModalVisible(true);
        }}
        disabled={!caseIds.length}
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
