import { Resource } from '@flagright/lib/utils';
import s from './index.module.less';
import AsyncResourceRenderer from '@/components/utils/AsyncResourceRenderer';
import { useAccountRawRole, useCurrentUserId } from '@/utils/user-utils';
import { useWorkflow } from '@/utils/api/workflows';
import { RiskFactorApproval, RiskFactorsApprovalRequestActionEnum } from '@/apis';
import Alert from '@/components/library/Alert';
import Button from '@/components/library/Button';
import Tooltip from '@/components/library/Tooltip';
import { useSendProposalActionMutation } from '@/pages/risk-levels/risk-factors/RiskFactorConfiguration/ApprovalHeader/helpers';
import Confirm from '@/components/utils/Confirm';
import { isLoading } from '@/utils/asyncResource';
import { StatePair } from '@/utils/state';
import Label from '@/components/library/Label';
import Toggle from '@/components/library/Toggle';
import { neverReturn } from '@/utils/lang';

type Props = {
  riskFactorId: string;
  showProposalState: StatePair<boolean>;
  pendingProposal: RiskFactorApproval;
  onProposalActionSuccess: (action: RiskFactorsApprovalRequestActionEnum) => void;
};

const requiredResources: Resource[] = ['write:::risk-scoring/risk-factors/*'];

export default function ApprovalHeader(props: Props) {
  const { riskFactorId, pendingProposal, showProposalState, onProposalActionSuccess } = props;
  const currentUserId = useCurrentUserId();
  const currentRole = useAccountRawRole();

  const [showProposal, setShowProposal] = showProposalState;

  const workflowsQueryResult = useWorkflow('risk-factors-approval', pendingProposal.workflowRef);
  const sendProposalActionMutation = useSendProposalActionMutation(onProposalActionSuccess);

  return (
    <AsyncResourceRenderer resource={workflowsQueryResult.data}>
      {(workflow) => {
        const currentStepRole = workflow.approvalChain[pendingProposal.approvalStep ?? 0];
        const isRoleMatching = currentRole === currentStepRole;
        const isCurrentUserAuthor = currentUserId === pendingProposal.createdBy;

        return (
          <div className={s.root}>
            <div className={s.top}>
              <InformationAlert
                currentStepRole={currentStepRole}
                isRoleMatching={isRoleMatching}
                isCurrentUserAuthor={isCurrentUserAuthor}
                pendingProposal={pendingProposal}
              />

              <div className={s.buttons}>
                {isCurrentUserAuthor && (
                  <Confirm
                    text={'Are you sure you want to cancel this proposal?'}
                    onConfirm={() => {
                      sendProposalActionMutation.mutate({ riskFactorId, action: 'cancel' });
                    }}
                  >
                    {({ onClick }) => {
                      const isRejectUnavailable =
                        pendingProposal.approvalStep != null && pendingProposal.approvalStep > 0;
                      let tooltipMessage: string | null = null;
                      if (isRejectUnavailable) {
                        tooltipMessage =
                          'This proposal has already passed first approval step, it is not possible to discard it now';
                      }
                      return (
                        <Tooltip trigger={'hover'} title={tooltipMessage}>
                          <Button
                            type="DANGER"
                            onClick={onClick}
                            isDisabled={isRejectUnavailable}
                            isLoading={isLoading(sendProposalActionMutation.dataResource)}
                          >
                            Discard proposal
                          </Button>
                        </Tooltip>
                      );
                    }}
                  </Confirm>
                )}
                {isRoleMatching && (
                  <>
                    <Button
                      type="PRIMARY"
                      onClick={() => {
                        sendProposalActionMutation.mutate({ riskFactorId, action: 'accept' });
                      }}
                      requiredResources={requiredResources}
                      isLoading={isLoading(sendProposalActionMutation.dataResource)}
                    >
                      Accept
                    </Button>
                    <Button
                      type="DANGER"
                      onClick={() => {
                        sendProposalActionMutation.mutate({ riskFactorId, action: 'reject' });
                      }}
                      requiredResources={requiredResources}
                      isLoading={isLoading(sendProposalActionMutation.dataResource)}
                    >
                      Reject
                    </Button>
                  </>
                )}
                {pendingProposal.action === 'update' && (
                  <Label label={'Show proposed changes'} position={'RIGHT'}>
                    <Toggle
                      value={showProposal}
                      onChange={() => {
                        setShowProposal((x) => !x);
                      }}
                    />
                  </Label>
                )}
              </div>
            </div>
            <Alert type={'INFO'}>Author`s comment: {pendingProposal.comment}</Alert>
          </div>
        );
      }}
    </AsyncResourceRenderer>
  );
}

function InformationAlert(props: {
  currentStepRole: string;
  isRoleMatching: boolean;
  isCurrentUserAuthor: boolean;
  pendingProposal: RiskFactorApproval;
}) {
  const { currentStepRole, isRoleMatching, isCurrentUserAuthor, pendingProposal } = props;
  let message;
  if (pendingProposal.action === 'create') {
    if (isRoleMatching) {
      message = `Before risk factor created, you need to reject or approve it`;
    } else {
      message = `Before risk factor created it must be approved by a user with the "${currentStepRole}" role`;
    }
  } else if (pendingProposal.action === 'delete') {
    if (isRoleMatching) {
      message = `Before risk factor deleted, you need to reject or approve it`;
    } else {
      message = `Before risk factor deleted it must be approved by a user with the "${currentStepRole}" role`;
    }
  } else if (pendingProposal.action === 'update') {
    if (isCurrentUserAuthor) {
      message = `Your changes are pending approval. It must be approved by a user with the "${currentStepRole}" role`;
    } else if (isRoleMatching) {
      message = `There is a pending proposal for risk classification, you need to accept or reject it.`;
    } else {
      message = `There is a pending proposal for risk classification. You need to have a "${currentStepRole}" role to reject or approve it.`;
    }
  } else {
    message = neverReturn(pendingProposal.action, 'There are changes pending approval');
  }
  return <Alert type="WARNING">{message}</Alert>;
  // return <Alert type="WARNING">
  //   {isCurrentUserAuthor &&
  //     `Your changes are pending approval. It must be approved by a user with the "${currentStepRole}" role`}
  //   {!isCurrentUserAuthor &&
  //     isRoleMatching &&
  //     `There is a pending proposal for risk classification, you need to accept or reject it.`}
  //   {!isCurrentUserAuthor &&
  //     !isRoleMatching &&
  //     `There is a pending proposal for risk classification. You need to have a "${currentStepRole}" role to reject or approve it.`}
  // </Alert>
}
