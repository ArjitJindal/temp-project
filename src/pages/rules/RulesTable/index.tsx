import { useMemo, useState } from 'react';
import style from './style.module.less';
import { Rule } from '@/apis';
import { useApi } from '@/api';
import Button from '@/components/library/Button';
import { CommonParams, SortingParamsItem, TableColumn } from '@/components/library/Table/types';
import { RecommendedTag } from '@/components/ui/RecommendedTag';
import { usePaginatedQuery } from '@/utils/queries/hooks';
import { GET_RULES } from '@/utils/queries/keys';
import QueryResultsTable from '@/components/common/QueryResultsTable';
import { getBranding } from '@/utils/branding';
import { useHasPermissions } from '@/utils/user-utils';
import { ColumnHelper } from '@/components/library/Table/columnHelper';
import { LONG_TEXT, RULE_ACTION } from '@/components/library/Table/standardDataTypes';
import { DEFAULT_PARAMS_STATE } from '@/components/library/Table/consts';
import { RULE_ACTION_VALUES } from '@/utils/rules';
import { PageWrapperTableContainer } from '@/components/PageWrapper';

interface RulesTableParams extends CommonParams {}

interface Props {
  onViewRule: (rule: Rule) => void;
  onEditRule: (rule: Rule) => void;
}
export const recommendedRules = [
  'R-2',
  'R-3',
  'R-4',
  'R-5',
  'R-10',
  'R-30',
  'R-54',
  'R-69',
  'R-121',
  'R-122',
  'R-124',
];

const DEFAULT_SORTING: SortingParamsItem = ['id', 'ascend'];

const branding = getBranding();

export const RulesTable: React.FC<Props> = ({ onViewRule, onEditRule }) => {
  const api = useApi();
  const canWriteRules = useHasPermissions(['rules:my-rules:write']);
  const columns: TableColumn<Rule>[] = useMemo(() => {
    const helper = new ColumnHelper<Rule>();
    return [
      helper.simple<'id'>({
        title: 'ID',
        subtitle: 'Name',
        key: 'id',
        sorting: true,
        type: {
          render: (id: string | undefined, _, entity) => {
            return (
              <>
                <a
                  onClick={() => {
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
                <span style={{ fontSize: '12px' }}>{entity.name}</span>
              </>
            );
          },
        },
      }),
      helper.simple<'description'>({
        title: 'Description',
        key: 'description',
        type: LONG_TEXT,
      }),
      helper.simple<'defaultNature'>({
        title: 'Default nature',
        key: 'defaultNature',
      }),
      helper.simple<'defaultAction'>({
        title: 'Default action',
        key: 'defaultAction',
        type: RULE_ACTION,
        sorting: true,
        // todo: implement
        // sorter: (a, b) => a.defaultAction.localeCompare(b.defaultAction),
        // exportData: (row) => row.defaultAction,
      }),
      helper.simple<'typology'>({
        title: 'Typology',
        key: 'typology',
      }),
      helper.simple<'typologyGroup'>({
        title: 'Typology group',
        key: 'typologyGroup',
      }),
      helper.simple<'typologyDescription'>({
        title: 'Typology description',
        key: 'typologyDescription',
      }),
      helper.simple<'source'>({
        title: 'Source',
        key: 'source',
      }),
      helper.display({
        title: 'Action',
        render: (entity) => {
          return (
            <span>
              <Button
                analyticsName="Select"
                size="MEDIUM"
                type="PRIMARY"
                onClick={() => onEditRule(entity)}
                isDisabled={!canWriteRules}
              >
                Configure
              </Button>
            </span>
          );
        },
      }),
    ];
  }, [canWriteRules, onViewRule, onEditRule]);

  const [params, setParams] = useState<RulesTableParams>({
    ...DEFAULT_PARAMS_STATE,
    sort: [DEFAULT_SORTING],
  });

  const rulesResult = usePaginatedQuery(GET_RULES(params), async () => {
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
    <PageWrapperTableContainer>
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
      />
    </PageWrapperTableContainer>
  );
};
