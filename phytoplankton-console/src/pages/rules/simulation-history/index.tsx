import React from 'react';
import { SimulationHistoryTable } from 'src/pages/rules/simulation-history/SimulationHistoryTable';
import { Authorized } from '@/components/utils/Authorized';
import { BreadcrumbsSimulationPageWrapper } from '@/components/BreadcrumbsSimulationPageWrapper';

export default function SimulationHistoryPage() {
  return (
    <BreadcrumbsSimulationPageWrapper
      storageKey="SIMULATION_RULES"
      breadcrumbs={[
        {
          title: 'Rules',
          to: '/rules',
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
        <SimulationHistoryTable />
      </Authorized>
    </BreadcrumbsSimulationPageWrapper>
  );
}
