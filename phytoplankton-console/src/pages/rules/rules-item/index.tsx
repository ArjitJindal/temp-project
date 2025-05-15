import React, { useMemo } from 'react';
import { useParams } from 'react-router';
import RuleConfiguration from 'src/pages/rules/RuleConfiguration';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@/utils/queries/hooks';
import { GET_RULE_INSTANCE, GET_RULE } from '@/utils/queries/keys';
import { useApi } from '@/api';
import AsyncResourceRenderer from '@/components/utils/AsyncResourceRenderer';
import { RuleInstance, Rule } from '@/apis';
import { Mode } from '@/pages/rules/RuleConfiguration/RuleConfigurationV8';
import { makeUrl } from '@/utils/routing';
import { getRuleInstanceTitle } from '@/utils/api/rules';
import { map, getOr } from '@/utils/asyncResource';
import Breadcrumbs from '@/components/library/Breadcrumbs';
import PageWrapper from '@/components/PageWrapper';
import { useSafeLocalStorageState } from '@/utils/hooks';

export default function RulesItemPage() {
  const { id: ruleInstanceId = 'rules-library', mode = 'read' } = useParams<
    'tab' | 'id' | 'mode'
  >();
  const [isSimulationEnabled] = useSafeLocalStorageState<boolean>('SIMULATION_RULES', false);
  const api = useApi();
  const ruleInstanceResult = useQuery<RuleInstance>(
    GET_RULE_INSTANCE(ruleInstanceId),
    async (_paginationParams) => {
      if (ruleInstanceId == null) {
        throw new Error(`ruleInstanceId can not be null`);
      }
      const ruleInstance = await api.getRuleInstancesItem({
        ruleInstanceId: ruleInstanceId,
      });
      return ruleInstance;
    },
  );
  const ruleId = getOr(
    map(ruleInstanceResult.data, (x) => x.ruleId),
    undefined,
  );
  const ruleResult = useQuery<Rule | null>(GET_RULE(ruleId), async () => {
    if (ruleId == null) {
      return null;
    }
    const rule = await api.getRule({
      ruleId: ruleId,
    });
    return rule;
  });

  const ruleInstanceRes = ruleInstanceResult.data;
  const ruleRes = ruleResult.data;

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
              title: 'My rules',
              to: '/rules/my-rules',
            },
            map(ruleInstanceRes, (ruleInstance) => {
              const ruleInstanceTitle = getRuleInstanceTitle(ruleInstance);
              let title: string;
              if (isSimulationEnabled) {
                title = 'Simulate';
              } else if (mode === 'edit') {
                title = `Edit rule`;
              } else if (mode === 'duplicate') {
                title = `Duplicate rule`;
              } else {
                title = ruleInstanceTitle;
              }
              title = title.replace('Copy of ', '');
              return {
                title: title,
                to: makeUrl(`/rules/my-rules/:id/:mode`, { id: ruleInstance.id, mode: mode }),
              };
            }),
          ]}
        />
      }
    >
      <AsyncResourceRenderer resource={ruleInstanceRes}>
        {(ruleInstance) => {
          return (
            <AsyncResourceRenderer resource={ruleRes}>
              {(rule) => (
                <Content
                  rule={rule}
                  ruleInstance={ruleInstance}
                  mode={mode}
                  isSimulationEnabled={isSimulationEnabled}
                />
              )}
            </AsyncResourceRenderer>
          );
        }}
      </AsyncResourceRenderer>
    </PageWrapper>
  );
}

function Content(props: {
  rule: Rule | null;
  ruleInstance: RuleInstance;
  mode: string;
  isSimulationEnabled: boolean;
}) {
  const { rule, ruleInstance, mode, isSimulationEnabled } = props;
  const navigate = useNavigate();

  const formType: Mode = useMemo((): Mode => {
    if (mode === 'edit') {
      return 'EDIT';
    }
    if (mode === 'create') {
      return 'CREATE';
    }
    if (mode === 'duplicate') {
      return 'DUPLICATE';
    }
    return 'READ';
  }, [mode]);
  return (
    <RuleConfiguration
      isSimulation={isSimulationEnabled}
      rule={rule ?? undefined}
      ruleInstance={ruleInstance}
      type={formType}
      onRuleInstanceUpdated={() => {
        navigate(makeUrl(`/rules/my-rules`));
      }}
      onCancel={() => {
        navigate(makeUrl(`/rules/my-rules`));
      }}
      onChangeToEditMode={() => {
        navigate(makeUrl(`/rules/my-rules/:id/:mode`, { id: ruleInstance.id, mode: 'edit' }));
      }}
    />
  );
}
