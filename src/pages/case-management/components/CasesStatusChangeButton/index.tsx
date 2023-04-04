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
  statusTransitions?: Record<CaseStatus, { status: CaseStatus; actionLabel: string }>;
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
    statusTransitions,
  } = props;
  return (
    <>
      <StatusChangeButton
        ids={caseIds}
        status={caseStatus}
        buttonProps={buttonProps}
        statusTransitions={statusTransitions}
      >
        {({ isVisible, setVisible, newStatus }) => (
          <CasesStatusChangeModal
            isVisible={isVisible}
            ids={caseIds}
            newStatus={newStatus}
            newStatusActionLabel={caseStatus && statusTransitions?.[caseStatus].actionLabel}
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
