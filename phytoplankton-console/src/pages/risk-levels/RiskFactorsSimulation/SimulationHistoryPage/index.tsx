import { useLocalStorageState } from 'ahooks';
import { SimulationHistory } from './SimulationHistory';
import { Feature } from '@/components/AppWrapper/Providers/SettingsProvider';
import { BreadcrumbsSimulationPageWrapper } from '@/components/BreadcrumbsSimulationPageWrapper';

const ROOT_PATH = '/risk-levels';

export const SimulationHistoryPage = () => {
  const type = 'risk-factors';

  const [isSimulationMode] = useLocalStorageState('SIMULATION_CUSTOM_RISK_FACTORS', false);

  const buildUrl = (path: string) => `${ROOT_PATH}/${type}${path}`;

  const breadcrumbs = [
    {
      title: 'Risk factors',
      to: buildUrl(isSimulationMode ? '/simulation' : ''),
    },
    {
      title: 'Simulation history',
      to: buildUrl('/simulation-history'),
    },
  ];

  return (
    <Feature name="RISK_SCORING" fallback={'Not enabled'}>
      <BreadcrumbsSimulationPageWrapper
        storageKey="SIMULATION_CUSTOM_RISK_FACTORS"
        breadcrumbs={breadcrumbs}
        simulationHistoryUrl={buildUrl('/simulation-history')}
        nonSimulationDefaultUrl={buildUrl('')}
        simulationDefaultUrl={buildUrl('/simulation')}
      >
        <SimulationHistory />
      </BreadcrumbsSimulationPageWrapper>
    </Feature>
  );
};
