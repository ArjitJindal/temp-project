import { useLocalStorageState } from 'ahooks';
import { useCallback, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router';
import MyRule from './my-rules';
import { RulesTable } from './RulesTable';
import { useRuleLogicConfig } from './RuleConfiguration/RuleConfigurationV8/RuleConfigurationFormV8/steps/RuleIsHitWhenStep/helpers';
import { Authorized } from '@/components/utils/Authorized';
import { PageWrapperContentContainer } from '@/components/PageWrapper';
import PageTabs from '@/components/ui/PageTabs';
import { useFeatureEnabled } from '@/components/AppWrapper/Providers/SettingsProvider';
import { notEmpty } from '@/utils/array';
import { makeUrl } from '@/utils/routing';
import { BreadcrumbsSimulationPageWrapper } from '@/components/BreadcrumbsSimulationPageWrapper';

const TableList = () => {
  const { tab = 'tab' } = useParams<'tab'>();
  const [, setLocalStorageActiveTab] = useLocalStorageState('rule-active-tab', tab);
  useEffect(() => {
    setLocalStorageActiveTab(tab);
  }, [setLocalStorageActiveTab, tab]);

  return (
    <BreadcrumbsSimulationPageWrapper
      storageKey={'SIMULATION_RULES'}
      breadcrumbs={[
        {
          title: 'Rules',
          to: '/rules',
        },
        tab === 'my-rules' && {
          title: 'My rules',
          to: '/rules/my-rules',
        },
        tab === 'rules-library' && {
          title: 'Templates',
          to: '/rules/rules-library',
        },
      ].filter(notEmpty)}
      simulationHistoryUrl={`/rules/${tab}/simulation-history`}
      nonSimulationDefaultUrl={`/rules/${tab}`}
      simulationDefaultUrl={`/rules/${tab}`}
    >
      <Content tab={tab} />
    </BreadcrumbsSimulationPageWrapper>
  );
};

function Content(props: { tab: string }) {
  const navigate = useNavigate();
  const v8Enabled = useFeatureEnabled('RULES_ENGINE_V8');
  const [isSimulationEnabled] = useLocalStorageState<boolean>('SIMULATION_RULES', false);
  const handleChange = useCallback(
    (key) => {
      navigate(`/rules/${key}`, { replace: true });
    },
    [navigate],
  );
  const items = useMemo(
    () => [
      {
        title: 'My rules',
        key: 'my-rules',
        children: (
          <PageWrapperContentContainer>
            <Authorized required={['rules:my-rules:read']}>
              <MyRule simulationMode={isSimulationEnabled} />
            </Authorized>
          </PageWrapperContentContainer>
        ),
      },
      {
        title: 'Templates',
        key: 'rules-library',
        children: (
          <PageWrapperContentContainer>
            <Authorized required={['rules:library:read']}>
              <RulesTable
                simulationMode={isSimulationEnabled}
                onCreateRule={
                  v8Enabled
                    ? () => {
                        navigate(makeUrl('/rules/rules-library/create'));
                      }
                    : undefined
                }
                onViewRule={(rule) => {
                  navigate(makeUrl('/rules/rules-library/:id', { id: rule.id }));
                }}
                onEditRule={(rule) => {
                  navigate(makeUrl('/rules/rules-library/:id', { id: rule.id }));
                }}
                onScenarioClick={() => {
                  navigate(makeUrl('/rules/rules-library/create'));
                }}
              />
            </Authorized>
          </PageWrapperContentContainer>
        ),
      },
    ],
    [isSimulationEnabled, navigate, v8Enabled],
  );
  // NOTE: Rule logic config data size is big, so we prefetch it here
  useRuleLogicConfig('TRANSACTION');
  return <PageTabs activeKey={props.tab} onChange={handleChange} items={items} />;
}

export default TableList;
