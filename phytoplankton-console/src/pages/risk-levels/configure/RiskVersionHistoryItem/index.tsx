import { useNavigate, useParams } from 'react-router-dom';
import { useMemo } from 'react';
import RiskClassificationTable, { parseApiState } from '../RiskClassificationTable';
import RiskLevelsDownloadButton from '../components/RiskLevelsDownloadButton';
import { useRiskClassificationMutation } from '../hooks/useRiskClassificationMutation';
import s from './index.module.less';
import { useApi } from '@/api';
import { BreadCrumbsWrapper } from '@/components/BreadCrumbsWrapper';
import { PageWrapperContentContainer } from '@/components/PageWrapper';
import AsyncResourceRenderer from '@/components/utils/AsyncResourceRenderer';
import { useQuery } from '@/utils/queries/hooks';
import {
  RISK_CLASSIFICATION_WORKFLOW_PROPOSAL,
  RISK_LEVELS_VERSION_HISTORY_ITEM,
} from '@/utils/queries/keys';
import Button from '@/components/library/Button';
import Confirm from '@/components/utils/Confirm';
import { H4 } from '@/components/ui/Typography';
import { useRiskClassificationConfig } from '@/utils/risk-levels';
import Tag from '@/components/library/Tag';
import { message } from '@/components/library/Message';
import { RiskClassificationHistory } from '@/apis/models/RiskClassificationHistory';
import { useFeatureEnabled } from '@/components/AppWrapper/Providers/SettingsProvider';
import { map, match, success } from '@/utils/asyncResource';
import Tooltip from '@/components/library/Tooltip';

export default function RiskVersionHistoryItem() {
  const { versionId } = useParams();
  const api = useApi();

  const queryResult = useQuery<RiskClassificationHistory>(
    RISK_LEVELS_VERSION_HISTORY_ITEM(versionId ?? ''),
    () =>
      api.getRiskLevelVersionHistoryByVersionId({
        versionId: versionId ?? '',
      }),
    {
      enabled: !!versionId,
      onError: (error) => {
        message.fatal(`Version not found: ${error}`, {
          duration: 3,
        });
        navigate('/risk-levels/version-history');
      },
    },
  );
  const riskClassificationConfig = useRiskClassificationConfig();
  const navigate = useNavigate();
  const saveRiskValuesMutation = useRiskClassificationMutation({
    successAction: () => {
      navigate(`/risk-levels/configure`);
      riskClassificationConfig.refetch();
    },
  });

  const isApprovalWorkflowsEnabled = useFeatureEnabled('APPROVAL_WORKFLOWS');
  const { data: pendingProposalRes } = useQuery(
    RISK_CLASSIFICATION_WORKFLOW_PROPOSAL(),
    async () => {
      return await api.getPulseRiskClassificationWorkflowProposal();
    },
    {
      enabled: isApprovalWorkflowsEnabled,
    },
  );
  const isPendingApprovalRes = useMemo(() => {
    if (!isApprovalWorkflowsEnabled) {
      return success(false);
    }
    return map(pendingProposalRes, (value) => value != null);
  }, [isApprovalWorkflowsEnabled, pendingProposalRes]);

  return (
    <BreadCrumbsWrapper
      breadcrumbs={[
        { title: 'Risk levels', to: '/risk-levels' },
        { title: 'Version history', to: '/risk-levels/version-history' },
        { title: versionId ?? '', to: `/risk-levels/version-history/${versionId}` },
      ]}
      simulationHistoryUrl="/risk-levels/version-history"
      simulationDefaultUrl="/risk-levels/configure"
      nonSimulationDefaultUrl="/risk-levels/version-history"
      simulationStorageKey="SIMULATION_RISK_LEVELS"
    >
      <PageWrapperContentContainer>
        <AsyncResourceRenderer resource={queryResult.data}>
          {(data) => {
            return (
              <div className={s.root}>
                <div className={s.header}>
                  <div className={s.title}>
                    <H4 bold>Version ID: {versionId}</H4>
                    {riskClassificationConfig.data.id === versionId && (
                      <Tag color="green">Active</Tag>
                    )}
                  </div>
                  <div className={s.buttons}>
                    {riskClassificationConfig.data.id !== versionId && (
                      <Confirm
                        title="Are you sure you want to restore this configuration?"
                        text="Please note that restoring this version would keep the configuration but save as a new version."
                        onConfirm={() => {
                          saveRiskValuesMutation.mutate({
                            state: parseApiState(data.scores),
                            comment: `Restored from version ${versionId}: ${data.comment}`,
                          });
                        }}
                      >
                        {(props) => {
                          const pendingApprovalMessage: string | undefined = match(
                            isPendingApprovalRes,
                            {
                              init: () => undefined,
                              success: (value) =>
                                value
                                  ? 'There is already pending risk configuration suggestion, unable to restore configuration'
                                  : undefined,
                              loading: () =>
                                'Checking if there is already pending risk configuration suggestion',
                              failed: (message) =>
                                `Unable to check if there is already pending risk configuration suggestion. ${message}`,
                            },
                          );
                          return (
                            <Tooltip title={pendingApprovalMessage}>
                              <Button
                                type="PRIMARY"
                                onClick={props.onClick}
                                isDisabled={pendingApprovalMessage != null}
                              >
                                Restore configuration
                              </Button>
                            </Tooltip>
                          );
                        }}
                      </Confirm>
                    )}
                    <RiskLevelsDownloadButton classificationValues={data.scores} />
                  </div>
                </div>
                <RiskClassificationTable
                  state={parseApiState(data.scores)}
                  isDisabled={true}
                  setState={() => {}}
                />
              </div>
            );
          }}
        </AsyncResourceRenderer>
      </PageWrapperContentContainer>
    </BreadCrumbsWrapper>
  );
}
