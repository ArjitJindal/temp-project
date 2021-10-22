import { Button, DatePicker, Space, Table, Tag } from 'antd';
import type { ProColumns } from '@ant-design/pro-table';
import ProTable from '@ant-design/pro-table';
import { createTableList, ProcessMap } from './data.d';
import { RuleTableListItem, actionToColor } from '../data.d';

const { RangePicker } = DatePicker;

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
    renderFormItem: () => {
      return <RangePicker />;
    },
  },
  {
    title: 'Status',
    dataIndex: 'status',
    ellipsis: true,
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
    ellipsis: true,
    search: false,
  },
  {
    title: 'Action',
    width: 140,
    dataIndex: 'status',
    key: 'status',
    fixed: 'right',
    render: (status) => {
      console.log(status);
      return (
        <span>
          {status == 0 ? (
            <Button shape="round" size="small" style={{ borderColor: '#1890ff', color: '#1890ff' }}>
              Activate
            </Button>
          ) : (
            <Button shape="round" size="small" danger>
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
    <ProTable<RuleTableListItem>
      columns={columns}
      rowSelection={
        {
          // 自定义选择项参考: https://ant.design/components/table-cn/#components-table-demo-row-selection-custom
          // 注释该行则默认不显示下拉选项
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
      dataSource={createTableList()}
      scroll={{ x: 1300 }}
      options={false}
      search={false}
      rowKey="key"
      headerTitle="Active Rules"
      toolBarRender={() => [<Button key="show">查看日志</Button>]}
    />
  );
};
