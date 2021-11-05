import { Badge, Table } from 'antd';

export const expandedRulesRowRender = () => {
  const columns = [
    { title: 'Rule ID', dataIndex: 'ruleId', key: 'ruleId' },
    { title: 'Rule Name', dataIndex: 'ruleName', key: 'ruleName', width: 300 },
    { title: 'Rule Description', dataIndex: 'ruleDescription', key: 'ruleDescription' },
    {
      title: 'Action',
      key: 'action',
      width: 180,
      render: () => (
        <span>
          <Badge status="error" />
          Flaged
        </span>
      ),
    },
  ];

  const rulesData = [
    {
      ruleName: 'IP Address from a Sanctioned Country.',
      ruleDescription: "If a user's IP Address is in a Sanctioned Jurisdiction - perform action.",
    },
    {
      ruleName: 'Same phone number for X number of users.',
      ruleDescription:
        'If greater than X number of users register with the same phone number - perform action.',
    },
    {
      ruleName:
        'Velocity - Unique IBAN: Same user paying from >= X different IBANs in time T minute(s).',
      ruleDescription:
        'If a user makes more than transactions in a predefined timeframe T minute(s) using X unique IBANs - perform action',
    },
  ];

  const data = [];
  for (let i = 0; i < 3; ++i) {
    data.push({
      key: i,
      ruleId: `R-${i + 1}-2`,
      ruleName: rulesData[i].ruleName,
      ruleDescription: rulesData[i].ruleDescription,
      upgradeNum: 'Upgraded: 56',
    });
  }
  return <Table columns={columns} dataSource={data} pagination={false} />;
};
