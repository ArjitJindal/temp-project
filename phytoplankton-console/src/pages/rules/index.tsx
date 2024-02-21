import { useLocalStorageState } from 'ahooks';
import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router';
import { RulesPageWrapper } from 'src/pages/rules/RulesPageWrapper';
import MyRule from './my-rules';
import { RulesTable } from './RulesTable';
import { PageWrapperContentContainer } from '@/components/PageWrapper';
import PageTabs from '@/components/ui/PageTabs';
import { Authorized } from '@/components/Authorized';
import { useFeatureEnabled } from '@/components/AppWrapper/Providers/SettingsProvider';
import { notEmpty } from '@/utils/array';
import { makeUrl } from '@/utils/routing';

const TableList = () => {
  const { tab = 'tab' } = useParams<'tab'>();
  const [, setLocalStorageActiveTab] = useLocalStorageState('rule-active-tab', tab);
  useEffect(() => {
    setLocalStorageActiveTab(tab);
  }, [setLocalStorageActiveTab, tab]);

  return (
    <RulesPageWrapper
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
          title: 'Library',
          to: '/rules/rules-library',
        },
      ].filter(notEmpty)}
    >
      <Content tab={tab} />
    </RulesPageWrapper>
  );
};

function Content(props: { tab: string }) {
  const navigate = useNavigate();
  const v8Enabled = useFeatureEnabled('RULES_ENGINE_V8');
  const [isSimulationEnabled] = useLocalStorageState<boolean>('SIMULATION_RULES', false);
  return (
    <PageTabs
      activeKey={props.tab}
      onChange={(key) => {
        navigate(`/rules/${key}`, { replace: true });
      }}
      items={[
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
          title: 'Library',
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
      ]}
    />
  );
}

export default TableList;
