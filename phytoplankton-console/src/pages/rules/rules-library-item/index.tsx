import React from 'react';
import { useParams } from 'react-router';
import { useNavigate } from 'react-router-dom';
import RuleConfiguration from 'src/pages/rules/RuleConfiguration';
import { useLocalStorageState } from 'ahooks';
import { makeUrl } from '@/utils/routing';
import { useQuery } from '@/utils/queries/hooks';
import { GET_RULE } from '@/utils/queries/keys';
import { useApi } from '@/api';
import { Rule } from '@/apis';
import { Mode } from '@/pages/rules/RuleConfiguration/RuleConfigurationV8';
import AsyncResourceRenderer from '@/components/utils/AsyncResourceRenderer';
import PageWrapper from '@/components/PageWrapper';
import Breadcrumbs from '@/components/library/Breadcrumbs';

export default function RulesLibraryItemPage() {
  const { id: ruleId } = useParams<'id'>();

  const api = useApi();

  const ruleResult = useQuery<Rule | null>(GET_RULE(ruleId), async (_paginationParams) => {
    if (ruleId == null) {
      throw new Error(`ruleId can not be null`);
    }
    if (ruleId === 'create') {
      return null;
    }
    const rule = await api.getRule({
      ruleId: ruleId,
    });
    return rule;
  });

  return (
    <AsyncResourceRenderer resource={ruleResult.data}>
      {(rule) => <Content mode="CREATE" ruleId={ruleId} rule={rule} />}
    </AsyncResourceRenderer>
  );
}

function Content(props: { ruleId?: string; rule: Rule | null; mode: Mode }) {
  const { ruleId, rule, mode } = props;
  const navigate = useNavigate();
  const [isSimulationEnabled] = useLocalStorageState<boolean>('SIMULATION_RULES', false);
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
              title: 'Library',
              to: '/rules/rules-library',
            },
            {
              title: ruleId === 'create' ? 'Create new rule' : 'Configure',
              to: makeUrl(`/rules/rules-library/:id`, { id: ruleId }),
            },
          ]}
        />
      }
    >
      <RuleConfiguration
        rule={rule ?? undefined}
        isSimulation={isSimulationEnabled}
        type={mode}
        onRuleInstanceUpdated={() => {
          navigate(makeUrl(`/rules/my-rules`));
        }}
        onCancel={() => {
          navigate(makeUrl(`/rules/rules-library`));
        }}
      />
    </PageWrapper>
  );
}
