import React from 'react';
import { ActionLabel, FormValues } from '../StatusChangeModal';
import { TableUser } from '../../CaseTable/types';
import AlertsStatusChangeModal, {
  Props as AlertsStatusChangeModalProps,
} from './AlertsStatusChangeModal';
import { AlertStatus } from '@/apis';
import { ButtonProps } from '@/components/library/Button';
import { StatusChangeButton } from '@/pages/case-management/components/StatusChangeButton';

export interface AlertsStatusChangeButtonProps {
  entityName?: string;
  ids: string[];
  transactionIds: { [alertId: string]: string[] };
  caseId?: string;
  status?: AlertStatus;
  initialValues?: Partial<FormValues>;
  buttonProps?: Partial<ButtonProps>;
  statusTransitions?: Partial<
    Record<AlertStatus, { status: AlertStatus; actionLabel: ActionLabel }>
  >;
  onSaved: () => void;
  isDisabled?: boolean;
  skipReasonsModal?: boolean;
  user?: TableUser;
}

interface AlertsStatusChangeButtonWithoutModalProps extends AlertsStatusChangeButtonProps {
  haveModal: false;
  updateModalState: (newState: AlertsStatusChangeModalProps) => void;
  setModalVisibility: (visibility: boolean) => void;
}

interface AlertsStatusChangeButtonWithModalProps extends AlertsStatusChangeButtonProps {
  haveModal: true;
}

export default function AlertsStatusChangeButton(
  props: AlertsStatusChangeButtonWithModalProps | AlertsStatusChangeButtonWithoutModalProps,
) {
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
    haveModal = true,
    user,
  } = props;

  return (
    <>
      {haveModal ? (
        <StatusChangeButton
          status={status}
          buttonProps={buttonProps}
          ids={ids}
          statusTransitions={statusTransitions}
          isDisabled={isDisabled}
          haveModal={haveModal}
          entityType="alert"
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
              user={user}
              onClose={() => {
                setVisible(false);
              }}
              skipReasonsModal={props.skipReasonsModal}
            />
          )}
        </StatusChangeButton>
      ) : (
        <StatusChangeButton
          status={status}
          buttonProps={buttonProps}
          ids={ids}
          statusTransitions={statusTransitions}
          isDisabled={isDisabled}
          haveModal={haveModal}
          entityType="alert"
          updateModalState={(newStatus: AlertStatus) => {
            (props as AlertsStatusChangeButtonWithoutModalProps).updateModalState({
              isVisible: true,
              entityIds: ids,
              transactionIds: transactionIds,
              caseId: caseId,
              oldStatus: status,
              newStatus: newStatus,
              onSaved: onSaved,
              newStatusActionLabel: status && statusTransitions?.[status]?.actionLabel,
              initialValues: initialValues,
              skipReasonsModal: props.skipReasonsModal,
              user: user,
              onClose: () =>
                (props as AlertsStatusChangeButtonWithoutModalProps).setModalVisibility(false),
            });
          }}
          setModalVisibility={(visibility: boolean) => {
            (props as AlertsStatusChangeButtonWithoutModalProps).setModalVisibility(visibility);
          }}
        />
      )}
    </>
  );
}
