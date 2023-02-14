import { RuleActionStatus } from '@/components/ui/RuleActionStatus';
import { CaseTransaction } from '@/apis';
import Table from '@/components/ui/Table';

interface Props {
  transaction: CaseTransaction;
}

export default function RulesHitDetailsTable({ transaction }: Props) {
  const hitRules = transaction.hitRules;
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
        total: hitRules.length,
        items: hitRules,
      }}
      pagination={false}
      search={false}
      toolBarRender={false}
      disableInternalPadding={true}
      disableExpandedRowPadding={true}
      disableStripedColoring={true}
    />
  );
}
