import React, { useMemo, useState } from 'react';
import style from './style.module.less';
import { RulesSearchBar } from './RulesSearchBar';
import { Rule } from '@/apis';
import { useApi } from '@/api';
import Button from '@/components/library/Button';
import { CommonParams, SortingParamsItem, TableColumn } from '@/components/library/Table/types';
import RecommendedTag from '@/components/library/Tag/RecommendedTag';
import { usePaginatedQuery } from '@/utils/queries/hooks';
import { GET_RULES } from '@/utils/queries/keys';
import QueryResultsTable from '@/components/shared/QueryResultsTable';
import { getBranding } from '@/utils/branding';
import { useHasPermissions } from '@/utils/user-utils';
import { ColumnHelper } from '@/components/library/Table/columnHelper';
import { LONG_TEXT, RULE_ACTION } from '@/components/library/Table/standardDataTypes';
import { DEFAULT_PARAMS_STATE } from '@/components/library/Table/consts';
import { RULE_ACTION_VALUES } from '@/utils/rules';
import RuleChecksForTag from '@/components/library/RuleChecksForTag';
import { getOr } from '@/utils/asyncResource';
import { useFeatureEnabled } from '@/components/AppWrapper/Providers/SettingsProvider';

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

export const RulesTable: React.FC<Props> = (props) => {
  const { onViewRule, onEditRule, onCreateRule, simulationMode, onScenarioClick } = props;
  const api = useApi();
  const canWriteRules = useHasPermissions(['rules:my-rules:write']);
  const isV8Enabled = useFeatureEnabled('RULES_ENGINE_V8');

  const columns: TableColumn<Rule>[] = useMemo(() => {
    const helper = new ColumnHelper<Rule>();
    return helper.list([
      helper.simple<'id'>({
        title: 'ID',
        subtitle: 'Name',
        key: 'id',
        defaultWidth: 170,
        sorting: true,
        type: {
          render: (id: string | undefined, { item: entity }) => {
            return (
              <>
                <a
                  onClick={() => {
                    if (simulationMode && !canSimulate(entity)) {
                      return;
                    }
                    onViewRule(entity);
                  }}
                >
                  <span className={style.root}>
                    {id}{' '}
                    {id && recommendedRules.includes(id) ? (
                      <RecommendedTag
                        tooltipTitle={`Recommended tag helps you securely and anonymously collaborate with other fintechs globally. ${branding.companyName} system continuously monitors the most commonly used rules across customers in 6 continents and tags the frequently used ones.`}
                      />
                    ) : (
                      ''
                    )}
                  </span>
                </a>
                <span style={{ fontSize: '12px', whiteSpace: 'normal' }}>{entity.name}</span>
              </>
            );
          },
          stringify: (id) => {
            const recommendedSuffix = recommendedRules.includes(id ?? '') ? ' (Recommended)' : '';
            return `${id}${recommendedSuffix}`;
          },
          defaultWrapMode: 'OVERFLOW',
        },
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
            return <>{types?.join('/ ')}</>;
          },
          stringify: (types) => {
            return types?.join('/ ') ?? '-';
          },
        },
      }),
      helper.simple<'defaultNature'>({
        title: 'Default nature',
        key: 'defaultNature',
        defaultWidth: 80,
      }),
      helper.simple<'typologies'>({
        title: 'Typology',
        key: 'typologies',
        defaultWidth: 250,
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
        type: RULE_ACTION,
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
                requiredPermissions={
                  simulationMode ? ['simulator:simulations:write'] : ['rules:my-rules:write']
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
  }, [simulationMode, onViewRule, canWriteRules, onEditRule]);

  const [params, setParams] = useState<RulesTableParams>({
    ...DEFAULT_PARAMS_STATE,
    sort: [DEFAULT_SORTING],
    pagination: false,
  });

  const rulesResult = usePaginatedQuery(GET_RULES(params), async (_paginationParams) => {
    const rules = await api.getRules();
    const result = [...rules];
    if (params.sort.length > 0) {
      const [key, order] = params.sort[0];
      result.sort((a, b) => {
        let result = 0;
        if (key === 'id') {
          result = parseInt(a.id.split('-')[1]) - parseInt(b.id.split('-')[1]);
        } else if (key === 'defaultAction') {
          result =
            RULE_ACTION_VALUES.indexOf(a.defaultAction) -
            RULE_ACTION_VALUES.indexOf(b.defaultAction);
        }
        result *= order === 'descend' ? -1 : 1;
        return result;
      });
    }

    return {
      items: result,
      total: rules.length,
    };
  });

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
                  {simulationMode ? 'Simulate rule' : 'Create rule'}
                </Button>
              ),
            ]
          : []
      }
    />
  );
};
