import { usePendingProposal } from '../../utils';
import DefaultActions from './DefaultActions';
import HeaderLayout from './HeaderLayout';
import { Props } from '.';
import AsyncResourceRenderer from '@/components/utils/AsyncResourceRenderer';
import { useWorkflow } from '@/utils/api/workflows';
import { useAccountRawRole, useCurrentUserId } from '@/utils/user-utils';
import Alert from '@/components/library/Alert';
import Button from '@/components/library/Button';
import RiskLevelsDownloadButton from '@/pages/risk-levels/configure/components/RiskLevelsDownloadButton';
import Confirm from '@/components/utils/Confirm';
import Tooltip from '@/components/library/Tooltip';
import { RiskClassificationConfigApproval } from '@/apis';
import { StatePair } from '@/utils/state';
import Label from '@/components/library/Label';
import Toggle from '@/components/library/Toggle';

import { useSendProposalActionMutation } from '@/pages/risk-levels/configure/RiskClassification/helpers';

export default function ApprovalWorkflowActions(props: Props) {
  const { data: pendingProposalRes } = usePendingProposal();

  return (
    <AsyncResourceRenderer resource={pendingProposalRes}>
      {(pendingProposal) => {
        if (pendingProposal == null) {
          return <DefaultActions {...props} />;
        }
        return <PendingProposalActions {...props} pendingProposal={pendingProposal} />;
      }}
    </AsyncResourceRenderer>
  );
}

function PendingProposalActions(
  props: Props & {
    pendingProposal: RiskClassificationConfigApproval;
  },
) {
  const { riskValues, pendingProposal, showProposalState, requiredResources } = props;

  const workflowsQueryResult = useWorkflow('risk-levels-approval', pendingProposal.workflowRef);

  const currentUserId = useCurrentUserId();
  const currentRole = useAccountRawRole();

  const sendProposalActionMutation = useSendProposalActionMutation();

  const [showProposal] = showProposalState;
  const showingProposalState = showProposal;
  const showComment = showingProposalState;

  return (
    <AsyncResourceRenderer resource={workflowsQueryResult.data}>
      {(workflow) => {
        if (workflow.workflowType !== 'risk-levels-approval') {
          throw new Error('Invalid workflow type');
        }
        // If current proposal is not in pending state, only show information about it to the author
        if (pendingProposal.approvalStatus !== 'PENDING') {
          let alertEl;
          if (currentUserId === pendingProposal.createdBy) {
            if (pendingProposal.approvalStatus === 'APPROVED') {
              alertEl = <Alert type="SUCCESS">Your proposal was accepted</Alert>;
            }
            if (pendingProposal.approvalStatus === 'REJECTED') {
              alertEl = <Alert type="ERROR">Your proposal was rejected</Alert>;
            }
          }
          return (
            <HeaderLayout left={alertEl}>
              <DefaultActions {...props} />
            </HeaderLayout>
          );
        }

        const currentStepRole = workflow.approvalChain[pendingProposal.approvalStep ?? 0];
        const isRoleMatching = currentRole === currentStepRole;
        const isCurrentUserAuthor = currentUserId === pendingProposal.createdBy;

        // If proposal created by current user - show specific UI and discard button
        if (isCurrentUserAuthor) {
          return (
            <HeaderLayout
              left={
                <Alert type="WARNING">
                  {`Your changes are pending approval. It must be approved by a user with the "${currentStepRole}" role`}
                </Alert>
              }
              subheader={
                showComment && (
                  <Alert type={'INFO'}>Author`s comment: {pendingProposal.comment}</Alert>
                )
              }
            >
              {showingProposalState && (
                <Confirm
                  text={'Are you sure you want to cancel this proposal?'}
                  onConfirm={() => {
                    sendProposalActionMutation.mutate({ action: 'cancel' });
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
                          isDisabled={isRejectUnavailable || !showingProposalState}
                        >
                          Discard proposal
                        </Button>
                      </Tooltip>
                    );
                  }}
                </Confirm>
              )}
              <ShowProposalButton showProposalState={showProposalState} />
              <RiskLevelsDownloadButton
                classificationValues={riskValues.classificationValues}
                isDisabled={showingProposalState}
              />
            </HeaderLayout>
          );
        }

        // Approval actions if current role matches next required
        if (isRoleMatching) {
          return (
            <HeaderLayout
              left={
                <Alert type="WARNING">
                  There is a pending proposal for risk classification, you need to accept or reject
                  it.
                </Alert>
              }
              subheader={
                showComment && (
                  <Alert type={'INFO'}>Author`s comment: {pendingProposal.comment}</Alert>
                )
              }
            >
              {showingProposalState && (
                <>
                  <Button
                    type="PRIMARY"
                    onClick={() => {
                      sendProposalActionMutation.mutate({ action: 'accept' });
                    }}
                    requiredResources={requiredResources}
                    isDisabled={!showingProposalState}
                  >
                    Accept
                  </Button>
                  <Button
                    type="DANGER"
                    onClick={() => {
                      sendProposalActionMutation.mutate({ action: 'reject' });
                    }}
                    requiredResources={requiredResources}
                    isDisabled={!showingProposalState}
                  >
                    Reject
                  </Button>
                </>
              )}
              <ShowProposalButton showProposalState={showProposalState} />
              <RiskLevelsDownloadButton
                classificationValues={riskValues.classificationValues}
                isDisabled={showingProposalState}
              />
            </HeaderLayout>
          );
        }

        return (
          <HeaderLayout
            left={
              <Alert type="WARNING">
                {`There is a pending proposal for risk classification. You need to have a "${currentStepRole}" role to reject or approve it.`}
              </Alert>
            }
            subheader={
              showComment && (
                <Alert type={'INFO'}>Author`s comment: {pendingProposal.comment}</Alert>
              )
            }
          >
            <ShowProposalButton showProposalState={showProposalState} />
            <RiskLevelsDownloadButton
              classificationValues={riskValues.classificationValues}
              isDisabled={showingProposalState}
            />
          </HeaderLayout>
        );
      }}
    </AsyncResourceRenderer>
  );
}

/*
  Helpers
 */

function ShowProposalButton(props: { showProposalState: StatePair<boolean> }) {
  const { showProposalState } = props;
  const [showProposal, setShowProposal] = showProposalState;
  return (
    <Label label={'Show proposed changes'} position={'RIGHT'}>
      <Toggle
        value={showProposal}
        onChange={() => {
          setShowProposal((x) => !x);
        }}
      />
    </Label>
  );
}
