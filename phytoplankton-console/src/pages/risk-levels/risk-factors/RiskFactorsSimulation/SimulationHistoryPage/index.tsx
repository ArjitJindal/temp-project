import { useLocalStorageState } from 'ahooks';
import { SimulationHistory } from './SimulationHistory';
import { Feature } from '@/components/AppWrapper/Providers/SettingsProvider';
import { BreadcrumbsSimulationPageWrapper } from '@/components/BreadcrumbsSimulationPageWrapper';
import { notEmpty } from '@/utils/array';

export const SimulationHistoryPage = () => {
  const [isSimulationMode] = useLocalStorageState('SIMULATION_RISK_FACTORS', false);
  return (
    <Feature name="RISK_SCORING" fallback={'Not enabled'}>
      <BreadcrumbsSimulationPageWrapper
        storageKey={'SIMULATION_RISK_FACTORS'}
        breadcrumbs={[
          {
            title: 'Risk factors',
            to: `/risk-levels/risk-factors/${isSimulationMode ? 'simulation' : ''}`,
          },
          {
            title: 'Simulation history',
            to: '/risk-levels/risk-factors/simulation-history',
          },
        ].filter(notEmpty)}
        simulationHistoryUrl="/risk-levels/risk-factors/simulation-history"
        nonSimulationDefaultUrl="/risk-levels/risk-factors"
        simulationDefaultUrl="/risk-levels/risk-factors/simulation"
      >
        <SimulationHistory />
      </BreadcrumbsSimulationPageWrapper>
    </Feature>
  );
};
