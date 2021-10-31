import { Button, Space, Table, Tag, Modal } from 'antd';
import type { ProColumns } from '@ant-design/pro-table';
import ProTable from '@ant-design/pro-table';
import { ProcessMap } from './data.d';
import { RuleTableListItem, actionToColor, ThresholdDataType } from '../data.d';
import { PageContainer } from '@ant-design/pro-layout';
import { getActiveRules } from './service';

const handleAction = (key: string | number) => {
  if (key === 'activate') {
    Modal.confirm({
      title: 'Confirm Deactivation',
      content: 'Confirm rule',
      okText: 'Activate',
      cancelText: 'Cancel',
      onOk: () => console.log('WHAAAA'), // deleteItem(currentItem.id),
    });
  } else if (key === 'deactivate') {
    Modal.confirm({
      title: 'Confirm Deactivation',
      content: 'Confirm rule',
      okText: 'Deactivate',
      cancelText: 'Cancel',
      onOk: () => console.log('WHAAAA'), // deleteItem(currentItem.id),
    });
  }
};

const columns: ProColumns<RuleTableListItem>[] = [
  {
    title: 'Rule ID',
    width: 80,
    dataIndex: 'ruleId',
    fixed: 'left',
    align: 'left',
    search: false,
  },
  {
    title: 'Rule Name',
    width: 240,
    dataIndex: 'name',
  },
  {
    title: 'Rule Description',
    dataIndex: 'ruleDescription',
    align: 'left',
    search: false,
  },
  {
    title: 'Rule Hit Rate',
    width: 120,
    dataIndex: 'hitRate',
    valueType: (item) => ({
      type: 'progress',
      status: ProcessMap[item.hitRate],
    }),
  },
  {
    title: 'Action',
    width: 80,
    dataIndex: 'ruleAction',
    key: 'ruleAction',
    render: (ruleAction) => {
      return (
        <span>
          <Tag color={actionToColor[ruleAction as string]}>
            {(ruleAction as string).toUpperCase()}
          </Tag>
        </span>
      );
    },
  },
  {
    title: 'Activated At',
    width: 120,
    key: 'since',
    dataIndex: 'activatedAt',
    valueType: 'date',
    sorter: (a, b) => a.activatedAt - b.activatedAt,
  },
  {
    title: 'Status',
    dataIndex: 'status',
    width: 80,
    search: false,
    valueEnum: {
      0: {
        text: 'Inactive',
        status: 'Processing',
      },
      1: {
        text: 'Active',
        status: 'Success',
      },
    },
  },
  {
    title: 'Threshold',
    dataIndex: 'thresholdData',
    search: false,
    width: 300,
    key: 'thresholdData',
    render: (thresholdData) => {
      if (!thresholdData) {
        return <span>Not Applicable</span>;
      }
      const columns = [
        {
          title: 'Parameter',
          dataIndex: 'parameter',
        },
        {
          title: 'Value',
          dataIndex: 'value',
        },
      ];
      const dataSource = (thresholdData as ThresholdDataType[]).map(
        (threshold: any, index: number) => {
          return {
            key: index,
            parameter: threshold?.parameter,
            value: threshold?.defaultValue,
          };
        },
      );
      return (
        <Table
          columns={columns}
          dataSource={dataSource}
          pagination={false}
          bordered
          size={'small'}
        />
      );
    },
  },
  {
    title: 'Action',
    width: 140,
    dataIndex: 'status',
    key: 'status',
    fixed: 'right',
    render: (status) => {
      return (
        <span>
          {status == 0 ? (
            <Button
              shape="round"
              size="small"
              style={{ borderColor: '#1890ff', color: '#1890ff' }}
              onClick={() => handleAction('activate')}
            >
              Activate
            </Button>
          ) : (
            <Button shape="round" size="small" danger onClick={() => handleAction('deactivate')}>
              Deactivate
            </Button>
          )}
        </span>
      );
    },
  },
];

export default () => {
  return (
    <PageContainer content="List of all created rules. Activate/deactivate them in one click">
      <ProTable<RuleTableListItem>
        columns={columns}
        rowSelection={
          {
            // Custom selection item reference: https://ant.design/components/table-cn/#components-table-demo-row-selection-custom
            // Comment this line, the drop-down option is not displayed by default
            //selections: [Table.SELECTION_ALL, Table.SELECTION_INVERT],
          }
        }
        tableAlertRender={({ selectedRowKeys, selectedRows, onCleanSelected }) => (
          <Space size={24}>
            <span>
              Selected {selectedRowKeys.length} Rules
              <a style={{ marginLeft: 8 }} onClick={onCleanSelected}>
                Reset
              </a>
            </span>
          </Space>
        )}
        tableAlertOptionRender={() => {
          return (
            <Space size={16}>
              <a>Export Data</a>
            </Space>
          );
        }}
        request={getActiveRules}
        scroll={{ x: 1300 }}
        options={false}
        search={false}
        rowKey="key"
      />
    </PageContainer>
  );
};
