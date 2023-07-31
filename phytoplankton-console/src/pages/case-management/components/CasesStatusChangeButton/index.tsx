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
  statusTransitions?: Partial<
    Record<
      CaseStatus,
      {
        status: CaseStatus;
        actionLabel: 'Send back' | 'Escalate' | 'Approve' | 'Decline' | 'Close';
      }
    >
  >;
  onSaved: () => void;
  isDisabled?: boolean;
  skipReasonsModal?: boolean;
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
            oldStatus={caseStatus}
            newStatus={newStatus}
            newStatusActionLabel={caseStatus && statusTransitions?.[caseStatus]?.actionLabel}
            onSaved={onSaved}
            initialValues={initialValues}
            onClose={() => {
              setVisible(false);
            }}
            skipReasonsModal={props.skipReasonsModal}
          />
        )}
      </StatusChangeButton>
    </>
  );
}
