import React, { useMemo, useState } from 'react';
import style from './style.module.less';
import { RulesSearchBar } from './RulesSearchBar';
import { Rule } from '@/apis';
import Button from '@/components/library/Button';
import { CommonParams, SortingParamsItem, TableColumn } from '@/components/library/Table/types';
import RecommendedTag from '@/components/library/Tag/RecommendedTag';
import QueryResultsTable from '@/components/shared/QueryResultsTable';
import { getBranding } from '@/utils/branding';
import { useHasResources } from '@/utils/user-utils';
import { ColumnHelper } from '@/components/library/Table/columnHelper';
import { ENUM, LONG_TEXT, RULE_ACTION_STATUS } from '@/components/library/Table/standardDataTypes';
import { DEFAULT_PARAMS_STATE } from '@/components/library/Table/consts';
import RuleChecksForTag from '@/components/library/RuleChecksForTag';
import { getOr } from '@/utils/asyncResource';
import { useFeatureEnabled } from '@/components/AppWrapper/Providers/SettingsProvider';
import { useDemoMode } from '@/components/AppWrapper/Providers/DemoModeProvider';
import { OverviewToolTip } from '@/components/OverviewToolTip';
import Tag from '@/components/library/Tag';
import CheckMark from '@/components/ui/icons/Remix/system/checkbox-circle-fill.react.svg';
import DynamicRuleTag from '@/components/library/Tag/DynamicRuleTag';
import { usePaginatedRules } from '@/utils/api/rules';

interface RulesTableParams extends CommonParams {}

interface Props {
  simulationMode?: boolean;
  onCreateRule?: () => void;
  onViewRule: (rule: Rule) => void;
  onEditRule: (rule: Rule) => void;
  onScenarioClick: () => void;
}
export const recommendedRules = [
  'R-2',
  'R-3',
  'R-4',
  'R-5',
  'R-7',
  'R-8',
  'R-10',
  'R-30',
  'R-55',
  'R-69',
  'R-121',
  'R-122',
  'R-124',
];

const DEFAULT_SORTING: SortingParamsItem = ['id', 'ascend'];

const branding = getBranding();

function canSimulate(rule: Rule) {
  return rule.type === 'TRANSACTION';
}

const ruleUsageReasons: string[] = [
  'The most frequently created rule of the month',
  'Used by companies offering similar products',
  'Used by companies in the same region',
  'Best performing rule this month',
  'Used by companies with similar risk profiles',
  'Used by companies in the same industry vertical',
  'Used by companies of similar size/complexity',
  'Adopted by companies with similar transaction patterns',
  'Used by companies of similar license',
  'Top performing rule by SAR conversion rate',
  'Rule with highest efficiency score',
  'The most frequent active rule across all FIs',
  'Emerging typology coverage',
];

const RData = () => {
  return (
    <Tag className={style.recommendedTag} icon={<CheckMark className={style.icon} />}>
      <span>Recommended</span>
    </Tag>
  );
};

const Random3Reasons = () => {
  const random3Reasons = useMemo(() => {
    return ruleUsageReasons.sort(() => Math.random() - 0.5).slice(0, 3);
  }, []);

  return (
    <OverviewToolTip reasons={random3Reasons} right={<RData />}>
      <RData />
    </OverviewToolTip>
  );
};

export const RulesTable: React.FC<Props> = (props) => {
  const { onViewRule, onEditRule, onCreateRule, simulationMode, onScenarioClick } = props;
  const canWriteRules = useHasResources(['write:::rules/my-rules/*']);
  const isV8Enabled = useFeatureEnabled('RULES_ENGINE_V8');

  const [demoMode] = useDemoMode();
  const isDemoMode = getOr(demoMode, false);

  const columns: TableColumn<Rule>[] = useMemo(() => {
    const helper = new ColumnHelper<Rule>();
    return helper.list([
      helper.simple<'id'>({
        title: 'ID',
        subtitle: 'Name',
        key: 'id',
        defaultWidth: 180,
        sorting: true,
        type: {
          render: (id: string | undefined, { item: entity }) => {
            return (
              <div className={style.root}>
                <a
                  onClick={() => {
                    if (simulationMode && !canSimulate(entity)) {
                      return;
                    }
                    onViewRule(entity);
                  }}
                >
                  <span className={style.idContainer}>
                    {id}{' '}
                    {entity.tags?.some((tag) => tag === 'RECOMMENDED') && (
                      <>
                        {isDemoMode ? (
                          <Random3Reasons />
                        ) : (
                          <RecommendedTag
                            tooltipTitle={`Recommended tag helps you securely and anonymously collaborate with other fintechs globally. ${branding.companyName} system continuously monitors the most commonly used rules across customers in 6 continents and tags the frequently used ones.`}
                          />
                        )}
                      </>
                    )}
                    {entity.tags?.some((tag) => tag === 'DYNAMIC') && <DynamicRuleTag />}
                  </span>
                </a>
                <span className={style.ruleName}>{entity.name}</span>
              </div>
            );
          },
          stringify: (id) => {
            const recommendedSuffix = recommendedRules.includes(id ?? '') ? ' (Recommended)' : '';
            return `${id}${recommendedSuffix}`;
          },
          defaultWrapMode: 'OVERFLOW',
        },
      }),
      helper.simple<'type'>({
        title: 'Rule type',
        key: 'type',
        type: ENUM,
        sorting: true,
      }),

      helper.simple<'description'>({
        title: 'Description',
        key: 'description',
        defaultWidth: 425,
        type: LONG_TEXT,
      }),

      helper.simple<'types'>({
        title: 'Type',
        key: 'types',
        defaultWidth: 300,
        sorting: true,
        type: {
          render: (types) => {
            return <>{types?.join('/')}</>;
          },
          stringify: (types) => {
            return types?.join('/') ?? '-';
          },
        },
      }),
      helper.simple<'defaultNature'>({
        title: 'Default nature',
        key: 'defaultNature',
        defaultWidth: 80,
        sorting: true,
      }),
      helper.simple<'typologies'>({
        title: 'Typology',
        key: 'typologies',
        defaultWidth: 250,
        sorting: true,
        type: {
          render: (typologies) => {
            return <>{typologies?.join(', ')}</>;
          },
          stringify: (typologies) => {
            return typologies?.join(', ') ?? '-';
          },
        },
      }),
      helper.simple<'defaultAction'>({
        title: 'Default action',
        key: 'defaultAction',
        type: RULE_ACTION_STATUS,
        sorting: true,
        defaultWidth: 100,
        // todo: implement
        // sorter: (a, b) => a.defaultAction.localeCompare(b.defaultAction),
        // exportData: (row) => row.defaultAction,
      }),
      helper.simple<'checksFor'>({
        title: 'Checks for',
        key: 'checksFor',
        defaultWidth: 300,
        type: {
          render: (checksFor) => {
            return (
              <div className={style.checksForRoot}>
                {checksFor?.map((checkFor) => (
                  <RuleChecksForTag key={checkFor} checksFor={checkFor} />
                ))}
              </div>
            );
          },
          stringify: (checksFor) => {
            return checksFor?.join(', ') ?? '-';
          },
          defaultWrapMode: 'WRAP',
        },
      }),
      helper.simple<'sampleUseCases'>({
        title: 'Sample use cases',
        key: 'sampleUseCases',
        defaultWidth: 400,
        type: {
          render: (sampleUseCases) => {
            return <>{sampleUseCases}</>;
          },
          stringify: (sampleUseCases) => {
            return sampleUseCases ?? '-';
          },
          defaultWrapMode: 'WRAP',
        },
      }),
      helper.display({
        id: 'actions',
        title: 'Action',
        defaultSticky: 'RIGHT',
        enableResizing: false,
        render: (entity) => {
          return (
            <span>
              <Button
                analyticsName="Select"
                size="MEDIUM"
                type="PRIMARY"
                onClick={() => onEditRule(entity)}
                isDisabled={!canWriteRules || (simulationMode && !canSimulate(entity))}
                requiredResources={
                  simulationMode
                    ? ['write:::simulator/simulations/*']
                    : ['write:::rules/my-rules/*']
                }
                testName="configure-rule-button"
              >
                {simulationMode ? 'Simulate' : 'Configure'}
              </Button>
            </span>
          );
        },
      }),
    ]);
  }, [simulationMode, onViewRule, canWriteRules, onEditRule, isDemoMode]);

  const [params, setParams] = useState<RulesTableParams>({
    ...DEFAULT_PARAMS_STATE,
    sort: [DEFAULT_SORTING],
    pagination: false,
  });

  const rulesResult = usePaginatedRules(params);

  // todo: implement in a better way
  // const isExistingUser = useLocalStorageState('rule-active-tab');
  // const defaultColumnsState = {
  //   // default check these 3 columns for new users, uncheck for existing users before added columns
  //   typologyGroup: {
  //     show: !isExistingUser,
  //   },
  //   typologyDescription: {
  //     show: !isExistingUser,
  //   },
  //   source: {
  //     show: !isExistingUser,
  //   },
  //   // default uncheck defaultAction for all users
  //   defaultAction: {
  //     show: false,
  //   },
  // };

  return (
    <QueryResultsTable<Rule, RulesTableParams>
      tableId={'rules-library-table'}
      pagination={false}
      rowKey="id"
      queryResults={rulesResult}
      columns={columns}
      defaultSorting={DEFAULT_SORTING}
      fitHeight={true}
      params={params}
      onChangeParams={setParams}
      rowHeightMode={'AUTO'}
      toolsOptions={{
        reload: false,
        download: true,
        setting: true,
      }}
      leftTools={
        isV8Enabled ? (
          <RulesSearchBar
            rules={getOr(rulesResult.data, { items: [] }).items}
            onSelectedRule={onEditRule}
            onScenarioClick={onScenarioClick}
          />
        ) : null
      }
      extraTools={
        onCreateRule
          ? [
              () => (
                <Button
                  type="SECONDARY"
                  onClick={props.onCreateRule}
                  testName="create-scenario-button"
                >
                  {simulationMode ? 'Simulate scenario' : 'Create scenario'}
                </Button>
              ),
            ]
          : []
      }
    />
  );
};
