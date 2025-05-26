import { useNavigate, useParams } from 'react-router';
import { firstLetterUpper } from '@flagright/lib/utils/humanize';
import CustomRiskFactors from './RiskFactor';
import { BreadcrumbsSimulationPageWrapper } from '@/components/BreadcrumbsSimulationPageWrapper';
import { makeUrl } from '@/utils/routing';
import { notEmpty } from '@/utils/array';
import { Feature, useFeatureEnabled } from '@/components/AppWrapper/Providers/SettingsProvider';
import Tabs, { TabItem } from '@/components/library/Tabs';

type ScopeSelectorValue = 'risk-factor' | 'risk-level';

export default function () {
  const isRiskLevelsEnabled = useFeatureEnabled('RISK_LEVELS');
  const isSimulationMode = localStorage.getItem('SIMULATION_CUSTOM_RISK_FACTORS') === 'true';
  const { type } = useParams();
  const navigate = useNavigate();
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

  return (
    <Feature name="RISK_SCORING" fallback={'Not enabled'}>
      <BreadcrumbsSimulationPageWrapper
        storageKey="SIMULATION_CUSTOM_RISK_FACTORS"
        nonSimulationDefaultUrl="/risk-levels/risk-factors/consumer"
        simulationDefaultUrl="/risk-levels/risk-factors/simulation"
        simulationHistoryUrl="/risk-levels/risk-factors/simulation-history"
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
      </BreadcrumbsSimulationPageWrapper>
    </Feature>
  );
}
