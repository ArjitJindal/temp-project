import { useLocation, useParams } from 'react-router';
import { useNavigate } from 'react-router-dom';
import { isEmpty } from 'lodash';
import { useShouldUseV8Configuration } from '../utils';
import { Authorized } from '@/components/utils/Authorized';
import { makeUrl } from '@/utils/routing';
import { RuleConfigurationSimulation } from '@/pages/rules/RuleConfiguration/RuleConfigurationSimulation';
import { useSimulationJob } from '@/hooks/api/simulation';
import { SimulationBeaconJob } from '@/apis';
import AsyncResourceRenderer from '@/components/utils/AsyncResourceRenderer';
import { useRules } from '@/utils/rules';
import { BreadCrumbsWrapper } from '@/components/BreadCrumbsWrapper';

export default function SimulationHistoryItemPage() {
  const { id: jobId } = useParams<'id'>();
  const location = useLocation();

  const rulesTab = location.pathname.includes('rules-library') ? 'rules-library' : 'my-rules';
  const queryResult = useSimulationJob(jobId);
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
        {
          title: `Simulation #${jobId?.split('-')[0]}...`,
          to: makeUrl('/rules/simulation-history/:id', { id: jobId }),
        },
      ]}
      simulationHistoryUrl="/rules/simulation-history"
      nonSimulationDefaultUrl="/rules/my-rules"
      simulationDefaultUrl="/rules/my-rules"
    >
      <Authorized minRequiredResources={['read:::simulator/simulations/*']} showForbiddenPage>
        <AsyncResourceRenderer resource={queryResult.data}>
          {(job) => <Content job={job} />}
        </AsyncResourceRenderer>
      </Authorized>
    </BreadCrumbsWrapper>
  );
}

function Content(props: { job: SimulationBeaconJob }) {
  const selectedJob = props.job;
  const { rules } = useRules();
  const navigate = useNavigate();
  const rule = selectedJob?.defaultRuleInstance.ruleId
    ? rules?.[selectedJob?.defaultRuleInstance.ruleId]
    : undefined;
  const useV8Configuration = useShouldUseV8Configuration(rule, selectedJob?.defaultRuleInstance);
  const isLoading = isEmpty(rules);
  return isLoading ? (
    <></>
  ) : (
    <RuleConfigurationSimulation
      v8Mode={useV8Configuration}
      rule={rule}
      ruleInstance={selectedJob?.defaultRuleInstance}
      jobId={selectedJob?.jobId}
      onRuleInstanceUpdated={() => {
        navigate('/rules/simulation-history');
      }}
    />
  );
}
