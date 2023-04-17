import React from 'react';
import { FormValues } from '../StatusChangeModal';
import AlertsStatusChangeModal from './AlertsStatusChangeModal';
import { AlertStatus } from '@/apis';
import { ButtonSize } from '@/components/library/Button';
import StatusChangeButton from '@/pages/case-management/components/StatusChangeButton';

interface Props {
  entityName?: string;
  ids: string[];
  caseId: string;
  status?: AlertStatus;
  initialValues?: FormValues;
  buttonProps?: {
    size?: ButtonSize | undefined;
    isBlue?: boolean;
    rounded?: boolean;
  };
  statusTransitions?: Record<AlertStatus, { status: AlertStatus; actionLabel: string }>;
  onSaved: () => void;
}

export default function AlertsStatusChangeButton(props: Props) {
  const {
    ids,
    onSaved,
    status,
    caseId,
    initialValues = {
      reasons: [],
      reasonOther: null,
      comment: '',
      files: [],
    },
    statusTransitions,
    buttonProps = {},
  } = props;
  return (
    <>
      <StatusChangeButton
        status={status}
        buttonProps={buttonProps}
        ids={ids}
        statusTransitions={statusTransitions}
      >
        {({ isVisible, setVisible, newStatus }) => (
          <AlertsStatusChangeModal
            isVisible={isVisible}
            ids={ids}
            caseId={caseId}
            newStatus={newStatus}
            onSaved={onSaved}
            newStatusActionLabel={status && statusTransitions?.[status].actionLabel}
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
