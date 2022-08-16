import { ProColumns } from '@ant-design/pro-table';
import { Typography } from 'antd';
import moment from 'moment';
import { Table } from '@/components/ui/Table';
import { DEFAULT_DATE_TIME_DISPLAY_FORMAT } from '@/utils/dates';

interface TableItem {
  id: string;
  action: string;
  actionTakenBy: string;
  beforeAction: string;
  afterAction: string;
  timeOfAction: number;
  additionalInfo?: string;
}

export const AuditLog: React.FC = () => {
  const tableData: TableItem[] = [
    {
      id: 'audit-al-44321',
      action: 'Rule Deactivated',
      actionTakenBy: 'Sagar Patil',
      beforeAction: 'Active',
      afterAction: 'Inactive',
      timeOfAction: 1659447454000,
      additionalInfo: 'R-23',
    },
    {
      id: 'audit-al-23111',
      action: 'Rule Created',
      actionTakenBy: 'Baran Ozkan',
      beforeAction: '-',
      afterAction: 'Rule Created',
      timeOfAction: 1659353781000,
      additionalInfo: 'R-43',
    },
    {
      id: 'audit-al-45112',
      action: 'Rule Deactivated',
      actionTakenBy: 'Sagar Patil',
      beforeAction: 'Active',
      afterAction: 'Inactive',
      timeOfAction: 1659335781000,
      additionalInfo: 'R-2',
    },
    {
      id: 'audit-al-0081',
      action: 'Rule Deactivated',
      actionTakenBy: 'Baran Ozkan',
      beforeAction: 'Active',
      afterAction: 'Inactive',
      timeOfAction: 1659375381000,
      additionalInfo: 'R-43',
    },
    {
      id: 'audit-al-8713',
      action: 'User Details Viewed',
      actionTakenBy: 'Sagar Patil',
      beforeAction: '-',
      afterAction: '-',
      timeOfAction: 1659447454000,
      additionalInfo: 'Scott Pippen',
    },
    {
      id: 'audit-al-811723',
      action: 'Console Account Added',
      actionTakenBy: 'Baran Ozkan',
      beforeAction: '-',
      afterAction: '-',
      timeOfAction: 1659353781000,
      additionalInfo: 'Damilola Ibitola',
    },
    {
      id: 'audit-al-908371',
      action: 'Case status Changed',
      actionTakenBy: 'Damilola Ibitola',
      beforeAction: '-',
      afterAction: '-',
      timeOfAction: 1659335781000,
      additionalInfo: 'case-123128784',
    },
    {
      id: 'audit-al-1009',
      action: 'Case status Changed',
      actionTakenBy: 'Sagar Patil',
      beforeAction: 'Active',
      afterAction: 'Inactive',
      timeOfAction: 1659075381000,
      additionalInfo: 'case-123128784',
    },
    {
      id: 'audit-al-101',
      action: 'Rule Deactivated',
      actionTakenBy: 'Baran Ozkan',
      beforeAction: 'Active',
      afterAction: 'Inactive',
      timeOfAction: 1659417454000,
      additionalInfo: 'R-102',
    },
    {
      id: 'audit-al-209817',
      action: 'Rule Created',
      actionTakenBy: 'Baran Ozkan',
      beforeAction: '-',
      afterAction: 'Rule Created',
      timeOfAction: 1659313781000,
      additionalInfo: 'R-36',
    },
    {
      id: 'audit-al-65574',
      action: 'Case status Changed',
      actionTakenBy: 'Baran Ozkan',
      beforeAction: '-',
      afterAction: '-',
      timeOfAction: 1659449857000,
      additionalInfo: 'case-43321567',
    },
    {
      id: 'audit-al-60098',
      action: 'Rule Changed',
      actionTakenBy: 'Sagar Patil',
      beforeAction: '-',
      afterAction: '-',
      timeOfAction: 1659365381000,
      additionalInfo: 'R-36',
    },
  ];

  const columns: ProColumns<TableItem>[] = [
    {
      title: <Typography.Text strong>ID</Typography.Text>,
      width: '160px',
      dataIndex: 'id',
    },
    {
      title: <Typography.Text strong>Action</Typography.Text>,
      width: '140px',
      dataIndex: 'action',
      render: (_, auditLog) => {
        return (
          <>
            {auditLog.action}
            <br />
            <span style={{ color: '#7284a3' }}>{auditLog.additionalInfo}</span>
          </>
        );
      },
    },
    {
      title: <Typography.Text strong>Before action</Typography.Text>,
      width: '100px',
      dataIndex: 'beforeAction',
    },
    {
      title: <Typography.Text strong>After action</Typography.Text>,
      width: '100px',
      dataIndex: 'afterAction',
    },
    {
      title: <Typography.Text strong>Action taken by</Typography.Text>,
      width: '150px',
      dataIndex: 'actionTakenBy',
    },
    {
      title: <Typography.Text strong>Time of Action</Typography.Text>,
      width: '200px',
      dataIndex: 'timeOfAction',
      valueType: 'dateTimeRange',
      sorter: true,
      render: (_, auditLog) => {
        return moment(auditLog.timeOfAction).format(DEFAULT_DATE_TIME_DISPLAY_FORMAT);
      },
    },
  ];

  return (
    <Table<TableItem>
      disableStripedColoring={true}
      rowKey="action"
      headerTitle="Audit Log"
      search={false}
      columns={columns}
      pagination={false}
      dataSource={tableData}
      options={{
        setting: false,
        density: false,
        reload: false,
      }}
    />
  );
};
