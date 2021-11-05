import { Badge, Table } from 'antd';
import { Timeline } from 'antd';

export const expandedRulesRowRender = () => {
  const columns = [
    { title: 'Transaction ID', dataIndex: 'transactionId', key: 'transactionId' },
    { title: 'Profile Identifier', dataIndex: 'profileId', key: 'profileId', width: 300 },
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
      profileId: 'Profile-20',
      paymentMethod: 'Cash',
      payoutMethod: 'IBAN',
      ruleDescription: "If a user's IP Address is in a Sanctioned Jurisdiction - perform action.",
    },
    {
      profileId: 'Profile-19',
      paymentMethod: 'IBAN',
      payoutMethod: 'Cash',
      ruleDescription:
        'If greater than X number of users register with the same phone number - perform action.',
    },
    {
      profileId: 'Profile-18',
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
      profileId: networkAnalysisData[i].profileId,
      paymentMethod: networkAnalysisData[i].paymentMethod,
      payoutMethod: networkAnalysisData[i].payoutMethod,
      upgradeNum: 'Upgraded: 56',
    });
  }
  return (
    <>
      <Table columns={columns} dataSource={data} pagination={false} />{' '}
      <Timeline>
        <Timeline.Item>Create a services site 2015-09-01</Timeline.Item>
        <Timeline.Item>Solve initial network problems 2015-09-01</Timeline.Item>
        <Timeline.Item>Technical testing 2015-09-01</Timeline.Item>
        <Timeline.Item>Network problems being solved 2015-09-01</Timeline.Item>
      </Timeline>
    </>
  );
};
