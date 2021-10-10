import type { ProColumns, ActionType } from '@ant-design/pro-table';
import ProTable from '@ant-design/pro-table';
import { Input, Tag } from 'antd';
import { useRef, useState } from 'react';
import type { TableListItem, TableListPagination } from '../data.d';
import { rules } from '../service';

export const RulesTableSearch: React.FC = () => {
  const [currentRow, setCurrentRow] = useState<TableListItem>();
  const [showDetail, setShowDetail] = useState<boolean>(false);
  const [selectedRowsState, setSelectedRows] = useState<TableListItem[]>([]);

  const actionRef = useRef<ActionType>();

  const columns: ProColumns<TableListItem>[] = [
    {
      title: 'Rule name',
      dataIndex: 'name',
      tip: 'RuleName key',
      render: (dom, entity) => {
        return (
          <a
            onClick={() => {
              setCurrentRow(entity);
              setShowDetail(true);
            }}
          >
            {dom}
          </a>
        );
      },
    },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      render: (types) => (
        <span>
          {types!.map((type: string) => {
            let color;
            if (type === 'sanctions') {
              color = 'volcano';
            } else if (type === 'transaction monitoring') {
              color = 'geekblue';
            } else {
              color = 'green';
            }
            return (
              <Tag color={color} key={type}>
                {type.toUpperCase()}
              </Tag>
            );
          })}
        </span>
      ),
    },
    {
      title: 'Rule ID',
      dataIndex: 'ruleId',
      sorter: true,
      hideInForm: true,
      renderText: (val: string) => `${val}`,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      hideInForm: true,
      sorter: true,
      valueEnum: {
        0: {
          text: 'Not Setup',
          status: 'Default',
        },
        1: {
          text: 'Inactive',
          status: 'Processing',
        },
        2: {
          text: 'Active',
          status: 'Success',
        },
      },
    },
    {
      title: 'Rule description',
      sorter: true,
      dataIndex: 'ruleDescription',
      renderFormItem: (item, { defaultRender, ...rest }, form) => {
        const status = form.getFieldValue('status');

        if (`${status}` === '0') {
          return false;
        }

        if (`${status}` === '3') {
          return <Input {...rest} placeholder="请输入异常原因！" />;
        }

        return defaultRender(item);
      },
    },
  ];
  return (
    <ProTable<TableListItem, TableListPagination>
      headerTitle="Select Rule"
      actionRef={actionRef}
      rowKey="key"
      search={{
        labelWidth: 120,
      }}
      toolBarRender={() => []}
      request={rules}
      columns={columns}
      rowSelection={{
        onChange: (_, selectedRows) => {
          setSelectedRows(selectedRows);
        },
        type: 'radio',
      }}
    />
  );
};
