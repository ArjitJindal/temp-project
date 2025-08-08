import React, { useMemo, useState } from 'react';
import { compact } from 'lodash';
import { humanizeConstant } from '@flagright/lib/utils/humanize';
import { Resource } from '@flagright/lib/utils';
import { ActionLabel } from './StatusChangeModal';
import { AlertStatus, CaseStatus, FileInfo, SanctionsHitStatus } from '@/apis';
import Button, { ButtonProps } from '@/components/library/Button';
import { CaseReasons } from '@/apis/models/CaseReasons';
import { neverReturn } from '@/utils/lang';
import { getNextStatus } from '@/utils/case-utils';
import { useApi } from '@/api';
import { useMutation } from '@/utils/queries/mutations/hooks';
import { isLoading } from '@/utils/asyncResource';
import Confirm from '@/components/utils/Confirm';
import { useFeatureEnabled } from '@/components/AppWrapper/Providers/SettingsProvider';

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
  buttonProps?: Partial<ButtonProps>;
  statusTransitions?: Partial<Record<CaseStatus, { status: CaseStatus; actionLabel: ActionLabel }>>;
  isDisabled?: boolean;
  className?: string;
  haveModal?: boolean;
  entityType: 'alert' | 'case';
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

  const requiredResources: Resource[] = useMemo(() => {
    return compact([
      'write:::case-management/case-overview/*',
      status === 'CLOSED' ? 'write:::case-management/case-reopen/*' : undefined,
    ]);
  }, [status]);

  return (
    <>
      {haveModal ? (
        <ModalWrapper
          newStatus={newStatus}
          buttonProps={props as StatusChangeButtonWithModalProps}
          requiredResources={requiredResources}
          overridenStatus={overridenStatus}
        >
          {props.children}
        </ModalWrapper>
      ) : (
        <ModalButton
          {...props}
          newStatus={newStatus}
          overridenStatus={overridenStatus}
          requiredResources={requiredResources}
        />
      )}
    </>
  );
}

const ModalWrapper = ({
  newStatus,
  buttonProps,
  requiredResources,
  overridenStatus,
  children,
}: {
  newStatus: CaseStatus;
  requiredResources: Resource[];
  overridenStatus: { status: CaseStatus; actionLabel: ActionLabel } | null | undefined;
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
          overridenStatus={overridenStatus}
          newStatus={newStatus}
          requiredResources={requiredResources}
        />
      )}
      {children({ isVisible: isModalVisible, setVisible: setModalVisible, newStatus })}
    </>
  );
};

const ModalButton = (
  props: StatusChangeButtonWithoutModalProps & {
    newStatus: CaseStatus;
    requiredResources: Resource[];
    overridenStatus: { status: CaseStatus; actionLabel: ActionLabel } | null | undefined;
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
    overridenStatus,
    requiredResources,
    entityType,
  } = props;

  const api = useApi();
  const isSanctionsEnabled = useFeatureEnabled('SANCTIONS');
  const sanctionsHitsMutation = useMutation(async (alertId: string) => {
    return await api.searchSanctionsHits({
      alertId,
      filterStatus: ['OPEN' as SanctionsHitStatus],
      pageSize: 1,
    });
  });

  const handleButtonClick = async () => {
    if (
      isSanctionsEnabled &&
      entityType === 'alert' &&
      ['CLOSED', 'ESCALATED', 'ESCALATED_L2'].includes(newStatus) &&
      ids.length > 0
    ) {
      const response = await sanctionsHitsMutation.mutateAsync(ids[0]);
      if (response.items && response.items.length > 0) {
        return true;
      }
    }

    updateModalState(newStatus);
    setModalVisibility(true);
    return false;
  };

  return (
    <>
      {ids.length > 0 && (
        <Confirm
          text={`There are pending hits that require human review. Are you sure you want to ${
            newStatus === 'CLOSED' ? 'close' : 'escalate'
          } this alert?`}
          onConfirm={() => {
            updateModalState(newStatus);
            setModalVisibility(true);
          }}
          isDanger
        >
          {({ onClick }) => (
            <Button
              type="TETRIARY"
              analyticsName={`update-status-${newStatus}`}
              onClick={async () => {
                const needsConfirmation = await handleButtonClick();
                if (needsConfirmation) {
                  onClick();
                }
              }}
              isDisabled={
                isDisabled || isLoading(sanctionsHitsMutation.dataResource) || !ids.length
              }
              style={{ width: 'max-content' }}
              testName="update-status-button"
              requiredResources={requiredResources}
              className={className}
              {...buttonProps}
            >
              {overridenStatus?.actionLabel ?? statusToOperationName(newStatus)}
            </Button>
          )}
        </Confirm>
      )}
    </>
  );
};
