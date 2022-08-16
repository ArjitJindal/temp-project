import { RuleActionStatus } from './RuleActionStatus';
import { Table } from '@/components/ui/Table';
import { TransactionCaseManagement } from '@/apis';

interface Props {
  transaction: TransactionCaseManagement;
}

export const RulesHitDetailsTable: React.FC<Props> = ({ transaction }) => {
  return (
    <Table
      columns={[
        {
          title: 'Rule Name',
          dataIndex: 'ruleName',
          key: 'ruleName',
          width: 200,
        },
        {
          title: 'Action',
          key: 'ruleAction',
          width: 100,

          render: (v, entity) => <RuleActionStatus ruleAction={entity.ruleAction} />,
        },
        {
          title: 'Rule Description',
          dataIndex: 'ruleDescription',
          key: 'ruleDescription',
          tooltip: 'Describes the conditions required for this rule to be hit.',
        },
      ]}
      dataSource={transaction.executedRules.filter((executedRule) => executedRule.ruleHit)}
      pagination={false}
      search={false}
      toolBarRender={false}
    />
  );
};
