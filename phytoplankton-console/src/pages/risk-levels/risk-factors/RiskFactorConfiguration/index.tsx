import { useMemo, useRef, useState } from 'react';
import { EditOutlined } from '@ant-design/icons';
import { useLocation, useNavigate } from 'react-router';
import s from './style.module.less';
import RiskFactorConfigurationForm, { STEPS } from './RiskFactorConfigurationForm';
import { deserializeRiskItem, RiskFactorConfigurationFormValues } from './utils';
import Button from '@/components/library/Button';
import { FormRef } from '@/components/library/Form';
import { useHasResources } from '@/utils/user-utils';
import ArrowLeftSLineIcon from '@/components/ui/icons/Remix/system/arrow-left-s-line.react.svg';
import ArrowRightSLineIcon from '@/components/ui/icons/Remix/system/arrow-right-s-line.react.svg';
import { RiskFactor } from '@/apis';
import { makeUrl } from '@/utils/routing';
import { useApi } from '@/api';
import { useQuery } from '@/utils/queries/hooks';
import { NEW_RISK_FACTOR_ID, RISK_FACTOR_WORKFLOW_PROPOSAL_ITEM } from '@/utils/queries/keys';
import AsyncResourceRenderer from '@/components/utils/AsyncResourceRenderer';
import { useBulkRerunUsersStatus } from '@/utils/batch-rerun-users';
import Tooltip from '@/components/library/Tooltip';
import { useFeatureEnabled } from '@/components/AppWrapper/Providers/SettingsProvider';
import ApprovalHeader from '@/pages/risk-levels/risk-factors/RiskFactorConfiguration/ApprovalHeader';
import SpecialAttributesChanges from '@/pages/risk-levels/risk-factors/RiskFactorConfiguration/SpecialAttributesChanges';

interface Props {
  riskItemType: 'consumer' | 'business' | 'transaction';
  mode: 'CREATE' | 'EDIT' | 'READ' | 'DUPLICATE';
  id?: string;
  riskItem?: RiskFactor;
  onSubmit: (values: RiskFactorConfigurationFormValues, riskItem?: RiskFactor) => void;
  isLoading?: boolean;
  dataKey?: string;
}

interface LocationState {
  prefill?: RiskFactor;
}

export const RiskFactorConfiguration = (props: Props) => {
  const { riskItemType, mode, id, riskItem, onSubmit, isLoading, dataKey } = props;
  const navigate = useNavigate();
  const location = useLocation();
  const canWriteRiskFactors = useHasResources(['write:::risk-scoring/risk-factors/*']);
  const [activeStepKey, setActiveStepKey] = useState(STEPS[0]);
  const activeStepIndex = STEPS.findIndex((key) => key === activeStepKey);
  const formRef = useRef<FormRef<any>>(null);

  const isMutable = useMemo(() => ['CREATE', 'EDIT', 'DUPLICATE'].includes(mode), [mode]);

  const locationState = location.state as LocationState;
  const prefillData = locationState?.prefill;
  const formInitialValues = prefillData
    ? deserializeRiskItem(prefillData)
    : riskItem
    ? deserializeRiskItem(riskItem)
    : undefined;

  const navigateToRiskFactors = () => {
    if (dataKey) {
      navigate(makeUrl(`/risk-levels/risk-factors/simulation`), { replace: true });
    } else {
      navigate(makeUrl(`/risk-levels/risk-factors/:type`, { type: riskItemType }), {
        replace: true,
      });
    }
  };
  const api = useApi();
  const queryResult = useQuery<string | undefined>(NEW_RISK_FACTOR_ID(id), async () => {
    const newRiskId = await api.getNewRiskFactorId({ riskId: id });
    return newRiskId.riskFactorId;
  });

  const riskScoringRerun = useBulkRerunUsersStatus();
  const isApprovalWorkflowsEnabled = useFeatureEnabled('APPROVAL_WORKFLOWS');

  const { data: pendingProposalRes } = useQuery(
    RISK_FACTOR_WORKFLOW_PROPOSAL_ITEM(id ?? 'NEW'),
    async () => {
      if (id == null || !isApprovalWorkflowsEnabled) {
        return null;
      }
      const proposals = await api.getPulseRiskFactorsWorkflowProposal({
        riskFactorId: id,
      });
      return proposals.find((x) => x.riskFactor.id === id) ?? null;
    },
  );
  const [showProposalFlag, setShowProposalFlag] = useState(true);

  return (
    <AsyncResourceRenderer resource={pendingProposalRes}>
      {(pendingProposal) => {
        const proposalFormValues = pendingProposal
          ? deserializeRiskItem(pendingProposal.riskFactor)
          : undefined;
        const showProposal = showProposalFlag && pendingProposal != null;
        return (
          <>
            <AsyncResourceRenderer resource={queryResult.data}>
              {(riskFactorId) => (
                <div className={s.root}>
                  {isApprovalWorkflowsEnabled && id != null && pendingProposal != null && (
                    <ApprovalHeader
                      riskFactorId={id}
                      pendingProposal={pendingProposal}
                      showProposalState={[showProposalFlag, setShowProposalFlag]}
                      onProposalActionSuccess={(action) => {
                        if (action === 'cancel') {
                          if (pendingProposal.action === 'create') {
                            // todo: navigate to table
                            navigateToRiskFactors();
                          } else {
                            // todo: do nothing?
                          }
                        } else if (action === 'accept') {
                          if (pendingProposal.action === 'delete') {
                            navigateToRiskFactors();
                          } else {
                            // todo: do nothing?
                          }
                        } else if (action === 'reject') {
                          if (pendingProposal.action === 'create') {
                            navigateToRiskFactors();
                          } else {
                            // todo: do nothing?
                          }
                        }
                      }}
                    />
                  )}
                  {showProposalFlag && pendingProposal && riskItem && (
                    <SpecialAttributesChanges
                      pendingProposal={pendingProposal}
                      riskItem={riskItem}
                    />
                  )}
                  <RiskFactorConfigurationForm
                    ref={formRef}
                    key={showProposal ? 'SHOWING_PROPOSAL' : `${id ?? 'NEW'}`}
                    activeStepKey={activeStepKey}
                    readonly={!canWriteRiskFactors || mode === 'READ' || pendingProposal != null}
                    onActiveStepChange={setActiveStepKey}
                    onSubmit={(formValues) => {
                      onSubmit(formValues, riskItem);
                    }}
                    id={id}
                    type={riskItemType}
                    formInitialValues={showProposal ? proposalFormValues : formInitialValues}
                    newRiskId={mode === 'EDIT' || mode === 'READ' ? id : riskFactorId}
                  />
                </div>
              )}
            </AsyncResourceRenderer>
            <div className={s.footerButtons}>
              {(!canWriteRiskFactors || mode === 'EDIT' || mode === 'DUPLICATE') && (
                <Button type="TETRIARY" onClick={navigateToRiskFactors}>
                  Cancel
                </Button>
              )}
              {isMutable && (
                <Button
                  type="TETRIARY"
                  onClick={() => {
                    const nextStep = STEPS[activeStepIndex - 1];
                    setActiveStepKey(nextStep);
                  }}
                  icon={<ArrowLeftSLineIcon />}
                  isDisabled={activeStepIndex === 0}
                >
                  Previous
                </Button>
              )}
              {(mode === 'EDIT' ||
                mode === 'DUPLICATE' ||
                activeStepIndex !== STEPS.length - 1) && (
                <Button
                  type="SECONDARY"
                  onClick={() => {
                    const nextStep = STEPS[activeStepIndex + 1];
                    setActiveStepKey(nextStep);
                  }}
                  isDisabled={activeStepIndex === STEPS.length - 1}
                  iconRight={<ArrowRightSLineIcon />}
                  testName="drawer-next-button-v8"
                >
                  Next
                </Button>
              )}
              {canWriteRiskFactors && mode === 'CREATE' && activeStepIndex === STEPS.length - 1 && (
                <>
                  <Tooltip
                    title={
                      !canWriteRiskFactors
                        ? "You don't have permission to create risk factors."
                        : riskScoringRerun.data.isAnyJobRunning
                        ? 'Bulk rerun risk scoring is currently running. Please wait until it finishes.'
                        : undefined
                    }
                    placement="top"
                  >
                    <span>
                      <Button
                        htmlType="submit"
                        isLoading={isLoading}
                        isDisabled={!canWriteRiskFactors || riskScoringRerun.data.isAnyJobRunning}
                        onClick={() => {
                          if (!formRef?.current?.validate()) {
                            formRef?.current?.submit(); // To show errors
                            return;
                          }
                          formRef?.current?.submit();
                        }}
                        requiredResources={['write:::risk-scoring/risk-factors/*']}
                        testName="drawer-create-save-button"
                      >
                        Create
                      </Button>
                    </span>
                  </Tooltip>
                </>
              )}
              {canWriteRiskFactors && (mode === 'EDIT' || mode === 'DUPLICATE') && (
                <>
                  <Tooltip
                    title={
                      !canWriteRiskFactors
                        ? "You don't have permission to save risk factors."
                        : riskScoringRerun.data.isAnyJobRunning
                        ? 'Bulk rerun risk scoring is currently running. Please wait until it finishes.'
                        : undefined
                    }
                    placement="top"
                  >
                    <span>
                      <Button
                        htmlType="submit"
                        isLoading={isLoading}
                        isDisabled={!canWriteRiskFactors || riskScoringRerun.data.isAnyJobRunning}
                        onClick={() => {
                          if (!formRef?.current?.validate()) {
                            formRef?.current?.submit(); // To show errors
                            return;
                          }
                          formRef?.current?.submit();
                        }}
                        requiredResources={['write:::risk-scoring/risk-factors/*']}
                        testName="drawer-create-save-button"
                      >
                        Save
                      </Button>
                    </span>
                  </Tooltip>
                </>
              )}
              {canWriteRiskFactors && mode === 'READ' && (
                <Tooltip
                  title={
                    riskScoringRerun.data.isAnyJobRunning
                      ? 'Bulk rerun risk scoring is currently running. Please wait until it finishes.'
                      : undefined
                  }
                  placement="top"
                >
                  <Button
                    type="SECONDARY"
                    isDisabled={riskScoringRerun.data.isAnyJobRunning}
                    onClick={() => {
                      if (dataKey) {
                        navigate(
                          makeUrl(`/risk-levels/risk-factors/simulation-mode/:key/:type/:id/edit`, {
                            type: riskItemType,
                            key: dataKey,
                            id,
                          }),
                          { replace: true },
                        );
                      } else {
                        navigate(
                          makeUrl(`/risk-levels/risk-factors/:type/:id/edit`, {
                            type: riskItemType,
                            id,
                          }),
                          { replace: true },
                        );
                      }
                    }}
                    icon={<EditOutlined />}
                    requiredResources={['write:::risk-scoring/risk-factors/*']}
                    testName={'edit-button'}
                  >
                    Edit
                  </Button>
                </Tooltip>
              )}
            </div>
          </>
        );
      }}
    </AsyncResourceRenderer>
  );
};
