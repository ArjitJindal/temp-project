import { useParams } from 'react-router';
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Authorized } from '@/components/utils/Authorized';
import { makeUrl } from '@/utils/routing';
import { RuleConfigurationSimulation } from '@/pages/rules/RuleConfiguration/RuleConfigurationV2/RuleConfigurationSimulation';
import { useQuery } from '@/utils/queries/hooks';
import { SIMULATION_JOB } from '@/utils/queries/keys';
import { useApi } from '@/api';
import { SimulationBeaconJob } from '@/apis';
import AsyncResourceRenderer from '@/components/utils/AsyncResourceRenderer';
import { useRules } from '@/utils/rules';
import { BreadcrumbsSimulationPageWrapper } from '@/components/BreadcrumbsSimulationPageWrapper';

export default function SimulationHistoryItemPage() {
  const { id: jobId } = useParams<'id'>();

  const api = useApi();
  const queryResult = useQuery<SimulationBeaconJob>(
    SIMULATION_JOB(jobId),
    async (): Promise<SimulationBeaconJob> => {
      if (jobId == null) {
        throw new Error(`jobId can not be empty`);
      }
      const simulation = await api.getSimulationTestId({
        jobId,
      });
      if (simulation.type !== 'BEACON') {
        throw new Error(`Wrong job type`);
      }
      return simulation;
    },
  );
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
        {
          title: `Simulation #${jobId?.split('-')[0]}...`,
          to: makeUrl('/rules/simulation-history/:id', { id: jobId }),
        },
      ]}
      simulationHistoryUrl="/rules/simulation-history"
    >
      <Authorized required={['simulator:simulations:read']} showForbiddenPage>
        <AsyncResourceRenderer resource={queryResult.data}>
          {(job) => <Content job={job} />}
        </AsyncResourceRenderer>
      </Authorized>
    </BreadcrumbsSimulationPageWrapper>
  );
}

function Content(props: { job: SimulationBeaconJob }) {
  const selectedJob = props.job;
  const { rules } = useRules();
  const navigate = useNavigate();
  return (
    <RuleConfigurationSimulation
      rule={
        selectedJob?.defaultRuleInstance.ruleId
          ? rules?.[selectedJob?.defaultRuleInstance.ruleId]
          : undefined
      }
      ruleInstance={selectedJob?.defaultRuleInstance as any}
      jobId={selectedJob?.jobId}
      onRuleInstanceUpdated={() => {
        navigate('/rules/simulation-history');
      }}
    />
  );
}
