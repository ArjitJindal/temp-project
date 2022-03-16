import { Badge, Table } from 'antd';
import { TransactionWithRulesResult } from '@/apis';

function getActionBadgeStatus(ruleAction: string) {
  if (ruleAction === 'ALLOW') {
    return 'success';
  } else if (ruleAction === 'FLAG') {
    return 'warning';
  } else if (ruleAction === 'BLOCK') {
    return 'error';
  } else {
    return 'error';
  }
}

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
          render: (v, entity) => (
            <span>
              <Badge status={getActionBadgeStatus(entity.ruleAction)} />
              {entity.ruleAction}
            </span>
          ),
        },
      ]}
      dataSource={transaction.executedRules}
      pagination={false}
    />
  );
};
