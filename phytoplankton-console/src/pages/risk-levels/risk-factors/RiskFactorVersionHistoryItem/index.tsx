import { useParams } from 'react-router';
import RiskFactorsTable from '../RiskFactorsTable';
import { ScopeSelectorValue, scopeToRiskEntityType } from '../RiskFactorsTable/utils';
import s from './index.module.less';
import { useMaxVersionIdRiskFactors, useVersionHistoryItem } from '@/hooks/api/version-history';
import type { RiskFactor } from '@/apis';
import { BreadCrumbsWrapper } from '@/components/BreadCrumbsWrapper';
import VersionHistoryHeader from '@/components/VersionHistory/RestoreButton';
import { map } from '@/utils/queries/types';

export default function RiskFactorVersionHistoryItem() {
  const { versionId } = useParams();
  const queryResult = useVersionHistoryItem('RiskFactors', versionId ?? '');
  const { type } = useParams();
  const maxVersionId = useMaxVersionIdRiskFactors();

  return (
    <BreadCrumbsWrapper
      breadcrumbs={[
        { title: 'Risk levels', to: '/risk-levels' },
        { title: 'Risk factors', to: '/risk-levels/risk-factors/consumer' },
        { title: 'Version history', to: '/risk-levels/risk-factors/version-history' },
        {
          title: versionId ?? '',
          to: `/risk-levels/risk-factors/version-history/${versionId}/${type}`,
        },
      ]}
      simulationHistoryUrl="/risk-levels/risk-factors/simulation-history"
      simulationDefaultUrl="/risk-levels/risk-factors/simulation"
      nonSimulationDefaultUrl="/risk-levels/risk-factors/version-history"
      simulationStorageKey="SIMULATION_CUSTOM_RISK_FACTORS"
      versionHistory={{
        url: `/risk-levels/risk-factors/version-history`,
      }}
    >
      <div className={s.root}>
        <VersionHistoryHeader
          versionId={versionId ?? ''}
          type="RiskFactors"
          isActiveCheck={(versionId) => !!maxVersionId && versionId === maxVersionId}
          navigateUrl="/risk-levels/risk-factors/version-history"
        />
      </div>
      <RiskFactorsTable
        queryResults={(type) =>
          map(queryResult, (data) => ({
            items: (data.data as RiskFactor[]).filter(
              (item) => scopeToRiskEntityType(type) === item.type,
            ),
          }))
        }
        mode="version-history"
        type={type as ScopeSelectorValue}
        baseUrl={`/risk-levels/risk-factors/version-history/${versionId}`}
      />
    </BreadCrumbsWrapper>
  );
}
