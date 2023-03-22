import { RuleActionStatus } from '@/components/ui/RuleActionStatus';
import { InternalTransaction } from '@/apis';
import Table from '@/components/ui/Table';

interface Props {
  transaction: InternalTransaction;
}

export const RulesHitDetailsTable: React.FC<Props> = ({ transaction }) => {
  return (
    <Table
      rowKey={'ruleInstanceId'}
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
      data={{
        items: transaction.executedRules.filter((executedRule) => executedRule.ruleHit),
      }}
      pagination={false}
      search={false}
      toolBarRender={false}
    />
  );
};
