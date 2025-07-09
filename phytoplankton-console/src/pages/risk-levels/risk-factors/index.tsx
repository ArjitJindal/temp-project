import { useNavigate, useParams } from 'react-router';
import { firstLetterUpper } from '@flagright/lib/utils/humanize';
import CustomRiskFactors from './RiskFactor';
import { useRiskFactors } from './utils';
import { BreadCrumbsWrapper } from '@/components/BreadCrumbsWrapper';
import { makeUrl } from '@/utils/routing';
import { notEmpty } from '@/utils/array';
import { Feature, useFeatureEnabled } from '@/components/AppWrapper/Providers/SettingsProvider';
import Tabs, { TabItem } from '@/components/library/Tabs';
import { getOr } from '@/utils/asyncResource';
import { dayjs } from '@/utils/dayjs';
import { exportJsonlFile } from '@/utils/json';
import { useApi } from '@/api';

type ScopeSelectorValue = 'risk-factor' | 'risk-level';

export default function () {
  const isRiskLevelsEnabled = useFeatureEnabled('RISK_LEVELS');
  const isSimulationMode = localStorage.getItem('SIMULATION_CUSTOM_RISK_FACTORS') === 'true';
  const { type } = useParams();
  const navigate = useNavigate();
  const api = useApi();

  const tabItems: TabItem[] = [
    {
      title: 'Risk factors',
      children: <CustomRiskFactors isSimulationMode={isSimulationMode} />,
      key: 'risk-factor',
    },
    isRiskLevelsEnabled && {
      title: 'Risk levels',
      children: null,
      key: 'risk-level',
    },
  ].filter(notEmpty);

  const handleTabChange = (key: ScopeSelectorValue) => {
    if (key === 'risk-level') {
      navigate(makeUrl('/risk-levels/configure'));
    } else {
      if (isSimulationMode) {
        navigate(makeUrl('/risk-levels/risk-factors/simulation'));
      } else {
        navigate(makeUrl('/risk-levels/risk-factors/consumer'));
      }
    }
  };

  const riskFactorsResult = useRiskFactors();

  return (
    <Feature name="RISK_SCORING" fallback={'Not enabled'}>
      <BreadCrumbsWrapper
        simulationStorageKey="SIMULATION_CUSTOM_RISK_FACTORS"
        nonSimulationDefaultUrl="/risk-levels/risk-factors/consumer"
        simulationDefaultUrl="/risk-levels/risk-factors/simulation"
        simulationHistoryUrl="/risk-levels/risk-factors/simulation-history"
        importExport={{
          import: async (file) => {
            await api.postRiskFactorsImport({
              ImportConsoleDataRequest: {
                file,
              },
            });
          },
          export: () => {
            const riskFactors = getOr(riskFactorsResult.data, []);
            exportJsonlFile(riskFactors, `risk-factors-${dayjs().format('YYYY-MM-DD')}`);
          },
          type: 'RISK_FACTORS',
        }}
        breadcrumbs={[
          {
            title: 'Risk scoring',
            to: isSimulationMode
              ? makeUrl('/risk-levels/risk-factors/simulation')
              : makeUrl('/risk-levels/risk-factors/consumer'),
          },
          {
            title: 'Risk factors',
            to: isSimulationMode
              ? makeUrl(`/risk-levels/risk-factors/simulation`)
              : makeUrl(`/risk-levels/risk-factors`),
          },
          !isSimulationMode &&
            ['consumer', 'business', 'transaction'].includes(type || '') && {
              title: firstLetterUpper(type),
              to: makeUrl(`/risk-levels/risk-factors/:type`, { type }),
            },
          isSimulationMode && {
            title: 'Simulate',
            to: makeUrl(`/risk-levels/risk-factors/simulation`),
          },
        ].filter(notEmpty)}
      >
        <Tabs
          defaultActiveKey="risk-factor"
          activeKey="risk-factor"
          type="line"
          items={tabItems}
          onChange={handleTabChange}
        />
      </BreadCrumbsWrapper>
    </Feature>
  );
}
