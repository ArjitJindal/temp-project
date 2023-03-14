import React from 'react';
import { FormValues } from '../StatusChangeModal';
import AlertsStatusChangeModal from './AlertsStatusChangeModal';
import { AlertStatus } from '@/apis';
import { ButtonSize } from '@/components/library/Button';
import StatusChangeButton from '@/pages/case-management/components/StatusChangeButton';

interface Props {
  entityName?: string;
  ids: string[];
  status?: AlertStatus;
  initialValues?: FormValues;
  buttonProps?: {
    size?: ButtonSize | undefined;
    isBlue?: boolean;
    rounded?: boolean;
  };
  onSaved: () => void;
}

export default function AlertsStatusChangeButton(props: Props) {
  const {
    ids,
    onSaved,
    status,
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
      <StatusChangeButton status={status} buttonProps={buttonProps} ids={ids}>
        {({ isVisible, setVisible, newStatus }) => (
          <AlertsStatusChangeModal
            isVisible={isVisible}
            ids={ids}
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
