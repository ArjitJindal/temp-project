import { useParams } from 'react-router';
import { useNavigate } from 'react-router-dom';
import RuleConfiguration from 'src/pages/rules/RuleConfiguration';
import { makeUrl } from '@/utils/routing';
import { useRule } from '@/hooks/api/rules';
import AsyncResourceRenderer from '@/components/utils/AsyncResourceRenderer';
import PageWrapper from '@/components/PageWrapper';
import Breadcrumbs from '@/components/library/Breadcrumbs';
import { useSafeLocalStorageState } from '@/utils/hooks';

export default function RulesLibraryItemPage() {
  const { id: ruleId } = useParams<'id'>();

  const ruleResult = useRule(ruleId);

  const [isSimulationEnabled] = useSafeLocalStorageState<boolean>('SIMULATION_RULES', false);
  const navigate = useNavigate();

  return (
    <PageWrapper
      header={
        <Breadcrumbs
          items={[
            {
              title: 'Rules',
              to: '/rules',
            },
            {
              title: 'Templates',
              to: '/rules/rules-library',
            },
            {
              title: isSimulationEnabled
                ? 'Simulate scenario'
                : ruleId === 'create'
                ? 'Create scenario'
                : 'Configure',
              to: makeUrl(`/rules/rules-library/:id`, { id: ruleId }),
            },
          ]}
        />
      }
    >
      <AsyncResourceRenderer resource={ruleResult.data}>
        {(rule) => (
          <RuleConfiguration
            rule={rule ?? undefined}
            isSimulation={isSimulationEnabled}
            type={'CREATE'}
            onRuleInstanceUpdated={() => {
              navigate(makeUrl(`/rules/my-rules`));
            }}
            onCancel={() => {
              navigate(makeUrl(`/rules/rules-library`));
            }}
          />
        )}
      </AsyncResourceRenderer>
    </PageWrapper>
  );
}
