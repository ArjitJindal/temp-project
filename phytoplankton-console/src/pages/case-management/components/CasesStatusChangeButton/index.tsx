import React from 'react';
import CasesStatusChangeModal from './CasesStatusChangeModal';
import { CaseStatus } from '@/apis';
import { ButtonSize } from '@/components/library/Button';
import StatusChangeButton from '@/pages/case-management/components/StatusChangeButton';
import { ActionLabel, FormValues } from '@/pages/case-management/components/StatusChangeModal';

interface Props {
  caseIds: string[];
  caseStatus?: CaseStatus;
  initialValues?: FormValues;
  buttonProps?: { size?: ButtonSize | undefined; isBlue?: boolean; rounded?: boolean };
  statusTransitions?: Partial<Record<CaseStatus, { status: CaseStatus; actionLabel: ActionLabel }>>;
  onSaved: () => void;
  isDisabled?: boolean;
  skipReasonsModal?: boolean;
  className?: string;
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
    className,
  } = props;
  return (
    <>
      <StatusChangeButton
        ids={caseIds}
        status={caseStatus}
        buttonProps={buttonProps}
        statusTransitions={statusTransitions}
        isDisabled={isDisabled}
        className={className}
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
