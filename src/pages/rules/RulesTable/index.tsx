import { useMemo } from 'react';
import { useLocalStorageState } from 'ahooks';
import style from './style.module.less';
import { Rule } from '@/apis';
import { useApi } from '@/api';
import Button from '@/components/library/Button';
import { RuleActionTag } from '@/components/rules/RuleActionTag';
import { TableColumn } from '@/components/ui/Table/types';
import { RecommendedTag } from '@/components/ui/RecommendedTag';
import { usePaginatedQuery } from '@/utils/queries/hooks';
import { GET_RULES } from '@/utils/queries/keys';
import QueryResultsTable from '@/components/common/QueryResultsTable';
import { getBranding } from '@/utils/branding';
import { useHasPermissions } from '@/utils/user-utils';

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

const branding = getBranding();

export const RulesTable: React.FC<Props> = ({ onViewRule, onEditRule }) => {
  const api = useApi();
  const canWriteRules = useHasPermissions(['rules:my-rules:write']);
  const columns: TableColumn<Rule>[] = useMemo(() => {
    const caseCreationHeaders: TableColumn<Rule>[] = [
      {
        title: 'Default nature',
        width: 100,
        dataIndex: 'defaultNature',
      },
    ];
    return [
      {
        title: 'ID',
        subtitle: 'Name',
        width: 200,
        dataIndex: 'id',
        sorter: (a, b) => parseInt(a.id.split('-')[1]) - parseInt(b.id.split('-')[1]),
        defaultSortOrder: 'ascend',
        render: (_, entity) => {
          return (
            <>
              <a
                onClick={() => {
                  onViewRule(entity);
                }}
              >
                <span className={style.root}>
                  {entity.id}{' '}
                  {recommendedRules.includes(entity.id) ? (
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
        exportData: (row) => row.id,
      },
      {
        title: 'Description',
        width: 300,
        dataIndex: 'description',
        exportData: (row) => row.description,
      },
      ...caseCreationHeaders,
      {
        title: 'Default action',
        width: 150,
        dataIndex: 'defaultAction',
        sorter: (a, b) => a.defaultAction.localeCompare(b.defaultAction),
        render: (_, rule) => {
          return (
            <span>
              <RuleActionTag ruleAction={rule.defaultAction} />
            </span>
          );
        },
        exportData: (row) => row.defaultAction,
      },
      {
        title: 'Typology',
        width: 300,
        dataIndex: 'typology',
        exportData: (row) => row.typology,
      },
      {
        title: 'Typology group',
        width: 170,
        dataIndex: 'typologyGroup',
        exportData: (row) => row.typologyGroup,
      },
      {
        title: 'Typology description',
        width: 320,
        dataIndex: 'typologyDescription',
        exportData: (row) => row.typologyDescription,
      },
      {
        title: 'Source',
        width: 320,
        dataIndex: 'source',
        exportData: (row) => row.source,
      },
      {
        title: 'Action',
        width: 140,
        search: false,
        render: (_, entity) => {
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
      },
    ];
  }, [canWriteRules, onViewRule, onEditRule]);

  const rulesResult = usePaginatedQuery(GET_RULES(), async () => {
    const rules = await api.getRules();
    return {
      items: rules,
      total: rules.length,
    };
  });

  const isExistingUser = useLocalStorageState('rule-active-tab');

  const defaultColumnsState = {
    // default check these 3 columns for new users, uncheck for existing users before added columns
    typologyGroup: {
      show: !isExistingUser,
    },
    typologyDescription: {
      show: !isExistingUser,
    },
    source: {
      show: !isExistingUser,
    },
    // default uncheck defaultAction for all users
    defaultAction: {
      show: false,
    },
  };

  return (
    <QueryResultsTable<Rule>
      form={{
        labelWrap: true,
      }}
      className={style.table}
      scroll={{ x: 1300 }}
      pagination={false}
      rowKey="id"
      search={false}
      queryResults={rulesResult}
      columns={columns}
      columnsState={{
        persistenceType: 'localStorage',
        persistenceKey: 'rules-library-table',
        defaultValue: defaultColumnsState,
      }}
    />
  );
};
