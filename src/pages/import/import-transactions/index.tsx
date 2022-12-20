import React, { useState } from 'react';
import { Tag } from 'antd';
import { files } from './service';
import { TableListItem } from './data';
import { FileImportButton } from '@/components/file-import/FileImportButton';
import PageWrapper from '@/components/PageWrapper';
import { useI18n } from '@/locales';
import { CommonParams, DEFAULT_PARAMS_STATE } from '@/components/ui/Table';
import QueryResultsTable from '@/components/common/QueryResultsTable';
import { useQuery } from '@/utils/queries/hooks';
import { TRANSACTION_FILES } from '@/utils/queries/keys';
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

  const [params, setParams] = useState<CommonParams>(DEFAULT_PARAMS_STATE);

  const filesResult = useQuery(TRANSACTION_FILES(params), async () => {
    const result = await files({
      page: params.page,
      pageSize: params.pageSize,
    });
    return result;
  });

  const i18n = useI18n();
  return (
    <PageWrapper title={i18n('menu.import.import-transactions')}>
      <QueryResultsTable<TableListItem, CommonParams>
        form={{
          labelWrap: true,
        }}
        headerTitle="Files"
        rowKey="id"
        search={false}
        queryResults={filesResult}
        columns={columns}
        params={params}
        onChangeParams={setParams}
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
