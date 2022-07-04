import React, { useRef } from 'react';
import type { ActionType, ProColumns } from '@ant-design/pro-table';
import { Tag } from 'antd';
import { files } from './service';
import type { TableListItem, TableListPagination } from './data';
import { FileImportButton } from '@/components/file-import/FileImportButton';
import PageWrapper from '@/components/PageWrapper';
import Table from '@/components/ui/Table';
import { useI18n } from '@/locales';

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
      title: 'Total Transactions',
      dataIndex: 'totalTransactions',
      valueType: 'digit',
    },
    {
      title: 'Imported Transactions',
      dataIndex: 'importedTransactions',
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
    <PageWrapper title={i18n('menu.transactions.transactions-files')}>
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
          persistenceKey: 'transactions-files-list',
        }}
        toolBarRender={() => [<FileImportButton type={'TRANSACTION'} />]}
      />
    </PageWrapper>
  );
};

export default TableList;
