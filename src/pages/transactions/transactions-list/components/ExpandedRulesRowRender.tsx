import { Badge, Table } from 'antd';

export const expandedRulesRowRender = () => {
  const columns = [
    { title: 'Rule ID', dataIndex: 'ruleId', key: 'ruleId' },
    { title: 'Rule Name', dataIndex: 'ruleName', key: 'ruleName' },
    {
      title: 'Action',
      key: 'action',
      render: () => (
        <span>
          <Badge status="error" />
          Blocked
        </span>
      ),
    },
  ];

  const data = [];
  for (let i = 0; i < 3; ++i) {
    data.push({
      key: i,
      ruleId: 'R-1-2',
      ruleName: 'This is production name',
      upgradeNum: 'Upgraded: 56',
    });
  }
  return <Table columns={columns} dataSource={data} pagination={false} />;
};
