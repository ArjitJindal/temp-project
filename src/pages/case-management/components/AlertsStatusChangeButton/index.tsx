import React from 'react';
import { FormValues } from '../StatusChangeModal';
import AlertsStatusChangeModal from './AlertsStatusChangeModal';
import { CaseStatus } from '@/apis';
import { ButtonSize } from '@/components/library/Button';
import StatusChangeButton from '@/pages/case-management/components/StatusChangeButton';

interface Props {
  entityName?: string;
  ids: string[];
  caseStatus?: CaseStatus;
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
      <StatusChangeButton caseStatus={caseStatus} buttonProps={buttonProps} ids={ids}>
        {({ isVisible, setVisible, newCaseStatus }) => (
          <AlertsStatusChangeModal
            isVisible={isVisible}
            ids={ids}
            newCaseStatus={newCaseStatus}
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
