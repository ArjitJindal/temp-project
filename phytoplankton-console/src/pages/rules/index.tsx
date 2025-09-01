import { useCallback, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Resource } from '@flagright/lib/utils';
import { MlModelsPage } from '../ml-models';
import MyRule from './my-rules';
import { RulesTable } from './RulesTable';
import { useRulesResults } from './utils';
import { Authorized } from '@/components/utils/Authorized';
import { PageWrapperContentContainer } from '@/components/PageWrapper';
import PageTabs from '@/components/ui/PageTabs';
import {
  useFeatureEnabled,
  useResources,
} from '@/components/AppWrapper/Providers/SettingsProvider';
import { notEmpty } from '@/utils/array';
import { makeUrl } from '@/utils/routing';
import { BreadCrumbsWrapper } from '@/components/BreadCrumbsWrapper';
import { useSafeLocalStorageState } from '@/utils/hooks';
import { DEFAULT_PARAMS_STATE } from '@/components/library/Table/consts';
import { getOr } from '@/utils/asyncResource';
import { exportJsonlFile } from '@/utils/json';
import { dayjs } from '@/utils/dayjs';
import { useApi } from '@/api';
import { hasMinimumPermission } from '@/utils/user-utils';

const TableList = () => {
  const { tab = 'my-rules' } = useParams<'tab'>();
  const [_, setLocalStorageActiveTab] = useSafeLocalStorageState('rule-active-tab', tab);
  const hasMachineLearningFeature = useFeatureEnabled('MACHINE_LEARNING');

  useEffect(() => {
    setLocalStorageActiveTab(tab);
  }, [setLocalStorageActiveTab, tab]);

  const rulesResult = useRulesResults({
    params: DEFAULT_PARAMS_STATE,
  });

  const api = useApi();

  return (
    <BreadCrumbsWrapper
      simulationStorageKey={'SIMULATION_RULES'}
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
        tab === 'ai-detection' && {
          title: 'AI models',
          to: '/rules/ai-detection',
        },
      ].filter(notEmpty)}
      simulationHistoryUrl={`/rules/${tab}/simulation-history`}
      nonSimulationDefaultUrl={`/rules/${tab}`}
      simulationDefaultUrl={`/rules/${tab}`}
      importExport={{
        import: async (file) => {
          await api.postRulesImport({
            ImportConsoleDataRequest: {
              file,
            },
          });
        },
        export: () => {
          const rules = getOr(rulesResult.data, {
            items: [],
            total: 0,
          });

          exportJsonlFile(rules.items, `rules-${dayjs().format('YYYY-MM-DD')}`);
        },
        type: 'RULES',
      }}
    >
      <Content tab={tab} hasMachineLearningFeature={hasMachineLearningFeature} />
    </BreadCrumbsWrapper>
  );
};

function Content(props: { tab: string; hasMachineLearningFeature: boolean }) {
  const navigate = useNavigate();
  const v8Enabled = useFeatureEnabled('RULES_ENGINE_V8');
  const [isSimulationEnabled] = useSafeLocalStorageState<boolean>('SIMULATION_RULES', false);
  const { statements } = useResources();

  const handleChange = useCallback(
    (key) => {
      navigate(`/rules/${key}`, { replace: true });
    },
    [navigate],
  );

  const items = useMemo(() => {
    const tabs: any[] = [];

    // Add My rules tab only if user has permission
    if (hasMinimumPermission(statements, ['read:::rules/my-rules/*'])) {
      tabs.push({
        title: 'My rules',
        key: 'my-rules',
        minRequiredResources: ['read:::rules/my-rules/*'] as Resource[],
        children: (
          <PageWrapperContentContainer>
            <Authorized minRequiredResources={['read:::rules/my-rules/*']}>
              <MyRule simulationMode={isSimulationEnabled} />
            </Authorized>
          </PageWrapperContentContainer>
        ),
      });
    }

    // Add Templates tab only if user has permission
    if (hasMinimumPermission(statements, ['read:::rules/library/*'])) {
      tabs.push({
        title: 'Templates',
        key: 'rules-library',
        minRequiredResources: ['read:::rules/library/*'] as Resource[],
        children: (
          <PageWrapperContentContainer>
            <Authorized minRequiredResources={['read:::rules/library/*']}>
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
      });
    }

    // Add AI detection tab if machine learning feature is enabled (no permission check)
    if (props.hasMachineLearningFeature) {
      tabs.push({
        title: 'AI models',
        key: 'ai-detection',
        children: (
          <PageWrapperContentContainer>
            <MlModelsPage />
          </PageWrapperContentContainer>
        ),
      });
    }

    return tabs;
  }, [isSimulationEnabled, navigate, v8Enabled, props.hasMachineLearningFeature, statements]);

  // Check if current tab is accessible, if not redirect to first available tab
  useEffect(() => {
    const currentTab = items.find((item) => item.key === props.tab);
    if (!currentTab) {
      // Current tab is not in the filtered items (no permission), redirect to first available tab
      const firstAvailableTab = items[0];
      if (firstAvailableTab && firstAvailableTab.key !== props.tab) {
        navigate(`/rules/${firstAvailableTab.key}`, { replace: true });
      }
    }
  }, [props.tab, statements, navigate, items]);

  return <PageTabs activeKey={props.tab} onChange={handleChange} items={items} />;
}

export default TableList;
