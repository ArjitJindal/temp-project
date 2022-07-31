import { Table } from 'antd';
import { RuleActionStatus } from './RuleActionStatus';
import { TransactionCaseManagement } from '@/apis';

export const ExpandedRulesRowRender = (transaction: TransactionCaseManagement) => {
  return (
    <Table
      columns={[
        { title: 'Rule ID', dataIndex: 'ruleId', key: 'ruleId' },
        { title: 'Rule Name', dataIndex: 'ruleName', key: 'ruleName', width: 300 },
        {
          title: 'Action',
          key: 'ruleAction',
          width: 180,
          render: (v, entity) => <RuleActionStatus ruleAction={entity.ruleAction} />,
        },
        { title: 'Rule Description', dataIndex: 'ruleDescription', key: 'ruleDescription' },
      ]}
      dataSource={transaction.executedRules.filter((executedRule) => executedRule.ruleHit)}
      pagination={false}
    />
  );
};
