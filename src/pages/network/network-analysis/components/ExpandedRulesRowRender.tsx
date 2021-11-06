import { Badge, Table, Space } from 'antd';
import { Timeline } from 'antd';

export const expandedRulesRowRender = () => {
  const columns = [
    { title: 'Transaction ID', dataIndex: 'transactionId', key: 'transactionId' },
    {
      title: 'Profile Identifier From',
      dataIndex: 'profileIdFrom',
      key: 'profileIdFrom',
      width: 300,
    },
    { title: 'Profile Identifier To', dataIndex: 'profileIdTo', key: 'profileIdTo', width: 300 },
    { title: 'Payment Method', dataIndex: 'paymentMethod', key: 'paymentMethod' },
    { title: 'Payout Method', dataIndex: 'payoutMethod', key: 'payoutMethod' },
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

  const networkAnalysisData = [
    {
      profileIdFrom: 'Profile-20',
      profileIdTo: 'Profile-19',
      paymentMethod: 'Cash',
      payoutMethod: 'IBAN',
      ruleDescription: "If a user's IP Address is in a Sanctioned Jurisdiction - perform action.",
    },
    {
      profileIdFrom: 'Profile-19',
      profileIdTo: 'Profile-18',
      paymentMethod: 'IBAN',
      payoutMethod: 'Cash',
      ruleDescription:
        'If greater than X number of users register with the same phone number - perform action.',
    },
    {
      profileIdFrom: 'Profile-18',
      profileIdTo: 'Profile-20',
      paymentMethod: 'IBAN',
      payoutMethod: 'Credit Card',
      ruleDescription:
        'If a user makes more than transactions in a predefined timeframe T minute(s) using X unique IBANs - perform action',
    },
  ];

  const data = [];
  for (let i = 0; i < 3; ++i) {
    data.push({
      key: i,
      transactionId: `T-${i + 1}`,
      profileIdFrom: networkAnalysisData[i].profileIdFrom,
      profileIdTo: networkAnalysisData[i].profileIdTo,
      paymentMethod: networkAnalysisData[i].paymentMethod,
      payoutMethod: networkAnalysisData[i].payoutMethod,
      upgradeNum: 'Upgraded: 56',
    });
  }
  return (
    <>
      <Table columns={columns} dataSource={data} pagination={false} />{' '}
      <Space size="large" style={{ marginTop: '40px' }}>
        <Timeline>
          <Timeline.Item>
            Transfer made from <strong>Baran Ozkan</strong> to <strong>Orhan Mutlu </strong> on
            2021-09-01
          </Timeline.Item>
          <Timeline.Item>
            Transfer made from <strong>Orhan Mutlu</strong> to <strong>Madhu Nadig</strong> on
            2021-09-01
          </Timeline.Item>
          <Timeline.Item>
            Transfer made from <strong>Madhu Nadig</strong> to <strong>Baran Ozkan</strong> on
            2021-09-01
          </Timeline.Item>
        </Timeline>
      </Space>
    </>
  );
};
