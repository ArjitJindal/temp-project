import { useLocalStorageState } from 'ahooks';
import { useLocation, useParams } from 'react-router';
import { SimulationResult } from '../../SimulationResult';
import { Feature } from '@/components/AppWrapper/Providers/SettingsProvider';
import { BreadcrumbsSimulationPageWrapper } from '@/components/BreadcrumbsSimulationPageWrapper';
import { notEmpty } from '@/utils/array';

const BASE_URL = '/risk-levels';

export const SimulationHistoryResultPage = () => {
  const { jobId } = useParams();
  const { pathname } = useLocation();
  const type = 'custom-risk-factors';
  const [isSimulationMode] = useLocalStorageState('SIMULATION_CUSTOM_RISK_FACTORS', false);

  const getUrl = (path: string) => `${BASE_URL}/${type}${path}`;

  const breadcrumbs = [
    {
      title: 'Risk factors',
      to: getUrl(isSimulationMode ? '/simulation' : ''),
    },
    ...(pathname.includes('simulation-history')
      ? [
          {
            title: 'Simulation history',
            to: getUrl('/simulation-history'),
          },
        ]
      : [
          {
            title: 'Simulation',
            to: getUrl('/simulation'),
          },
        ]),
    {
      title: `${jobId}`,
      to: getUrl(`/simulation-history/${jobId}`),
    },
  ].filter(notEmpty);

  return (
    <Feature name="RISK_SCORING" fallback={'Not enabled'}>
      <BreadcrumbsSimulationPageWrapper
        storageKey="SIMULATION_CUSTOM_RISK_FACTORS"
        nonSimulationDefaultUrl={getUrl('')}
        simulationDefaultUrl={getUrl('/simulation')}
        breadcrumbs={breadcrumbs}
        simulationHistoryUrl={getUrl('/simulation-history')}
      >
        <SimulationResult jobId={jobId ?? ''} />
      </BreadcrumbsSimulationPageWrapper>
    </Feature>
  );
};
