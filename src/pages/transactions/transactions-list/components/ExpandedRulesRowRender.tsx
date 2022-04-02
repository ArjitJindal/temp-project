import { Table } from 'antd';
import { RuleActionStatus } from './RuleActionStatus';
import { TransactionWithRulesResult } from '@/apis';

export const ExpandedRulesRowRender = (transaction: TransactionWithRulesResult) => {
  return (
    <Table
      columns={[
        { title: 'Rule ID', dataIndex: 'ruleId', key: 'ruleId' },
        { title: 'Rule Name', dataIndex: 'ruleName', key: 'ruleName', width: 300 },
        { title: 'Rule Description', dataIndex: 'ruleDescription', key: 'ruleDescription' },
        {
          title: 'Action',
          key: 'ruleAction',
          width: 180,
          render: (v, entity) => <RuleActionStatus ruleAction={entity.ruleAction} />,
        },
      ]}
      dataSource={transaction.executedRules}
      pagination={false}
    />
  );
};
