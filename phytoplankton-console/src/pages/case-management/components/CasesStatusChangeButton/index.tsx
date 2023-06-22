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
  closeRelatedCase: boolean;
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
  statusTransitions?: Record<
    CaseStatus,
    { status: CaseStatus; actionLabel: 'Send back' | 'Escalate' }
  >;
  onSaved: () => void;
  isDisabled?: boolean;
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
      closeRelatedCase: false,
    },
    buttonProps = {},
    statusTransitions,
    isDisabled = false,
  } = props;
  return (
    <>
      <StatusChangeButton
        ids={caseIds}
        status={caseStatus}
        buttonProps={buttonProps}
        statusTransitions={statusTransitions}
        isDisabled={isDisabled}
      >
        {({ isVisible, setVisible, newStatus }) => (
          <CasesStatusChangeModal
            isVisible={isVisible}
            entityIds={caseIds}
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
