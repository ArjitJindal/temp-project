import React from 'react';
import { ActionLabel, FormValues } from '../StatusChangeModal';
import AlertsStatusChangeModal from './AlertsStatusChangeModal';
import { AlertStatus } from '@/apis';
import { ButtonSize } from '@/components/library/Button';
import StatusChangeButton from '@/pages/case-management/components/StatusChangeButton';

interface Props {
  entityName?: string;
  ids: string[];
  transactionIds: { [alertId: string]: string[] };
  caseId?: string;
  status?: AlertStatus;
  initialValues?: Partial<FormValues>;
  buttonProps?: { size?: ButtonSize | undefined; isBlue?: boolean; rounded?: boolean };
  statusTransitions?: Partial<
    Record<AlertStatus, { status: AlertStatus; actionLabel: ActionLabel }>
  >;
  onSaved: () => void;
  isDisabled?: boolean;
  skipReasonsModal?: boolean;
}

export default function AlertsStatusChangeButton(props: Props) {
  const {
    ids,
    transactionIds,
    onSaved,
    status,
    caseId,
    initialValues = {
      reasons: [],
      reasonOther: undefined,
      comment: '',
      files: [],
      closeRelatedCase: false,
    },
    statusTransitions,
    buttonProps = {},
    isDisabled = false,
  } = props;
  return (
    <>
      <StatusChangeButton
        status={status}
        buttonProps={buttonProps}
        ids={ids}
        statusTransitions={statusTransitions}
        isDisabled={isDisabled}
      >
        {({ isVisible, setVisible, newStatus }) => (
          <AlertsStatusChangeModal
            isVisible={isVisible}
            entityIds={ids}
            transactionIds={transactionIds}
            caseId={caseId}
            oldStatus={status}
            newStatus={newStatus}
            onSaved={onSaved}
            newStatusActionLabel={status && statusTransitions?.[status]?.actionLabel}
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
