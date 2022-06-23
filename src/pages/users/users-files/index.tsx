import React, { useRef } from 'react';
import { PageContainer } from '@ant-design/pro-layout';
import type { ProColumns, ActionType } from '@ant-design/pro-table';
import { Tag } from 'antd';
import { files } from './service';
import type { TableListItem, TableListPagination } from './data';
import { FileImportButton } from '@/components/file-import/FileImportButton';
import PageWrapper from '@/components/PageWrapper';
import Table from '@/components/ui/Table';

function getStatusColor(status: string): string {
  switch (status) {
    case 'IN_PROGRESS':
      return 'processing';
    case 'IMPORTED':
      return 'success';
    case 'FAILED':
      return 'error';
  }
  return 'warning';
}

const TableList: React.FC = () => {
  const actionRef = useRef<ActionType>();

  const columns: ProColumns<TableListItem>[] = [
    {
      title: 'ID',
      dataIndex: 'id',
      tip: 'File identifier',
      render: (dom) => {
        return <a>{dom}</a>;
      },
    },
    {
      title: 'Filename',
      dataIndex: 'filename',
      valueType: 'text',
    },
    {
      title: 'Created At',
      dataIndex: 'createdAt',
      valueType: 'dateTime',
    },
    {
      title: 'Total Users',
      dataIndex: 'totalUsers',
      valueType: 'digit',
    },
    {
      title: 'Imported Users',
      dataIndex: 'importedUsers',
      valueType: 'digit',
    },
    {
      title: 'Status',
      dataIndex: 'status',
      valueType: 'text',
      render: (status: any) => {
        return (
          <span>
            <Tag color={getStatusColor(status)}>{status}</Tag>
          </span>
        );
      },
    },
  ];

  return (
    <PageWrapper>
      <Table<TableListItem, TableListPagination>
        form={{
          labelWrap: true,
        }}
        headerTitle="Files"
        actionRef={actionRef}
        rowKey="id"
        search={false}
        request={files}
        columns={columns}
        columnsState={{
          persistenceType: 'localStorage',
          persistenceKey: 'users-files-list',
        }}
        toolBarRender={() => [
          <FileImportButton type={'USER'} buttonText="Import (Consumer User)" />,
          <FileImportButton type={'BUSINESS'} buttonText="Import (Business User)" />,
        ]}
      />
    </PageWrapper>
  );
};

export default TableList;
