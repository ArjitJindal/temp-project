import { Button, DatePicker, Space, Table } from 'antd';
import type { ProColumns } from '@ant-design/pro-table';
import ProTable from '@ant-design/pro-table';
import { createTableList, ProcessMap, TableListItem } from './data.d';

const { RangePicker } = DatePicker;

const columns: ProColumns<TableListItem>[] = [
  {
    title: 'Rule Name',
    width: 120,
    dataIndex: 'name',
    fixed: 'left',
    render: (_) => <a>{_}</a>,
  },
  {
    title: 'Rule ID',
    width: 120,
    dataIndex: 'containers',
    align: 'right',
    search: false,
    sorter: (a, b) => a.containers - b.containers,
  },
  {
    title: 'Hits this Month',
    width: 120,
    align: 'right',
    dataIndex: 'callNumber',
  },
  {
    title: 'Block/Flag Rate',
    width: 240,
    dataIndex: 'progress',
    valueType: (item) => ({
      type: 'progress',
      status: ProcessMap[item.status],
    }),
  },
  {
    title: 'Action',
    width: 120,
    dataIndex: 'creator',
    valueType: 'select',
    valueEnum: {
      all: { text: 'ALL' },
      付小小: { text: 'Allow' },
      曲丽丽: { text: 'Block' },
      林东东: { text: 'Flag' },
      陈帅帅: { text: 'Flag' },
      兼某某: { text: 'Block' },
    },
  },
  {
    title: 'Activated At',
    width: 140,
    key: 'since',
    dataIndex: 'createdAt',
    valueType: 'date',
    sorter: (a, b) => a.createdAt - b.createdAt,
    renderFormItem: () => {
      return <RangePicker />;
    },
  },
  {
    title: 'Custom details',
    dataIndex: 'memo',
    ellipsis: true,
    copyable: true,
    search: false,
  },
  {
    title: 'Threshold',
    width: 80,
    key: 'option',
    valueType: 'option',
    fixed: 'right',
    render: () => [<a key="link">u wot m8</a>],
  },
];

export default () => {
  return (
    <ProTable<TableListItem>
      columns={columns}
      rowSelection={{
        // 自定义选择项参考: https://ant.design/components/table-cn/#components-table-demo-row-selection-custom
        // 注释该行则默认不显示下拉选项
        selections: [Table.SELECTION_ALL, Table.SELECTION_INVERT],
      }}
      tableAlertRender={({ selectedRowKeys, selectedRows, onCleanSelected }) => (
        <Space size={24}>
          <span>
            已选 {selectedRowKeys.length} 项
            <a style={{ marginLeft: 8 }} onClick={onCleanSelected}>
              取消选择
            </a>
          </span>
          <span>{`容器数量: ${selectedRows.reduce(
            (pre, item) => pre + item.containers,
            0,
          )} 个`}</span>
          <span>{`调用量: ${selectedRows.reduce(
            (pre, item) => pre + item.callNumber,
            0,
          )} 次`}</span>
        </Space>
      )}
      tableAlertOptionRender={() => {
        return (
          <Space size={16}>
            <a>批量删除</a>
            <a>导出数据</a>
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
