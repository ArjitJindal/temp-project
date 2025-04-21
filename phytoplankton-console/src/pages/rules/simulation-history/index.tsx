import React from 'react';
import { SimulationHistoryTable } from 'src/pages/rules/simulation-history/SimulationHistoryTable';
import { useLocation } from 'react-router';
import { Authorized } from '@/components/utils/Authorized';
import { BreadcrumbsSimulationPageWrapper } from '@/components/BreadcrumbsSimulationPageWrapper';

export default function SimulationHistoryPage() {
  const location = useLocation();

  const rulesTab = location.pathname.includes('rules-library') ? 'rules-library' : 'my-rules';
  return (
    <BreadcrumbsSimulationPageWrapper
      storageKey="SIMULATION_RULES"
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
          to: '/rules/simulation-history',
        },
      ]}
      simulationHistoryUrl="/rules/simulation-history"
      nonSimulationDefaultUrl="/rules/my-rules"
      simulationDefaultUrl="/rules/my-rules"
    >
      <Authorized required={['simulator:simulations:read']} showForbiddenPage>
        <SimulationHistoryTable rulesTab={rulesTab} />
      </Authorized>
    </BreadcrumbsSimulationPageWrapper>
  );
}
