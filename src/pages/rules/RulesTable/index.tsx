import { useMemo } from 'react';
import style from './style.module.less';
import { Rule } from '@/apis';
import { useApi } from '@/api';
import Button from '@/components/ui/Button';
import { RuleActionTag } from '@/components/rules/RuleActionTag';
import { TableColumn } from '@/components/ui/Table/types';
import { RecommendedTag } from '@/components/ui/RecommendedTag';
import { usePaginatedQuery } from '@/utils/queries/hooks';
import { GET_RULES } from '@/utils/queries/keys';
import QueryResultsTable from '@/components/common/QueryResultsTable';
import { getBranding } from '@/utils/branding';

interface Props {
  onSelectRule: (rule: Rule) => void;
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

export const RulesTable: React.FC<Props> = ({ onSelectRule }) => {
  const api = useApi();
  const columns: TableColumn<Rule>[] = useMemo(() => {
    const caseCreationHeaders: TableColumn<Rule>[] = [
      {
        title: 'Default Nature',
        width: 100,
        dataIndex: 'defaultNature',
      },
    ];
    return [
      {
        title: 'Rule ID',
        width: 200,
        dataIndex: 'id',
        sorter: (a, b) => parseInt(a.id.split('-')[1]) - parseInt(b.id.split('-')[1]),
        defaultSortOrder: 'ascend',
        render: (_, entity) => {
          return (
            <>
              <a onClick={() => onSelectRule(entity)}>
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
        title: 'Rule Description',
        width: 300,
        dataIndex: 'description',
        exportData: (row) => row.description,
      },
      ...caseCreationHeaders,
      {
        title: 'Default Action',
        width: 150,
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
        width: 90,
        search: false,
        render: (_, entity) => {
          return (
            <span>
              <Button
                analyticsName="Select"
                size="middle"
                type="primary"
                onClick={() => onSelectRule(entity)}
              >
                Configure
              </Button>
            </span>
          );
        },
      },
    ];
  }, [onSelectRule]);

  const rulesResult = usePaginatedQuery(GET_RULES(), async () => {
    const rules = await api.getRules();
    return {
      items: rules,
      total: rules.length,
    };
  });
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
    />
  );
};
