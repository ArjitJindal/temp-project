import React from 'react';
import CasesStatusChangeModal, {
  Props as CasesStatusChangeModalProps,
} from './CasesStatusChangeModal';
import { CaseStatus } from '@/apis';
import { ButtonSize } from '@/components/library/Button';
import { StatusChangeButton } from '@/pages/case-management/components/StatusChangeButton';
import { ActionLabel, FormValues } from '@/pages/case-management/components/StatusChangeModal';

export interface CasesStatusChangeButtonProps {
  caseIds: string[];
  caseStatus?: CaseStatus;
  initialValues?: FormValues;
  buttonProps?: { size?: ButtonSize | undefined; isBlue?: boolean; rounded?: boolean };
  statusTransitions?: Partial<Record<CaseStatus, { status: CaseStatus; actionLabel: ActionLabel }>>;
  onSaved: (status?: CaseStatus) => void;
  isDisabled?: boolean;
  skipReasonsModal?: boolean;
  className?: string;
}
interface CasesStatusChangeButtonWithoutModalProps extends CasesStatusChangeButtonProps {
  haveModal: false;
  updateModalState: (newState: CasesStatusChangeModalProps) => void;
  setModalVisibility: (visibility: boolean) => void;
}
interface CasesStatusChangeButtonWithModalProps extends CasesStatusChangeButtonProps {
  haveModal: true;
}

export default function CasesStatusChangeButton(
  props: CasesStatusChangeButtonWithModalProps | CasesStatusChangeButtonWithoutModalProps,
) {
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
    haveModal = true,
  } = props;

  return (
    <>
      {haveModal ? (
        <StatusChangeButton
          ids={caseIds}
          status={caseStatus}
          buttonProps={buttonProps}
          statusTransitions={statusTransitions}
          isDisabled={isDisabled}
          className={className}
          haveModal={haveModal}
        >
          {({ isVisible, setVisible, newStatus }) => (
            <CasesStatusChangeModal
              isVisible={isVisible}
              entityIds={caseIds}
              oldStatus={caseStatus}
              newStatus={newStatus}
              newStatusActionLabel={caseStatus && statusTransitions?.[caseStatus]?.actionLabel}
              onSaved={() => onSaved(newStatus)}
              initialValues={initialValues}
              onClose={() => {
                setVisible(false);
              }}
              skipReasonsModal={props.skipReasonsModal}
            />
          )}
        </StatusChangeButton>
      ) : (
        <StatusChangeButton
          ids={caseIds}
          status={caseStatus}
          buttonProps={buttonProps}
          statusTransitions={statusTransitions}
          isDisabled={isDisabled}
          className={className}
          haveModal={haveModal}
          updateModalState={(newStatus: CaseStatus) => {
            (props as CasesStatusChangeButtonWithoutModalProps).updateModalState({
              isVisible: true,
              entityIds: caseIds,
              oldStatus: caseStatus,
              newStatus,
              newStatusActionLabel: caseStatus && statusTransitions?.[caseStatus]?.actionLabel,
              onSaved: () => onSaved(newStatus),
              initialValues,
              onClose: () =>
                (props as CasesStatusChangeButtonWithoutModalProps).setModalVisibility(false),
              skipReasonsModal: props.skipReasonsModal,
            });
          }}
          setModalVisibility={(visibility: boolean) => {
            (props as CasesStatusChangeButtonWithoutModalProps).setModalVisibility(visibility);
          }}
        />
      )}
    </>
  );
}
