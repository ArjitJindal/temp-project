import { SimulationHistory } from './SimulationHistory';
import { Feature } from '@/components/AppWrapper/Providers/SettingsProvider';
import { BreadCrumbsWrapper } from '@/components/BreadCrumbsWrapper';
import { makeUrl } from '@/utils/routing';

const ROOT_PATH = '/risk-levels';

export const SimulationHistoryPage = () => {
  const type = 'risk-factors';

  const buildUrl = (path: string) => `${ROOT_PATH}/${type}${path}`;

  const breadcrumbs = [
    {
      title: 'Risk scoring',
      to: makeUrl('/risk-levels/risk-factors/simulation'),
    },
    {
      title: 'Risk factors',
      to: makeUrl(`/risk-levels/risk-factors/simulation`),
    },
    {
      title: 'Simulation history',
      to: buildUrl('/simulation-history'),
    },
  ];

  return (
    <Feature name="RISK_SCORING" fallback={'Not enabled'}>
      <BreadCrumbsWrapper
        simulationStorageKey="SIMULATION_CUSTOM_RISK_FACTORS"
        breadcrumbs={breadcrumbs}
        simulationHistoryUrl={buildUrl('/simulation-history')}
        nonSimulationDefaultUrl={buildUrl('')}
        simulationDefaultUrl={buildUrl('/simulation')}
      >
        <SimulationHistory />
      </BreadCrumbsWrapper>
    </Feature>
  );
};
