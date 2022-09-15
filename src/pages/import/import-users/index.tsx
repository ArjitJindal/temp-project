import React from 'react';
import { Tag } from 'antd';
import { files } from './service';
import type { TableListItem, TableListPagination } from './data';
import { FileImportButton } from '@/components/file-import/FileImportButton';
import PageWrapper from '@/components/PageWrapper';
import { RequestTable } from '@/components/RequestTable';
import { useI18n } from '@/locales';
import { TableColumn } from '@/components/ui/Table/types';

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
  const columns: TableColumn<TableListItem>[] = [
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

  const i18n = useI18n();
  return (
    <PageWrapper title={i18n('menu.import.import-users')}>
      <RequestTable<TableListItem, TableListPagination>
        form={{
          labelWrap: true,
        }}
        headerTitle="Files"
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
