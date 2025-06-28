import { useLocation, useParams } from 'react-router';
import { SimulationResult } from '../../SimulationResult';
import { Feature } from '@/components/AppWrapper/Providers/SettingsProvider';
import { BreadCrumbsWrapper } from '@/components/BreadCrumbsWrapper';
import { notEmpty } from '@/utils/array';
import { makeUrl } from '@/utils/routing';

export const SimulationHistoryResultPage = () => {
  const { jobId } = useParams();
  const { pathname } = useLocation();

  const breadcrumbs = [
    {
      title: 'Risk scoring',
      to: makeUrl('/risk-levels/risk-factors/simulation'),
    },
    {
      title: 'Risk factors',
      to: makeUrl(`/risk-levels/risk-factors/simulation`),
    },
    ...(pathname.includes('simulation-history')
      ? [
          {
            title: 'Simulation history',
            to: makeUrl('/risk-levels/risk-factors/simulation-history'),
          },
        ]
      : [
          {
            title: 'Simulate',
            to: makeUrl('/risk-levels/risk-factors/simulation'),
          },
        ]),
    {
      title: `${jobId}`,
      to: makeUrl(
        `/risk-levels/risk-factors/${
          pathname.includes('simulation-history') ? 'simulation-history' : 'simulation'
        }/${jobId}`,
      ),
    },
  ].filter(notEmpty);

  return (
    <Feature name="RISK_SCORING" fallback={'Not enabled'}>
      <BreadCrumbsWrapper
        simulationStorageKey="SIMULATION_CUSTOM_RISK_FACTORS"
        nonSimulationDefaultUrl={makeUrl('/risk-levels/risk-factors/consumer')}
        simulationDefaultUrl={makeUrl('/risk-levels/risk-factors/simulation')}
        breadcrumbs={breadcrumbs}
        simulationHistoryUrl={makeUrl('/risk-levels/risk-factors/simulation-history')}
      >
        <SimulationResult jobId={jobId ?? ''} />
      </BreadCrumbsWrapper>
    </Feature>
  );
};
