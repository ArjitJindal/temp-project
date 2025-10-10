import CasesStatusChangeButton from '../CasesStatusChangeButton';
import AlertsStatusChangeButton from '../AlertsStatusChangeButton';
import { Feature } from '@/components/AppWrapper/Providers/SettingsProvider';
import { CaseStatus } from '@/apis';

type Props = {
  ids: string[];
  onReload: () => void;
  type: 'CASE' | 'ALERT';
  isDisabled?: boolean;
  status: CaseStatus;
  previousStatus: CaseStatus;
  isApproveHidden?: boolean;
  isDeclineHidden?: boolean;
  selectedCaseId?: string;
};

export const APPROVE_STATUS_TRANSITIONS: Partial<
  Record<CaseStatus, { status: CaseStatus; actionLabel: 'Approve' }>
> = {
  IN_REVIEW_OPEN: { status: 'OPEN', actionLabel: 'Approve' },
  IN_REVIEW_ESCALATED: { status: 'ESCALATED', actionLabel: 'Approve' },
  IN_REVIEW_CLOSED: { status: 'CLOSED', actionLabel: 'Approve' },
  IN_REVIEW_REOPENED: { status: 'REOPENED', actionLabel: 'Approve' },
};

export const DECLINE_STATUS_TRANSITIONS: Partial<
  Record<CaseStatus, { status: CaseStatus; actionLabel: 'Decline' }>
> = {
  OPEN: { status: 'OPEN', actionLabel: 'Decline' },
  ESCALATED: { status: 'ESCALATED', actionLabel: 'Decline' },
  CLOSED: { status: 'CLOSED', actionLabel: 'Decline' },
  REOPENED: { status: 'REOPENED', actionLabel: 'Decline' },
};

export const ApproveSendBackButton = (props: Props) => {
  const { ids, onReload, type, isDisabled } = props;
  return (
    <Feature name="ADVANCED_WORKFLOWS">
      {type === 'CASE' ? (
        <>
          {!props.isApproveHidden && (
            <CasesStatusChangeButton
              caseIds={ids}
              onSaved={onReload}
              isDisabled={isDisabled}
              caseStatus={props.status}
              statusTransitions={APPROVE_STATUS_TRANSITIONS}
              skipReasonsModal
              haveModal={true}
            />
          )}
          {!props.isDeclineHidden && (
            <CasesStatusChangeButton
              caseIds={ids}
              onSaved={onReload}
              isDisabled={isDisabled}
              caseStatus={props.previousStatus}
              statusTransitions={DECLINE_STATUS_TRANSITIONS}
              skipReasonsModal
              haveModal={true}
            />
          )}
        </>
      ) : (
        <>
          {!props.isApproveHidden && (
            <AlertsStatusChangeButton
              ids={ids}
              onSaved={onReload}
              isDisabled={isDisabled}
              transactionIds={{}}
              status={props.status}
              statusTransitions={APPROVE_STATUS_TRANSITIONS}
              skipReasonsModal
              caseId={props.selectedCaseId}
              haveModal={true}
            />
          )}
          {!props.isDeclineHidden && (
            <AlertsStatusChangeButton
              ids={ids}
              onSaved={onReload}
              isDisabled={isDisabled}
              transactionIds={{}}
              status={props.previousStatus}
              statusTransitions={DECLINE_STATUS_TRANSITIONS}
              skipReasonsModal
              caseId={props.selectedCaseId}
              haveModal={true}
            />
          )}
        </>
      )}
    </Feature>
  );
};
