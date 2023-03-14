import React from 'react';
import { CaseStatus, FileInfo } from '@/apis';
import { ButtonSize } from '@/components/library/Button';
import { CaseClosingReasons } from '@/apis/models/CaseClosingReasons';
import CasesStatusChangeModal from '@/pages/case-management/components/CasesStatusChangeButton/CasesStatusChangeModal';
import StatusChangeButton from '@/pages/case-management/components/StatusChangeButton';

export interface FormValues {
  reasons: CaseClosingReasons[];
  reasonOther: string | null;
  comment: string | null;
  files: FileInfo[];
}

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
  return (
    <>
      <StatusChangeButton ids={caseIds} status={caseStatus} buttonProps={buttonProps}>
        {({ isVisible, setVisible, newStatus }) => (
          <CasesStatusChangeModal
            isVisible={isVisible}
            ids={caseIds}
            newStatus={newStatus}
            onSaved={onSaved}
            initialValues={initialValues}
            onClose={() => {
              setVisible(false);
            }}
          />
        )}
      </StatusChangeButton>
    </>
  );
}
