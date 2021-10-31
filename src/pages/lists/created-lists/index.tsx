import React from 'react';
import { Card } from 'antd';
import { PageContainer } from '@ant-design/pro-layout';
import type { ProColumns } from '@ant-design/pro-table';
import type { CreateListsTableListItem } from './data.d';
import ProTable from '@ant-design/pro-table';
import { getActiveLists } from './service';

const StepForm: React.FC<Record<string, any>> = () => {
  const columns: ProColumns<CreateListsTableListItem>[] = [
    {
      title: 'List ID',
      width: 80,
      dataIndex: 'listId',
      fixed: 'left',
      align: 'left',
      search: false,
    },
    {
      title: 'List Name',
      width: 240,
      dataIndex: 'listName',
    },
    {
      title: 'Created At',
      dataIndex: 'createdAt',
      align: 'left',
      search: false,
      valueType: 'date',
    },
  ];

  return (
    <PageContainer content="Custom lists you have created">
      <Card bordered={false}>
        <>
          <ProTable<CreateListsTableListItem>
            columns={columns}
            request={getActiveLists}
            scroll={{ x: 1300 }}
            options={false}
            search={false}
            rowKey="key"
          />
        </>
      </Card>
    </PageContainer>
  );
};

export default StepForm;
