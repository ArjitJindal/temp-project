import React from 'react';
import { SimulationHistoryTable } from 'src/pages/rules/simulation-history/SimulationHistoryTable';
import { useLocation } from 'react-router';
import { Authorized } from '@/components/utils/Authorized';
import { BreadCrumbsWrapper } from '@/components/BreadCrumbsWrapper';

export default function SimulationHistoryPage() {
  const location = useLocation();

  const rulesTab = location.pathname.includes('rules-library') ? 'rules-library' : 'my-rules';
  return (
    <BreadCrumbsWrapper
      simulationStorageKey="SIMULATION_RULES"
      breadcrumbs={[
        {
          title: 'Rules',
          to: '/rules',
        },
        {
          title: rulesTab === 'my-rules' ? 'My rules' : 'Templates',
          to: `/rules/${rulesTab}`,
        },
        {
          title: 'Simulations history',
          to: `/rules/${rulesTab}/simulation-history`,
        },
      ]}
      simulationHistoryUrl="/rules/simulation-history"
      nonSimulationDefaultUrl="/rules/my-rules"
      simulationDefaultUrl="/rules/my-rules"
    >
      <Authorized minRequiredResources={['read:::simulator/simulations/*']} showForbiddenPage>
        <SimulationHistoryTable rulesTab={rulesTab} />
      </Authorized>
    </BreadCrumbsWrapper>
  );
}
