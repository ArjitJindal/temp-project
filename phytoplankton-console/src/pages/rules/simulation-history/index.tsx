import React from 'react';
import { SimulationHistoryTable } from 'src/pages/rules/simulation-history/SimulationHistoryTable';
import { Authorized } from '@/components/utils/Authorized';
import { RulesPageWrapper } from '@/pages/rules/RulesPageWrapper';

export default function SimulationHistoryPage() {
  return (
    <RulesPageWrapper
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
    >
      <Authorized required={['simulator:simulations:read']} showForbiddenPage>
        <SimulationHistoryTable />
      </Authorized>
    </RulesPageWrapper>
  );
}
