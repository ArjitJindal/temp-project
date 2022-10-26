import { useCallback, useMemo } from 'react';
import style from '../style.module.less';
import { RuleParametersTable } from './RuleParametersTable';
import { Rule } from '@/apis';
import { useApi } from '@/api';
import Button from '@/components/ui/Button';
import { RequestTable } from '@/components/RequestTable';
import { RuleActionTag } from '@/components/rules/RuleActionTag';
import { TableColumn } from '@/components/ui/Table/types';
import { RecommendedTag } from '@/components/ui/RecommendedTag';

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

export const RulesTable: React.FC<Props> = ({ onSelectRule }) => {
  const api = useApi();
  const columns: TableColumn<Rule>[] = useMemo(() => {
    const caseCreationHeaders: TableColumn<Rule>[] = [
      {
        title: 'Rule Case Creation Type',
        width: 150,
        dataIndex: 'defaultCaseCreationType',
      },
      {
        title: 'Rule Case Priority',
        width: 100,
        dataIndex: 'defaultCasePriority',
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
              <span className={style.root}>
                {entity.id} {recommendedRules.includes(entity.id) ? <RecommendedTag /> : ''}
              </span>
            </>
          );
        },
      },
      {
        title: 'Rule Name',
        width: 300,
        dataIndex: 'name',
        sorter: (a, b) => a.name.localeCompare(b.name),
        render: (_, entity) => {
          return entity.name;
        },
      },
      {
        title: 'Rule Description',
        width: 500,
        dataIndex: 'description',
      },
      ...caseCreationHeaders,
      {
        title: 'Default Parameters',
        width: 250,
        render: (_, rule) => (
          <RuleParametersTable parameters={rule.defaultParameters} schema={rule.parametersSchema} />
        ),
      },
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
      },
      {
        width: 140,
        search: false,
        fixed: 'right',
        render: (_, entity) => {
          return (
            <span>
              <Button
                analyticsName="Select"
                shape="round"
                size="small"
                style={{ borderColor: '#1890ff', color: '#1890ff' }}
                onClick={() => onSelectRule(entity)}
              >
                Select
              </Button>
            </span>
          );
        },
      },
    ];
  }, [onSelectRule]);

  const request = useCallback(async () => {
    const rules = await api.getRules({});
    return {
      items: rules,
      success: true,
      total: rules.length,
    };
  }, [api]);

  return (
    <RequestTable<Rule>
      form={{
        labelWrap: true,
      }}
      headerTitle="Select Rule"
      className={style.table}
      scroll={{ x: 1300 }}
      pagination={false}
      rowKey="id"
      search={false}
      request={request}
      columns={columns}
    />
  );
};
