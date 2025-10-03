import { useParams } from 'react-router-dom';
import RiskClassificationTable, { parseApiState } from '../RiskClassificationTable';
import { usePendingProposal } from '../utils';
import s from './index.module.less';
import { BreadCrumbsWrapper } from '@/components/BreadCrumbsWrapper';
import { PageWrapperContentContainer } from '@/components/PageWrapper';
import AsyncResourceRenderer from '@/components/utils/AsyncResourceRenderer';
import { RiskClassificationScore } from '@/apis';
import { useVersionHistoryItem } from '@/hooks/api/version-history';
import VersionHistoryHeader from '@/components/VersionHistory/RestoreButton';
import { useRiskClassificationConfig } from '@/utils/risk-levels';

export default function RiskVersionHistoryItem() {
  const { versionId } = useParams();
  const queryResult = useVersionHistoryItem('RiskClassification', versionId ?? '');
  const riskClassificationConfig = useRiskClassificationConfig();

  const pendingProposalRes = usePendingProposal();
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
      versionHistory={{
        url: `/risk-levels/version-history`,
      }}
    >
      <PageWrapperContentContainer>
        <AsyncResourceRenderer resource={queryResult.data}>
          {(data) => {
            return (
              <div className={s.root}>
                <VersionHistoryHeader
                  versionId={versionId ?? ''}
                  type="RiskClassification"
                  isActiveCheck={(versionId) => riskClassificationConfig.data.id === versionId}
                  navigateUrl="/risk-levels/configure"
                  handleDownload={() => {}}
                  approvalWorkflows={{
                    pendingProposalRes: pendingProposalRes,
                    messages: {
                      pending:
                        'There is already pending risk configuration suggestion, unable to restore configuration',
                      loading: 'Checking if there is already pending risk configuration suggestion',
                      failed:
                        'Unable to check if there is already pending risk configuration suggestion',
                      init: undefined,
                    },
                  }}
                />
                <RiskClassificationTable
                  state={parseApiState(data.data as RiskClassificationScore[])}
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
