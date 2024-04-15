import { useLocalStorageState } from 'ahooks';
import { useParams } from 'react-router';
import { SimulationResult } from '../../SimulationResult';
import { Feature } from '@/components/AppWrapper/Providers/SettingsProvider';
import { BreadcrumbsSimulationPageWrapper } from '@/components/BreadcrumbsSimulationPageWrapper';
import { notEmpty } from '@/utils/array';

export const SimulationHistoryResultPage = () => {
  const { jobId } = useParams();
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
          {
            title: `${jobId}`,
            to: `/risk-levels/risk-factors/simulation-history/${jobId}`,
          },
        ].filter(notEmpty)}
        simulationHistoryUrl="/risk-levels/risk-factors/simulation-history"
      >
        <SimulationResult jobId={jobId ?? ''} />
      </BreadcrumbsSimulationPageWrapper>
    </Feature>
  );
};
