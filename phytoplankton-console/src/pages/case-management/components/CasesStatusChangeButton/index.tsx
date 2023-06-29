import React from 'react';
import { CaseStatus } from '@/apis';
import { ButtonSize } from '@/components/library/Button';
import CasesStatusChangeModal from '@/pages/case-management/components/CasesStatusChangeButton/CasesStatusChangeModal';
import StatusChangeButton from '@/pages/case-management/components/StatusChangeButton';
import { FormValues } from '@/pages/case-management/components/StatusChangeModal';

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
      reasonOther: undefined,
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
