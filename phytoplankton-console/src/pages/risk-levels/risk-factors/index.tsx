import { useNavigate, useParams } from 'react-router';
import { firstLetterUpper } from '@flagright/lib/utils/humanize';
import CustomRiskFactors from './RiskFactor';
import RiskLevelsConfigurePage from '@/pages/risk-levels/configure';
import { BreadcrumbsSimulationPageWrapper } from '@/components/BreadcrumbsSimulationPageWrapper';
import { makeUrl } from '@/utils/routing';
import { notEmpty } from '@/utils/array';
import { Feature, useFeatureEnabled } from '@/components/AppWrapper/Providers/SettingsProvider';
import Tabs, { TabItem } from '@/components/library/Tabs';

type ScopeSelectorValue = 'risk-factor' | 'risk-level';

export default function () {
  const isRiskLevelsEnabled = useFeatureEnabled('RISK_LEVELS');
  const isSimulationMode = localStorage.getItem('SIMULATION_RISK_LEVELS') === 'true';
  const { type = isSimulationMode ? 'simulation' : 'consumer' } = useParams();
  const navigate = useNavigate();
  const tabItems: TabItem[] = [
    {
      title: 'Risk factors',
      children: <CustomRiskFactors isSimulationMode={isSimulationMode} />,
      key: 'risk-factor',
    },
    isRiskLevelsEnabled && {
      title: 'Risk levels',
      children: <RiskLevelsConfigurePage />,
      key: 'risk-level',
    },
  ].filter(notEmpty);

  const handleTabChange = (key: ScopeSelectorValue) => {
    if (key === 'risk-level') {
      navigate(makeUrl('/risk-levels/configure'));
    } else {
      navigate(makeUrl('/risk-levels/risk-factors/consumer'));
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
          { title: 'Risk scoring', to: makeUrl('/risk-levels') },
          {
            title: 'Risk factors',
            to: makeUrl(`/risk-levels/risk-factors`),
            onClick: () => {
              const storageKey = 'SIMULATION_CUSTOM_RISK_FACTORS';
              const keysToRemove: string[] = [storageKey];
              for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.includes(storageKey)) {
                  keysToRemove.push(key);
                }
              }
              keysToRemove.forEach((key) => {
                localStorage.removeItem(key);
              });
            },
          },
          !isSimulationMode &&
            ['consumer', 'business', 'transaction'].includes(type) && {
              title: firstLetterUpper(type),
              to: makeUrl(`/risk-levels/risk-factors/:type`, { type }),
            },
          ['simulation', 'simulation-history'].includes(type) && {
            title: type === 'simulation-history' ? 'Simulation history' : 'Simulation',
            to: makeUrl(`/risk-levels/risk-factors/:type`, { type }),
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
