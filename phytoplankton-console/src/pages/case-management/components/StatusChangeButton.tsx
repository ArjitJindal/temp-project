import React, { useMemo, useState } from 'react';
import { compact } from 'lodash';
import { humanizeConstant } from '@flagright/lib/utils/humanize';
import { ActionLabel } from './StatusChangeModal';
import { AlertStatus, CaseStatus, FileInfo, Permission } from '@/apis';
import Button, { ButtonSize } from '@/components/library/Button';
import { CaseReasons } from '@/apis/models/CaseReasons';
import { neverReturn } from '@/utils/lang';
import { getNextStatus } from '@/utils/case-utils';

export const statusToOperationName = (
  status: AlertStatus | CaseStatus | 'IN_REVIEW' | 'IN_PROGRESS' | 'ON_HOLD',
  isPastTense = false,
) => {
  switch (status) {
    case 'OPEN':
      return 'Open';
    case 'CLOSED':
      return 'Close' + (isPastTense ? 'd' : '');
    case 'REOPENED':
      return 'Re-Open' + (isPastTense ? 'ed' : '');
    case 'ESCALATED':
      return 'Escalate' + (isPastTense ? 'd' : '');
    case 'IN_REVIEW_OPEN':
    case 'IN_REVIEW_ESCALATED':
    case 'IN_REVIEW_CLOSED':
    case 'IN_REVIEW_REOPENED':
      return 'In review';
    case 'OPEN_IN_PROGRESS':
    case 'ESCALATED_IN_PROGRESS':
    case 'ESCALATED_L2_IN_PROGRESS':
      return 'In progress';
    case 'OPEN_ON_HOLD':
    case 'ESCALATED_ON_HOLD':
    case 'ESCALATED_L2_ON_HOLD':
      return 'On hold';
    case 'IN_REVIEW':
      return 'In review';
    case 'IN_PROGRESS':
      return 'In progress';
    case 'ON_HOLD':
      return 'On hold';
    case 'ESCALATED_L2':
      return 'Escalated L2';

    default:
      return neverReturn(status, humanizeConstant(status));
  }
};

export interface FormValues {
  reasons: CaseReasons[];
  reasonOther: string | null;
  comment: string | null;
  files: FileInfo[];
}

interface Props {
  ids: string[];
  status?: CaseStatus | AlertStatus;
  buttonProps?: { size?: ButtonSize | undefined; isBlue?: boolean; rounded?: boolean };
  statusTransitions?: Partial<Record<CaseStatus, { status: CaseStatus; actionLabel: ActionLabel }>>;
  isDisabled?: boolean;
  className?: string;
  haveModal?: boolean;
}
interface ChildrenProps {
  isVisible: boolean;
  setVisible: (newVisible: boolean) => void;
  newStatus: CaseStatus | AlertStatus;
}

interface StatusChangeButtonWithoutModalProps extends Props {
  haveModal: false;
  updateModalState: (newState: CaseStatus) => void;
  setModalVisibility: (newVisible: boolean) => void;
}

interface StatusChangeButtonWithModalProps extends Props {
  haveModal: true;
  children: (childrenProps: ChildrenProps) => React.ReactNode;
}

export function StatusChangeButton(
  props: StatusChangeButtonWithModalProps | StatusChangeButtonWithoutModalProps,
) {
  const { status, statusTransitions, haveModal } = props;

  const overridenStatus = status ? statusTransitions?.[status] : null;
  const newStatus = useMemo(
    () => overridenStatus?.status ?? getNextStatus(status),
    [overridenStatus, status],
  );
  const requiredPermissions: Permission[] = useMemo(() => {
    return compact([
      'case-management:case-overview:write',
      status === 'CLOSED' ? 'case-management:case-reopen:write' : undefined,
    ]);
  }, [status]);

  return (
    <>
      {haveModal ? (
        <ModalWrapper
          newStatus={newStatus}
          buttonProps={props as StatusChangeButtonWithModalProps}
          requiredPermissions={requiredPermissions}
          overridenStatus={overridenStatus}
        >
          {props.children}
        </ModalWrapper>
      ) : (
        <ModalButton
          {...props}
          newStatus={newStatus}
          requiredPermissions={requiredPermissions}
          overridenStatus={overridenStatus}
        />
      )}
    </>
  );
}

const ModalWrapper = ({
  newStatus,
  buttonProps,
  requiredPermissions,
  overridenStatus,
  children,
}: {
  newStatus: CaseStatus;
  requiredPermissions: Permission[];
  overridenStatus:
    | {
        status: CaseStatus;
        actionLabel: ActionLabel;
      }
    | null
    | undefined;
  buttonProps: StatusChangeButtonWithModalProps;
  children: (childrenProps: ChildrenProps) => React.ReactNode;
}) => {
  const [isModalVisible, setModalVisible] = useState(false);
  const handleModalState = (visible: boolean) => {
    setModalVisible(visible);
  };

  return (
    <>
      {buttonProps.ids.length > 0 && (
        <ModalButton
          {...buttonProps}
          haveModal={false}
          updateModalState={(_: CaseStatus) => {}}
          setModalVisibility={handleModalState}
          requiredPermissions={requiredPermissions}
          overridenStatus={overridenStatus}
          newStatus={newStatus}
        />
      )}
      {children({ isVisible: isModalVisible, setVisible: setModalVisible, newStatus })}
    </>
  );
};

const ModalButton = (
  props: StatusChangeButtonWithoutModalProps & {
    newStatus: CaseStatus;
    requiredPermissions: Permission[];
    overridenStatus:
      | {
          status: CaseStatus;
          actionLabel: ActionLabel;
        }
      | null
      | undefined;
  },
) => {
  const {
    ids,
    buttonProps = {},
    isDisabled = false,
    className,
    updateModalState,
    setModalVisibility,
    newStatus,
    requiredPermissions,
    overridenStatus,
  } = props;

  return (
    <>
      {ids.length > 0 && (
        <Button
          type="TETRIARY"
          analyticsName={`update-status-${newStatus}`}
          onClick={() => {
            updateModalState(newStatus);
            setModalVisibility(true);
          }}
          isDisabled={isDisabled ? isDisabled : !ids.length}
          size={buttonProps.size}
          style={{ width: 'max-content' }}
          testName="update-status-button"
          requiredPermissions={requiredPermissions}
          className={className}
        >
          {overridenStatus?.actionLabel ?? statusToOperationName(newStatus)}
        </Button>
      )}
    </>
  );
};
